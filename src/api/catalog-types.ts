export type CatalogEvidence = Readonly<{ value: string | number; provider: string; url: string; fetchedAt: string; reliability: string; override?: boolean; conflict?: boolean }>
export type CatalogAsset = Readonly<{ id: string; role: 'icon' | 'splash' | 'wish' | 'fullbody' | 'promotion'; status: string; sourceUrl: string | null;
  url: string | null; hash: string; mime: string | null; width: number | null; height: number | null; bytes: number | null; provider: string }>
export type CatalogAttempt = Readonly<{ id: string; provider: string; field: string; outcome: string; errorCode: string | null; sourceUrl: string | null; httpStatus: number | null; checkedAt: string; nextCheckAt: string | null }>
export type CatalogCandidate = Readonly<{ id: string; characterId: string | null; name: string; status: string; fields: Readonly<Record<string, CatalogEvidence>>;
  missing: readonly string[]; assets: readonly CatalogAsset[]; discoveredAt: string; checkedAt: string | null; nextCheckAt: string; publishedAt: string | null;
  officialReleaseDate: string | null; revision: number; identities: readonly { namespace: string; externalId: string }[]; attempts?: readonly CatalogAttempt[];
  character?: Readonly<{ iconPath: string | null; splashPath: string | null; wishPath: string | null; fullbodyPath: string | null }> | null }>
export type CatalogOverview = Readonly<{ entries: readonly CatalogCandidate[]; runs: readonly { id: string; status: string; startedAt: string; completedAt: string | null }[];
  job: { lastSuccessAt: string | null; lastSuccessDate: string | null; leaseUntil: string | null } | null;
  enabled: boolean; dryRun: boolean; publicationEnabled: boolean; storageConfigured: boolean }>
