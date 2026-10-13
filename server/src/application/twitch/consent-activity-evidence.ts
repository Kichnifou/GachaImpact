type Tables = Record<string, string[]>;
const columns = ['last_app_activity_at', 'last_gameplay_activity_at', 'last_internal_chat_at', 'last_twitch_activity_at', 'player_id', 'updated_at'];
const significant = ['last_gameplay_activity_at', 'last_internal_chat_at', 'last_twitch_activity_at'] as const;
// Compare PostgreSQL UTC timestamps without losing their microseconds. Unknown
// shapes/timestamps are retained verbatim, never granted a technical exception.
function timestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:\+00:00|Z)$/.exec(value);
  return match && Number.isFinite(Date.parse(value)) ? `${match[1]}.${(match[2] ?? '').padEnd(6, '0')}` : null;
}
function activityConsentRow(raw: string): string | null {
  const row = JSON.parse(raw) as Record<string, unknown>;
  if (Object.keys(row).sort().join() !== columns.join() || typeof row.player_id !== 'string') return raw;
  const dates = [row.last_app_activity_at, ...significant.map(key => row[key])];
  if (dates.some(value => value !== null && timestamp(value) === null)) return raw;
  const recorded = dates.map(timestamp).filter((value): value is string => value !== null).sort();
  // updated_at is redundant only when it follows the recorder's exact GREATEST
  // invariant. An unexplained timestamp-only change remains significant.
  if (!recorded.length || timestamp(row.updated_at) !== recorded.at(-1)) return raw;
  if (significant.every(key => row[key] === null)) return null;
  return JSON.stringify({ player_id: row.player_id, ...Object.fromEntries(significant.map(key => [key, row[key]])) });
}
/** Consent projection only. The captured graph and backup are never modified. */
export function consentTables(tables: Tables): Tables {
  if (Object.hasOwn(tables, 'player_daily_activity')) {
    const projected = tables.player_daily_activity!.map(dailyConsentRow).filter((row): row is string => row !== null).sort();
    const { player_daily_activity: _daily, ...rest } = tables;
    tables = projected.length ? { ...rest, player_daily_activity: projected } : rest;
  }
  if (!Object.hasOwn(tables, 'player_activity_state')) return tables;
  const rows = tables.player_activity_state!.map(activityConsentRow).filter((row): row is string => row !== null).sort();
  const { player_activity_state: _raw, ...rest } = tables;
  return rows.length ? { ...rest, player_activity_state: rows } : rest;
}
export function consentClassifications<T extends { edge: string; classification: string }>(rows: T[], tables: Tables): T[] {
  const daily = tables.player_daily_activity;
  if (daily?.length && daily.every(row => dailyConsentRow(row) === null)) {
    rows = rows.filter(row => row.edge !== 'player_daily_activity(player_id)->players(id)' || row.classification !== 'OWNED_PERSONAL');
  }
  const activity = tables.player_activity_state;
  if (!activity?.length || activity.some(row => activityConsentRow(row) !== null)) return rows;
  // Only this known personal edge's technical row count is neutralized. Safety
  // classifications themselves, unknown edges and shared relations stay exact.
  return rows.filter(row => row.edge !== 'player_activity_state(player_id)->players(id)' || row.classification !== 'OWNED_PERSONAL');
}

/** Exact additive model only: unknown fields and non-application witnesses remain significant. */
function dailyConsentRow(raw: string): string | null {
  const row = JSON.parse(raw) as Record<string, unknown>;
  if (Object.keys(row).sort().join() !== 'application,business_date,gameplay,internal_chat,player_id,twitch'
    || typeof row.player_id !== 'string' || typeof row.business_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.business_date)
    || ['application', 'gameplay', 'internal_chat', 'twitch'].some(key => typeof row[key] !== 'boolean')) return raw;
  if (row.application === true && row.gameplay === false && row.internal_chat === false && row.twitch === false) return null;
  if (!row.gameplay && !row.internal_chat && !row.twitch) return raw;
  return JSON.stringify({ business_date: row.business_date, player_id: row.player_id, gameplay: row.gameplay, internal_chat: row.internal_chat, twitch: row.twitch });
}
export function operatorConsentEvidence<T extends { web: { tables: Tables; shared: Tables; parents: Tables }; twitch: { tables: Tables; shared: Tables; parents: Tables } }>(evidence: T) {
  const graph = (value: T['web']) => ({ ...value, tables: consentTables(value.tables), shared: consentTables(value.shared), parents: consentTables(value.parents) });
  return { ...evidence, web: graph(evidence.web), twitch: graph(evidence.twitch) };
}
