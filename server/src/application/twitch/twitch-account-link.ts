import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { assessPlayerCanonicalizationSafety, type CanonicalizationSafety } from './player-canonicalization-safety.js';
import { targetedRowMetadata } from '../migration/targeted-player-rows.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { derivePlayerLevel } from '../../domain/player/player-progression.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { isDisposableWebPlayer, moveDisposableWebIdentity } from './twitch-profile-claim.js';

type Tx = Prisma.TransactionClient;
export type ProgressionChoice = 'WEB' | 'TWITCH';
const changed = () => new AppError('La liaison a changé. Recommencez avec votre compte Twitch.', 409, 'TWITCH_PROFILE_CHANGED');
const conflict = () => new AppError('Une autre identité ou une opération en cours nécessite une résolution opérateur.', 409, 'TWITCH_PROFILE_WEB_CONFLICT');

async function summary(tx: Tx, playerId: string) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const progression = await tx.playerProgression.findUniqueOrThrow({ where: { playerId } });
  const balances = await tx.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } });
  const activity = await tx.playerActivityState.findUnique({ where: { playerId } });
  const dates = [activity?.lastGameplayActivityAt, activity?.lastInternalChatAt, activity?.lastTwitchActivityAt, progression.lastXpAt].filter((date): date is Date => Boolean(date));
  return { displayName: player.displayName, level: derivePlayerLevel(progression.xp), totalXp: progression.xp.toString(), elementKey: player.elementKey,
    resources: Object.fromEntries(balances.map(row => [row.resourceKey, row.amount.toString()])),
    totalMessages: progression.totalMessages.toString(), characters: await tx.playerCharacter.count({ where: { playerId } }),
    recentActivityAt: dates.length ? new Date(Math.max(...dates.map(date => +date))).toISOString() : null };
}
type DecisionState = { version:1; presentation:{web:Awaited<ReturnType<typeof summary>>;twitch:Awaited<ReturnType<typeof summary>>}; fingerprints:{web:string;twitch:string}; safety:{WEB:CanonicalizationSafety;TWITCH:CanonicalizationSafety} };
type DecisionSnapshot = DecisionState & { revision:string };
async function decisionState(tx:Tx,webId:string,twitchId:string,twitchUserId:string):Promise<DecisionState> {
  const meta=await targetedRowMetadata(tx);
  const web=await assessPlayerCanonicalizationSafety(tx,webId,meta),twitch=await assessPlayerCanonicalizationSafety(tx,twitchId,meta);
  const safety={WEB:twitch.safety,TWITCH:web.safety};
  const native=await tx.twitchNativeTarget.findUnique({where:{twitchUserId}}),control=await tx.twitchNativeAuthority.findUnique({where:{id:'twitch-commands'}});
  if(native&&control&&control.desiredMode!=='OFF'&&safety.WEB.status==='SAFE') safety.WEB={status:'OPERATOR_REQUIRED',reason:'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR'};
  return {version:1,presentation:{web:await summary(tx,webId),twitch:await summary(tx,twitchId)},fingerprints:{web:web.fingerprint,twitch:twitch.fingerprint},safety};
}
const snapshot = (state:DecisionState):DecisionSnapshot => ({...state,revision:randomUUID()});
function matchesDecision(current:DecisionState,previous:Prisma.JsonValue) {
  if(!previous||typeof previous!=='object'||Array.isArray(previous)||previous.version!==1||typeof previous.revision!=='string') return false;
  const {revision:_revision,...state}=previous;
  return isDeepStrictEqual(current,state);
}
const resolutionDto = (record:{id:string;expiresAt:Date},state:DecisionSnapshot) => ({id:record.id,expiresAt:record.expiresAt.toISOString(),revision:state.revision,...state.presentation,safety:state.safety});
async function lock(tx: Tx, ids: string[], twitchUserId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${twitchUserId}`},0))::text`;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...new Set(ids)].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
}
async function validatePair(tx: Tx, webIdentityId: string, webPlayerId: string, twitchPlayerId: string, twitchUserId: string) {
  const web = await tx.webIdentity.findUnique({ where: { id: webIdentityId }, include: { player: true } });
  const twitch = await tx.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } });
  if (!web || web.state !== 'ACTIVE' || web.playerId !== webPlayerId || web.player.status !== 'ACTIVE' || !twitch || twitch.playerId !== twitchPlayerId || twitch.player.status !== 'ACTIVE') throw changed();
  if (webPlayerId !== twitchPlayerId && (await tx.webIdentity.findUnique({ where: { playerId: twitchPlayerId } }) || await tx.twitchIdentity.findUnique({ where: { playerId: webPlayerId } }))) throw conflict();
  const native = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId } });
  if (native?.dataAuthority === 'MIGRATION_PENDING' || native?.playerId && native.playerId !== twitchPlayerId) throw conflict();
  return { web, twitch };
}

/** OAuth proof is server-only. Archived graphs remain internal evidence, never an alternate playable save. */
export class TwitchAccountLink {
  constructor(private readonly db: PrismaClient) {}
  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let retry = 0; ; retry++) {
      try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }); }
      catch (error) { if (retry < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
  async verified(webIdentityId: string, expectedPlayerId: string, twitchUserId: string, login: string, displayName: string | null) {
    return this.transaction(async tx => {
      const target = await tx.twitchIdentity.findUnique({ where: { twitchUserId } });
      await lock(tx, [expectedPlayerId, ...(target ? [target.playerId] : [])], twitchUserId);
      const web = await tx.webIdentity.findUnique({ where: { id: webIdentityId }, include: { player: true } });
      if (!web || web.state !== 'ACTIVE' || web.playerId !== expectedPlayerId || web.player.status !== 'ACTIVE') throw changed();
      const current = await tx.twitchIdentity.findUnique({ where: { twitchUserId } });
      if (current?.playerId !== target?.playerId) throw changed();
      if (!current) {
        if (await tx.twitchIdentity.findUnique({ where: { playerId: web.playerId } })) throw conflict();
        const native = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId } });
        if (native?.playerId && native.playerId !== web.playerId || native?.dataAuthority === 'MIGRATION_PENDING') throw conflict();
        await tx.twitchIdentity.create({ data: { playerId: web.playerId, twitchUserId, login, displayName } });
        if (native && !native.playerId) await tx.twitchNativeTarget.update({ where: { twitchUserId }, data: { playerId: web.playerId } });
        return { linked: true, playerId: web.playerId, resolutionRequired: false };
      }
      const pair = await validatePair(tx, webIdentityId, expectedPlayerId, current.playerId, twitchUserId);
      if (pair.web.playerId === pair.twitch.playerId) {
        await tx.twitchIdentity.update({ where: { twitchUserId }, data: { login, displayName } });
        return { linked: true, playerId: pair.web.playerId, resolutionRequired: false };
      }
      if (await isDisposableWebPlayer(tx, pair.web.playerId)) {
        await moveDisposableWebIdentity(tx, pair.web.id, pair.web.playerId, pair.twitch.playerId);
        await tx.twitchIdentity.update({ where: { twitchUserId }, data: { login, displayName } });
        return { linked: true, playerId: pair.twitch.playerId, resolutionRequired: false };
      }
      const now = new Date();
      await tx.twitchLinkResolution.updateMany({ where: { webIdentityId, completedAt: null, createdAt: { lt: now }, expiresAt: { gt: now } }, data: { expiresAt: now } });
      await tx.twitchLinkResolution.create({ data: { webIdentityId, webPlayerId: pair.web.playerId, twitchPlayerId: pair.twitch.playerId,
        twitchUserId, login, displayName, comparedState: snapshot(await decisionState(tx,pair.web.playerId,pair.twitch.playerId,twitchUserId)), expiresAt: new Date(+now + 15 * 60_000) } });
      return { linked: false, playerId: pair.web.playerId, resolutionRequired: true };
    });
  }
  async pending(webIdentityId: string) {
    return this.transaction(async tx => {
      const record = await tx.twitchLinkResolution.findFirst({ where: { webIdentityId, completedAt: null, expiresAt: { gt: new Date() } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (!record) return null;
      await lock(tx, [record.webPlayerId, record.twitchPlayerId], record.twitchUserId);
      await validatePair(tx, webIdentityId, record.webPlayerId, record.twitchPlayerId, record.twitchUserId);
      const current=await decisionState(tx,record.webPlayerId,record.twitchPlayerId,record.twitchUserId);
      const comparedState=matchesDecision(current,record.comparedState)?record.comparedState as unknown as DecisionSnapshot:snapshot(current);
      await tx.twitchLinkResolution.update({ where: { id: record.id }, data: { comparedState } });
      return resolutionDto(record,comparedState);
    });
  }
  async resolve(webIdentityId: string, resolutionId: string, choice: ProgressionChoice, decisionRevision:string) {
    return this.transaction(async tx => {
      const record = await tx.twitchLinkResolution.findUnique({ where: { id: resolutionId } });
      if (!record || record.webIdentityId !== webIdentityId) throw changed();
      await lock(tx, [record.webPlayerId, record.twitchPlayerId], record.twitchUserId);
      if (record.completedAt) {
        const web = await tx.webIdentity.findUnique({ where: { id: webIdentityId } });
        const winner = record.choice === 'WEB' ? record.webPlayerId : record.twitchPlayerId;
        const twitch = await tx.twitchIdentity.findUnique({ where: { twitchUserId: record.twitchUserId } });
        if (record.choice !== choice || web?.playerId !== winner || twitch?.playerId !== winner) throw changed();
        return { linked: true, playerId: winner, resolutionRequired: false };
      }
      if (record.expiresAt <= new Date()) throw new AppError('La vérification Twitch a expiré. Recommencez la liaison.', 409, 'TWITCH_RESOLUTION_EXPIRED');
      await validatePair(tx, webIdentityId, record.webPlayerId, record.twitchPlayerId, record.twitchUserId);
      const current=await decisionState(tx,record.webPlayerId,record.twitchPlayerId,record.twitchUserId);
      const identical=matchesDecision(current,record.comparedState);
      const comparedState=identical?record.comparedState as unknown as DecisionSnapshot:snapshot(current);
      if(!identical||comparedState.revision!==decisionRevision) {
        if(!identical) await tx.twitchLinkResolution.update({where:{id:record.id},data:{comparedState}});
        return {linked:false,resolutionRequired:true,resolution:resolutionDto(record,comparedState)};
      }
      if(current.safety[choice].status==='OPERATOR_REQUIRED') {
        const reason=current.safety[choice].reason!;
        throw new AppError(reason==='TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR'
          ? 'L’autorité Twitch est active. Abandonner cette progression nécessite une résolution opérateur.'
          : 'Cette progression contient des données partagées ou une opération en cours. Une résolution opérateur est nécessaire.',409,reason);
      }
      const winner = choice === 'WEB' ? record.webPlayerId : record.twitchPlayerId;
      const loser = choice === 'WEB' ? record.twitchPlayerId : record.webPlayerId;
      // Never retire an operator or an owner still engaged in a live activity/transport.
      if (await tx.playerRoleAssignment.findFirst({ where: { playerId: loser, revokedAt: null, role: { in: ['ADMIN','MODERATOR'] } } })
        || await tx.twitchNativeAuthority.findFirst({ where: { operatorPlayerId: loser } })
        || await tx.playerExpedition.findFirst({ where: { playerId: loser, state: { not: 'IDLE' } } })
        || await tx.contestParticipant.findFirst({ where: { OR: [{ playerId: loser }, { originalPlayerId: loser }], contest: { status: { in: ['LOBBY','RUNNING'] } } } })
        || await tx.arcadeSession.findFirst({ where: { OR: [{ playerId: loser }, { opponentPlayerId: loser }], status: 'ACTIVE' } })
        || await tx.tradeRequest.findFirst({ where: { OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }], state: 'PENDING' } })
        || await tx.twitchGiftSupremeCredential.findUnique({ where: { playerId: loser } })
        || await tx.twitchGiveawayCredential.findUnique({ where: { playerId: loser } })) throw conflict();
      const native = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: record.twitchUserId } });
      const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
      if (native?.dataAuthority === 'MIGRATION_PENDING' || choice === 'WEB' && native && (native.playerId !== loser || control && control.desiredMode !== 'OFF')) throw conflict();
      if (choice === 'WEB') {
        await tx.twitchIdentity.update({ where: { twitchUserId: record.twitchUserId }, data: { playerId: winner, login: record.login, displayName: record.displayName } });
        if (native) await tx.twitchNativeTarget.update({ where: { twitchUserId: record.twitchUserId }, data: { playerId: winner } });
      } else {
        await tx.webIdentity.update({ where: { id: webIdentityId }, data: { playerId: winner } });
        await tx.twitchIdentity.update({ where: { twitchUserId: record.twitchUserId }, data: { login: record.login, displayName: record.displayName } });
      }
      await tx.player.update({ where: { id: loser }, data: { status: 'ARCHIVED' } });
      await tx.playerSession.deleteMany({ where: { playerId: { in: [winner, loser] } } });
      await tx.twitchLinkResolution.update({ where: { id: record.id }, data: { choice, completedAt: new Date() } });
      return { linked: true, playerId: winner, resolutionRequired: false };
    });
  }
}
