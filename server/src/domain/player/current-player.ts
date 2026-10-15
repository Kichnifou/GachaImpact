export type CurrentPlayerStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type CurrentPlayer = Readonly<{
  id: string;
  displayName: string;
  presentationName?: string | null;
  presentationNameRevision?: number;
  elementKey: string | null;
  status: CurrentPlayerStatus;
}>;
