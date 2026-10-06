import type pg from 'pg';
import type { Prisma } from '../generated/prisma/client.js';
import type { ExistingWebAccount } from '../src/application/migration/legacy-global-plan.js';

export type AccountProjection = {
  players: (ExistingWebAccount & { elementKey: string | null; hasWebAccount: boolean })[];
  identities: { playerId: string; twitchUserId: string; login: string; displayName: string | null }[];
  preferences: Prisma.PlayerPreferenceCreateManyInput[];
  privacy: Prisma.PrivacySettingCreateManyInput[];
  roles: Prisma.PlayerRoleAssignmentCreateManyInput[];
};

/** Explicit public reads only; never selects credentials, auth subjects, emails or sessions. */
export async function readLegacyAccountProjection(client: pg.Client): Promise<AccountProjection> {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const players = (await client.query<AccountProjection['players'][number]>(`SELECT p.id, p.display_name AS "displayName",
      p.element_key AS "elementKey", t.twitch_user_id AS "twitchUserId", (w.player_id IS NOT NULL) AS "hasWebAccount"
      FROM public.players p LEFT JOIN public.web_identities w ON w.player_id=p.id
      LEFT JOIN public.twitch_identities t ON t.player_id=p.id ORDER BY p.id`)).rows;
    const foundation = (await client.query<{ present: boolean }>(`SELECT to_regclass('public.twitch_native_targets') IS NOT NULL AS present`)).rows[0]!.present;
    if (foundation) {
      const resolutions = (await client.query<{ present: boolean }>(`SELECT to_regclass('public.twitch_link_resolutions') IS NOT NULL AS present`)).rows[0]!.present;
      const replacedNativeProof = resolutions ? ` OR EXISTS (SELECT 1 FROM public.twitch_link_resolutions resolution JOIN public.twitch_canary_imports imported ON imported.player_id=resolution.twitch_player_id AND imported.twitch_user_id=resolution.twitch_user_id AND imported.status='DATA_IMPORTED' WHERE resolution.web_player_id=target.player_id AND resolution.twitch_user_id=target.twitch_user_id AND resolution.choice='WEB' AND resolution.completed_at IS NOT NULL)` : '';
      const ownership = (await client.query<{ player_id: string; data_authority: string; imported: boolean }>(`SELECT target.player_id,target.data_authority,
        EXISTS (SELECT 1 FROM public.twitch_canary_imports imported WHERE imported.player_id=target.player_id AND imported.twitch_user_id=target.twitch_user_id AND imported.status='DATA_IMPORTED')${replacedNativeProof} imported
        FROM public.twitch_native_targets target WHERE target.player_id IS NOT NULL`)).rows;
      for (const player of players) { const own = ownership.find(row => row.player_id === player.id); player.dataAuthority = own?.data_authority ?? 'LEGACY'; player.canaryImported = own?.imported ?? false; }
    }
    const identities = (await client.query<AccountProjection['identities'][number]>(`SELECT player_id AS "playerId", twitch_user_id AS "twitchUserId", login,
      display_name AS "displayName" FROM public.twitch_identities ORDER BY player_id`)).rows;
    const preferences = (await client.query<AccountProjection['preferences'][number]>(`SELECT player_id AS "playerId", preference_key AS "preferenceKey", value
      FROM public.player_preferences ORDER BY player_id,preference_key`)).rows;
    const privacy = (await client.query<AccountProjection['privacy'][number]>(`SELECT player_id AS "playerId", category_key AS "categoryKey", level
      FROM public.privacy_settings ORDER BY player_id,category_key`)).rows;
    const roles = (await client.query<AccountProjection['roles'][number]>(`SELECT player_id AS "playerId", role, source, granted_at AS "grantedAt",
      granted_by_player_id AS "grantedByPlayerId", revoked_at AS "revokedAt"
      FROM public.player_role_assignments ORDER BY player_id,role`)).rows;
    await client.query('COMMIT');
    return { players, identities, preferences, privacy, roles };
  } catch { await client.query('ROLLBACK'); throw new Error('ACCOUNT_PROJECTION_READ_FAILED'); }
}

/** Copy only the reviewed projection to a guarded private schema; web auth subjects are synthetic. */
export async function seedLegacyAccountProjection(db: Prisma.TransactionClient, schema: string, accounts: AccountProjection) {
  if (!/^batch_test_[0-9a-f]{32}$/.test(schema) ||
      (await db.$queryRawUnsafe<{ current_schema: string }[]>('SELECT current_schema()'))[0]?.current_schema !== schema)
    throw new Error('ACCOUNT_PROJECTION_REQUIRES_PRIVATE_SCHEMA');
  await db.player.createMany({ data: accounts.players.map(row => ({ id: row.id, displayName: row.displayName, elementKey: row.elementKey })) });
  await db.webIdentity.createMany({ data: accounts.players.filter(row => row.hasWebAccount).map(row => ({ playerId: row.id, provider: 'fixture', providerSubject: row.id })) });
  await db.twitchIdentity.createMany({ data: accounts.identities });
  await db.playerPreference.createMany({ data: accounts.preferences });
  await db.privacySetting.createMany({ data: accounts.privacy });
  await db.playerRoleAssignment.createMany({ data: accounts.roles });
  for (const row of accounts.players.filter(row => row.dataAuthority === 'NATIVE' && row.twitchUserId)) {
    await db.twitchNativeTarget.create({ data: { twitchUserId: row.twitchUserId!, playerId: row.id, dataAuthority: 'NATIVE',
      acknowledgement: 'STREAMERBOT_PATH_DISABLED', transferredAt: new Date() } });
    if (row.canaryImported) await db.twitchCanaryImport.create({ data: { twitchUserId: row.twitchUserId!, playerId: row.id,
      snapshotHash: '0'.repeat(64), identityReportHash: '0'.repeat(64), backupHash: '0'.repeat(64) } });
  }
}

export async function assertLegacyAccountPreservation(db: Prisma.TransactionClient, accounts: AccountProjection, importedPlayerIds: readonly string[] = []) {
  for (const row of accounts.players) {
    const retained = await db.player.findUniqueOrThrow({ where: { id: row.id }, select: { displayName: true, webIdentity: { select: { playerId: true } } } });
    if (retained.displayName !== row.displayName || Boolean(retained.webIdentity) !== row.hasWebAccount) throw new Error('PRIVATE_ACCOUNT_PRESERVATION_FAILED');
  }
  for (const row of accounts.identities) {
    if ((await db.twitchIdentity.findUniqueOrThrow({ where: { playerId: row.playerId }, select: { twitchUserId: true } })).twitchUserId !== row.twitchUserId)
      throw new Error('PRIVATE_IDENTITY_PRESERVATION_FAILED');
  }
  for (const row of accounts.preferences) {
    // The existing migration contract replaces gameplay Box sorting for imported Players only.
    if (row.preferenceKey === 'box.sort' && importedPlayerIds.includes(row.playerId)) continue;
    const retained = await db.playerPreference.findUniqueOrThrow({ where: { playerId_preferenceKey: { playerId: row.playerId, preferenceKey: row.preferenceKey } } });
    if (JSON.stringify(retained.value) !== JSON.stringify(row.value)) throw new Error('PRIVATE_PREFERENCE_PRESERVATION_FAILED');
  }
  for (const row of accounts.privacy) {
    const retained = await db.privacySetting.findUniqueOrThrow({ where: { playerId_categoryKey: { playerId: row.playerId, categoryKey: row.categoryKey } } });
    if (retained.level !== row.level) throw new Error('PRIVATE_PRIVACY_PRESERVATION_FAILED');
  }
  const preservedIds = accounts.players.map(player => player.id);
  if (await db.playerPreference.count({ where: { preferenceKey: { not: 'box.sort' } } }) !== accounts.preferences.filter(row => row.preferenceKey !== 'box.sort').length || await db.privacySetting.count({ where: { playerId: { in: preservedIds } } }) !== accounts.privacy.length ||
      await db.playerRoleAssignment.count() !== accounts.roles.length) throw new Error('PRIVATE_PRESERVATION_COUNTS_FAILED');
  for (const row of accounts.roles) {
    if (!await db.playerRoleAssignment.findFirst({ where: { playerId: row.playerId, role: row.role, source: row.source,
      grantedAt: row.grantedAt, grantedByPlayerId: row.grantedByPlayerId ?? null, revokedAt: row.revokedAt ?? null } }))
      throw new Error('PRIVATE_ROLE_PRESERVATION_FAILED');
  }
}
