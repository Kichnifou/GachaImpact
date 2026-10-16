import { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { captureTargetedPlayerRows, deleteTargetedRows, targetedRowMetadata, rowGraphIdentifier as q } from '../migration/targeted-player-rows.js';
import { operationForeignKeySignature } from '../migration/operation-retention-contract.js';
import { deletionForeignKeys, deletionJsonColumns, deletionOwnedTables } from './account-deletion-schema.js';
import { scrubAccountDetail, type ErasureContext } from './account-deletion-scrub.js';
import { createHash } from 'node:crypto';
import { erasureDigest } from './account-erasure-markers.js';
import { normalizeLegacyName } from '../migration/streamerbot-snapshot.js';

type Tx = Prisma.TransactionClient;
// Independently reviewed producers contain catalog definitions, aggregates or opaque
// retention cursors, never player aliases or authored content (opaque UUIDs remain).
const nonPersonalJsonTables = new Set(['cosmetic_definitions','item_definitions','characters','banner_rotations',
  'event_definitions','event_editions','shop_item_definitions','catalog_candidates','catalog_runs','catalog_import_outbox',
  'retention_job','retention_runs','retention_progress']);
export async function checkErasureSchema(tx: Tx) {
  const metadata = await targetedRowMetadata(tx);
  const actual = metadata.fks.map(operationForeignKeySignature).sort();
  if (JSON.stringify(actual) !== JSON.stringify(deletionForeignKeys)) throw new Error('ACCOUNT_ERASURE_FK_UNCLASSIFIED');
  const json = await tx.$queryRaw<{ table: string; column: string }[]>`SELECT table_name AS "table",column_name AS "column" FROM information_schema.columns
    WHERE table_schema=current_schema() AND data_type IN ('json','jsonb') ORDER BY table_name,column_name`;
  const expected = [...deletionJsonColumns].sort((a,b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column));
  if (JSON.stringify(json) !== JSON.stringify(expected)) throw new Error('ACCOUNT_ERASURE_JSON_UNCLASSIFIED');
  return metadata;
}

export async function assertErasureResponsibilities(tx: Tx, playerId: string) {
  const blocked = (message: string) => { throw new AppError(message, 409, 'ACCOUNT_DELETION_RESPONSIBILITY'); };
  if (await tx.playerRoleAssignment.findFirst({ where: { playerId, role: 'ADMIN', revokedAt: null } }))
    blocked('Transfère tes responsabilités d’administration avant de supprimer ton compte.');
  if (await tx.twitchNativeAuthority.findFirst({ where: { operatorPlayerId: playerId, desiredMode: { not: 'OFF' } } })
    || await tx.twitchGiftSupremeCredential.findUnique({ where: { playerId } }) || await tx.twitchGiveawayCredential.findUnique({ where: { playerId } }))
    blocked('Une autorisation Twitch utilisée par le service doit être transférée ou révoquée avant la suppression.');
  if (await tx.businessOperation.findFirst({ where: { playerId, status: { notIn: ['COMPLETED','FAILED'] } } }))
    blocked('Une opération de jeu est encore en cours. Réessaie après sa fin.');
  const rows = await tx.$queryRaw<{ blocked: boolean }[]>`SELECT
    EXISTS(SELECT 1 FROM trade_requests WHERE (sender_player_id=${playerId}::uuid OR recipient_player_id=${playerId}::uuid) AND state::text='PENDING')
    OR EXISTS(SELECT 1 FROM arcade_sessions WHERE (player_id=${playerId}::uuid OR opponent_player_id=${playerId}::uuid) AND status='ACTIVE')
    OR EXISTS(SELECT 1 FROM arcade_invitations WHERE (host_player_id=${playerId}::uuid OR guest_player_id=${playerId}::uuid) AND status='PENDING')
    OR EXISTS(SELECT 1 FROM contests c LEFT JOIN contest_participants p ON p.contest_id=c.id WHERE c.status::text IN ('LOBBY','RUNNING')
      AND (c.organizer_player_id=${playerId}::uuid OR c.selected_spectator_player_id=${playerId}::uuid OR p.player_id=${playerId}::uuid OR p.original_player_id=${playerId}::uuid))
    OR EXISTS(SELECT 1 FROM event_monthly_draws d WHERE d.status='FROZEN'
      AND d.population @> jsonb_build_array(jsonb_build_object('playerId',${playerId}::text)))
    OR EXISTS(SELECT 1 FROM giveaway_sessions WHERE (winner_player_id=${playerId}::uuid OR previous_winner_player_id=${playerId}::uuid
      OR opened_by_player_id=${playerId}::uuid OR closed_by_player_id=${playerId}::uuid) AND status NOT IN ('CLOSED','CANCELLED','COMPLETED')) AS blocked`;
  if (rows[0]?.blocked) blocked('Termine d’abord les sessions, échanges ou opérations partagées en cours.');
}

/** One transaction; explicit ownership closure refuses unexpected children instead of cascading.
 * Stable neutral Player anchors only indispensable peer history, never an account or recoverable identity.
 */
export async function erasePlayerData(tx: Tx, playerId: string, subject: string, historicalTwitchIds: string[]=[], markerKey?:string, history?:{aliases:string[];logins:string[]}) {
  const { fks } = await checkErasureSchema(tx);
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, include: { twitchIdentity: true } });
  const messages = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM global_chat_messages WHERE author_player_id=${playerId}::uuid
    UNION SELECT id FROM direct_messages WHERE author_player_id=${playerId}::uuid`;
  const names = [player.displayName, player.presentationName, player.legacyUsername, player.twitchIdentity?.login, player.twitchIdentity?.displayName,...(history?.aliases??[])].filter((x):x is string=>Boolean(x));
  const twitchIds=[...new Set([...historicalTwitchIds,...(player.twitchIdentity?[player.twitchIdentity.twitchUserId]:[])])];
  const context: ErasureContext = { playerId, externalIds: new Set([subject, ...twitchIds]),
    legacyNames:new Set([player.legacyUsername,player.twitchIdentity?.login,...(history?.logins??[])].filter((x):x is string=>Boolean(x)).map(x=>x.toLowerCase())),
    names: new Set(names.map(x=>x.toLowerCase())), authoredMessageIds: new Set(messages.map(x=>x.id)) };
  // Deterministic source hashes can reveal old names by dictionary lookup.
  // Delete the fact, preserve peer relation values, and block old-source recreation.
  const sourceKeys=[...(context.legacyNames??[])].map(name=>createHash('sha256').update(JSON.stringify(['legacy-friendship-identity-v1',normalizeLegacyName(name)])).digest('hex'));
  const facts=await tx.legacyFriendshipFact.findMany({where:{OR:[{leftTwitchUserId:{in:twitchIds}},{rightTwitchUserId:{in:twitchIds}},
    {leftSourceKeyHash:{in:sourceKeys}},{rightSourceKeyHash:{in:sourceKeys}}]}});
  context.proofs=new Set([...sourceKeys,...facts.flatMap(f=>[f.id,f.sourcePairKeyHash,f.sourceFingerprint,
    ...(twitchIds.includes(f.leftTwitchUserId??'')?[f.leftSourceKeyHash]:[]),...(twitchIds.includes(f.rightTwitchUserId??'')?[f.rightSourceKeyHash]:[])])]);
  for(const fact of facts){
    const digest=erasureDigest('FRIENDSHIP_SOURCE',fact.sourcePairKeyHash,markerKey);
    await tx.accountErasureMarker.upsert({where:{kind_digest:{kind:'FRIENDSHIP_SOURCE',digest}},create:{kind:'FRIENDSHIP_SOURCE',digest},update:{}});
    await tx.$queryRaw`SELECT set_config('app.account_deletion_friendship_fact',${fact.id},true)`;
    await tx.$executeRaw`UPDATE friendships SET legacy_fact_id=NULL,legacy_left_player_id=NULL WHERE legacy_fact_id=${fact.id}::uuid`;
    await tx.$queryRaw`SELECT set_config('app.account_deletion_friendship_fact','',true)`;
    await tx.legacyFriendshipFact.delete({where:{id:fact.id}});
  }
  if(player.legacyUsername)await tx.$executeRaw`UPDATE migration_issues SET legacy_key=NULL,path=NULL,
    description='Référence personnelle supprimée',resolution=NULL
    WHERE player_id IS NULL AND lower(trim(legacy_key))=${player.legacyUsername.trim().toLowerCase()}`;

  // Remove authored content even when it contains no name or identifier. Preserve peer messages/reply anchors.
  await tx.$executeRaw`UPDATE global_chat_messages SET content='[Contenu supprimé]',result_presentation=NULL,external_message_id=NULL
    WHERE author_player_id=${playerId}::uuid`;
  await tx.$executeRaw`UPDATE direct_messages SET content=NULL,deleted_at=COALESCE(deleted_at,now()),content_purged_at=now(),restored_at=NULL
    WHERE author_player_id=${playerId}::uuid`;
  await tx.$executeRaw`UPDATE event_social_messages SET content='[Contenu supprimé]' WHERE sender_player_id=${playerId}::uuid`;
  await tx.$executeRaw`DELETE FROM global_chat_mentions WHERE message_id IN (SELECT id FROM global_chat_messages WHERE author_player_id=${playerId}::uuid)`;
  await tx.$executeRaw`UPDATE friendships SET state='ARCHIVED',archived_at=COALESCE(archived_at,now()),legacy_left_player_id=NULL,legacy_fact_id=NULL
    WHERE player_a_id=${playerId}::uuid OR player_b_id=${playerId}::uuid OR legacy_left_player_id=${playerId}::uuid`;
  await tx.$executeRaw`UPDATE player_role_assignments SET granted_by_player_id=NULL WHERE granted_by_player_id=${playerId}::uuid`;
  await tx.$executeRaw`UPDATE gift_codes SET created_by_id=CASE WHEN created_by_id=${playerId}::uuid THEN NULL ELSE created_by_id END,
    updated_by_id=CASE WHEN updated_by_id=${playerId}::uuid THEN NULL ELSE updated_by_id END WHERE created_by_id=${playerId}::uuid OR updated_by_id=${playerId}::uuid`;
  await tx.$executeRaw`UPDATE twitch_native_authorities SET operator_player_id=NULL,acknowledgement=NULL,acknowledged_at=NULL
    WHERE operator_player_id=${playerId}::uuid AND desired_mode='OFF'`;
  await tx.$executeRaw`UPDATE twitch_native_audit SET twitch_user_id=NULL,acknowledgement=NULL WHERE actor_player_id=${playerId}::uuid`;
  await tx.$executeRaw`UPDATE contest_participants SET player_name_snapshot='Compte supprimé',avatar_snapshot=NULL
    WHERE player_id=${playerId}::uuid OR original_player_id=${playerId}::uuid`;
  // WISH and ranking name ordinary participants, including non-winners. These
  // generated templates contain player labels and counts, never Character data.
  const announcementNames=names.map(name=>'%'+name.replace(/[\\%_]/g,'\\$&')+'%');
  const announcements=await tx.$queryRaw<{id:string;text:string;full_text:string|null}[]>`SELECT id,text,full_text FROM giveaway_announcements
    WHERE text ILIKE ANY(${announcementNames}::text[]) OR full_text ILIKE ANY(${announcementNames}::text[]) FOR UPDATE`;
  for(const announcement of announcements)await tx.$executeRaw`UPDATE giveaway_announcements SET
    text=${scrubAccountDetail(announcement.text,context,false,'text') as string},
    full_text=${scrubAccountDetail(announcement.full_text,context,false,'text') as string|null} WHERE id=${announcement.id}::uuid`;

  // BusinessOperation remains only where a shared proof may need its FK. No command input/output or identity retained.
  await tx.$executeRaw`UPDATE business_operations SET result_summary='{"accountDeleted":true}'::jsonb,idempotency_key=NULL
    WHERE player_id=${playerId}::uuid`;

  const graph = await captureTargetedPlayerRows(tx, [playerId], deletionOwnedTables);
  const ownedIds = Object.values(graph.tables).flat().flatMap(row=>{const r=JSON.parse(row) as {id?:string};return r.id?[r.id]:[];});
  await tx.$executeRaw`DELETE FROM migration_mappings WHERE target_id=ANY(${ownedIds}::uuid[]) OR target_id=${playerId}::uuid`;
  for (const twitchId of twitchIds) {
    // Old aliases/snapshots are not a second source of identity after erasure.
    await tx.$executeRaw`DELETE FROM migration_mappings WHERE twitch_user_id=${twitchId}`;
    await tx.$executeRaw`DELETE FROM external_banner_votes WHERE twitch_user_id=${twitchId}`;
    await tx.$executeRaw`UPDATE twitch_event_receipts SET twitch_user_id=NULL,external_reference=NULL,payload_hash=NULL,error_message=NULL,
      payload_minimal=NULL WHERE twitch_user_id=${twitchId}`;
  }
  await deleteTargetedRows(tx, graph, new Set(deletionOwnedTables));

  // Inspect decoded historical copies, including JSON not attached by FK to the deleted Player.
  const needles = [playerId, subject, ...twitchIds, ...names,...context.proofs].map(x=>'%'+x.replace(/[\\%_]/g,'\\$&')+'%');
  for (const { table, column } of deletionJsonColumns) {
    if (table==='players' || nonPersonalJsonTables.has(table)) continue;
    const rows = await tx.$queryRawUnsafe<{ key:string; row:Prisma.JsonObject }[]>(`SELECT ctid::text key,to_jsonb(t) row FROM ${q(table)} t
      WHERE ${q(column)}::text ILIKE ANY($1::text[]) OR ${q(column)}::text LIKE '%brotli-base64%' OR ${q(column)}::text LIKE '%lossless-brotli-v1%' FOR UPDATE`,needles);
    for (const { key, row } of rows) {
      const own = fks.filter(fk=>fk.child===table&&fk.parent==='players').some(fk=>row[fk.child_columns[0]!]===playerId);
      const before=row[column]??null,after=scrubAccountDetail(before,context,own);
      if (JSON.stringify(before)!==JSON.stringify(after)) {
        await tx.$queryRaw`SELECT set_config('app.account_deletion_scrub_column',${column},true)`;
        await tx.$executeRawUnsafe(`UPDATE ${q(table)} SET ${q(column)}=$1::jsonb WHERE ctid=$2::tid`,JSON.stringify(after),key);
        await tx.$queryRaw`SELECT set_config('app.account_deletion_scrub_column','',true)`;
      }
    }
  }
  await tx.player.update({ where:{id:playerId},data:{displayName:'Compte supprimé',presentationName:null,presentationNameRevision:0,
    legacyUsername:null,legacyRecovery:Prisma.DbNull,migrationRunId:null,elementKey:null,equippedAvatarCosmeticId:null,equippedTitleCosmeticId:null,equippedBadgeCosmeticId:null} });
  await tx.$executeRaw`UPDATE business_operations SET player_id=NULL WHERE player_id=${playerId}::uuid`;
  const after = await captureTargetedPlayerRows(tx,[playerId],deletionOwnedTables);
  if (Object.entries(after.tables).some(([table,rows])=>table!=='players'&&rows.length)) throw new Error('ACCOUNT_ERASURE_OWNED_ROWS_REMAIN');
}
