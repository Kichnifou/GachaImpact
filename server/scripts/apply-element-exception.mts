import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { checkedIdentityFile, readLocalIdentityJson, identityReportDirectory } from '../src/application/migration/local-identity-file.js';
import { encryptPrivateBackup } from '../src/application/migration/private-offline-backup.js';
import { captureTargetedPlayerRows, type RowGraph } from '../src/application/migration/targeted-player-rows.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';
import { applyElementException } from '../src/application/maintenance/element-exception.js';
import { stableElementExceptionProof } from '../src/application/maintenance/element-exception-proof.js';

const scopeSchema = z.object({ playerId: z.uuid(), actorPlayerId: z.uuid(), twitchUserId: z.string().regex(/^\d+$/), login: z.string().regex(/^[a-z0-9_]{1,25}$/) }).strict();
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args[0] !== '--scope' || args[2] !== '--sha' || args[4] !== '--apply' || !/^[0-9a-f]{40}$/.test(args[3]!)) throw new Error('ARGUMENTS');
  const git = (...values: string[]) => execFileSync('git', values, { encoding: 'utf8', windowsHide: true }).trim();
  const sha = args[3]!;
  if (git('rev-parse', 'HEAD') !== sha || git('status', '--porcelain') || git('ls-remote', 'origin', 'refs/heads/review').split(/\s/)[0] !== sha) throw new Error('REVIEWED_SHA_REQUIRED');
  const scope = scopeSchema.parse(await readLocalIdentityJson(args[1]!));
  const clientId = process.env['TWITCH_CLIENT_ID'], clientSecret = process.env['TWITCH_CLIENT_SECRET'];
  if (!clientId || !clientSecret || !process.env['DATABASE_URL']) throw new Error('CONFIGURATION');
  const token = await new TwitchAppAccessTokenProvider(clientId, clientSecret).getToken();
  const response = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(scope.login)}`, {
    headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('OFFICIAL_IDENTITY_UNAVAILABLE');
  const official = z.object({ data: z.array(z.object({ id: z.string(), login: z.string() })).length(1) }).parse(await response.json()).data[0]!;
  if (official.id !== scope.twitchUserId || official.login !== scope.login) throw new Error('OFFICIAL_IDENTITY_MISMATCH');
  const output = await checkedIdentityFile(join(identityReportDirectory(), `element-exception-${randomUUID()}.json`), true);
  const persist = async (name: string, value: unknown) => {
    const destination = name === 'result' ? output : await checkedIdentityFile(output.replace('.json', `-${name}-${randomUUID()}.json`), true);
    await writeFile(destination, await encryptPrivateBackup(Buffer.from(JSON.stringify(value))), { flag: 'wx', mode: 0o600 });
  };
  // Initialize DPAPI and durable private evidence before opening the transaction.
  await persist('identity', { sha, scope, official, checkedAt: new Date().toISOString() });
  const db = createDatabase(process.env['DATABASE_URL']);
  try {
    if ((await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema !== 'public') throw new Error('PUBLIC_SCHEMA_REQUIRED');
    let before: RowGraph | undefined, operationId: string | undefined;
    const result = await applyElementException(db, scope, undefined, async tx => {
      if (!before || !operationId) throw new Error('PREIMAGE_REQUIRED');
      const after = await captureTargetedPlayerRows(tx, before.playerIds);
      if (JSON.stringify(stableElementExceptionProof(before, scope.playerId, operationId)) !== JSON.stringify(stableElementExceptionProof(after, scope.playerId, operationId))) throw new Error('UNRELATED_STATE_CHANGED');
      await persist('verified', { sha, scope, beforeHash: before.hash, afterHash: after.hash, unrelatedStateIntact: true });
    }, async (tx, ids, op) => {
      operationId = op; before = await captureTargetedPlayerRows(tx, ids);
      await persist('preimage', { sha, operationId, before });
    });
    const player = await db.player.findUniqueOrThrow({ where: { id: scope.playerId }, select: { elementKey: true } });
    const audit = await db.adminAuditEntry.findUniqueOrThrow({ where: { operationId: result.operationId } });
    const movements = await db.resourceMovement.findMany({ where: { operationId: result.operationId }, orderBy: { resourceKey: 'asc' } });
    const movementCount = movements.length;
    const stored = await db.businessOperation.findUniqueOrThrow({ where: { id: result.operationId } });
    // Post-commit durable proofs. Current totals may normally evolve during play;
    // exact swap is established by the committed audit + two movement preimages.
    if (player.elementKey !== 'electro' || stored.status !== 'COMPLETED' || movementCount !== 2 || audit.targetPlayerId !== scope.playerId) throw new Error('POSTFLIGHT_FAILED');
    for (const [resourceKey, before, after] of [['particles_cryo', result.cryo, result.electro], ['particles_electro', result.electro, result.cryo]] as const) {
      const movement = movements.find(m => m.resourceKey === resourceKey);
      if (!movement || movement.playerId !== scope.playerId || movement.balanceBefore !== BigInt(before) || movement.balanceAfter !== BigInt(after) || movement.delta !== BigInt(after) - BigInt(before)) throw new Error('EXACT_SWAP_POSTFLIGHT_FAILED');
    }
    await persist('result', { sha, result, checkedAt: new Date().toISOString(), elementKey: player.elementKey, audit, movementCount, productionCommitted: true });
    console.log(JSON.stringify({ productionCommitted: true, sentClosed: result.sentClosed, receivedClosed: result.receivedClosed, elementKey: 'electro', exactSwapAudited: true, unrelatedStateIntact: true, alreadyProcessed: result.alreadyProcessed, privateEvidenceSaved: true }));
  } finally { await db.$disconnect(); }
}
main().catch(async (error: unknown) => {
  try {
    const file = await checkedIdentityFile(join(identityReportDirectory(), `element-exception-failure-${randomUUID()}.json`), true);
    const detail = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack, code: 'code' in error ? error.code : null } : { name: 'UnknownFailure' };
    await writeFile(file, await encryptPrivateBackup(Buffer.from(JSON.stringify({ at: new Date().toISOString(), detail }))), { flag: 'wx', mode: 0o600 });
  } catch { /* Never disclose private database errors if local evidence fails. */ }
  console.error('ELEMENT_EXCEPTION_FAILED_CLOSED_OR_POSTFLIGHT_INCOMPLETE: inspect private receipts before retrying the identical scope/key.'); process.exitCode = 1;
});
