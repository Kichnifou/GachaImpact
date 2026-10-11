export type CatalogEvidence = Readonly<{ value: string | number; provider: string; url: string; fetchedAt: string; reliability: string; override?: boolean; conflict?: boolean;
  editorialStatus?: string; locked?: boolean; adminValidated?: boolean; reason?: string; alternatives?: readonly CatalogEvidence[] }>
export type CatalogAsset = Readonly<{ id: string; role: 'icon' | 'splash' | 'wish' | 'fullbody' | 'promotion'; status: string; sourceUrl: string | null;
  url: string | null; hash: string; mime: string | null; width: number | null; height: number | null; bytes: number | null; provider: string;
  editorialStatus?: string; autoLocked?: boolean; officialConfirmed?: boolean; adminValidated?: boolean; checkedAt?:string }>
export type CatalogAttempt = Readonly<{ id: string; provider: string; field: string; outcome: string; errorCode: string | null; sourceUrl: string | null; httpStatus: number | null; checkedAt: string; nextCheckAt: string | null }>
export type CatalogCandidate = Readonly<{ id: string; characterId: string | null; name: string; status: string; fields: Readonly<Record<string, CatalogEvidence>>;
  missing: readonly string[]; assets: readonly CatalogAsset[]; discoveredAt: string; checkedAt: string | null; nextCheckAt: string; publishedAt: string | null;
  officialReleaseDate: string | null; revision: number; identities: readonly { namespace: string; externalId: string }[]; attempts?: readonly CatalogAttempt[];
  trackingState?: string; trackingElements?: readonly string[]; trackingReason?: string | null; releaseFollowupAuthorized?: boolean;
  character?: Readonly<{ iconPath: string | null; splashPath: string | null; wishPath: string | null; fullbodyPath: string | null }> | null }>
export type CatalogOverview = Readonly<{ entries: readonly CatalogCandidate[]; runs: readonly { id: string; status: string; startedAt: string; completedAt: string | null; summary?: {changed?: number; processed?: number; remaining?: number; mode?: string; errorCode?: string}; nextAttemptAt?: string }[];
  page?:number;totalPages?:number;total?:number;activeRun?:Readonly<{id:string;status:string;cancelRequestedAt?:string|null;summary?:{mode?:string}}>|null;
  job: { lastSuccessAt: string | null; lastSuccessDate: string | null; leaseUntil: string | null } | null;
  enabled: boolean; dryRun: boolean; publicationEnabled: boolean; storageConfigured: boolean }>
