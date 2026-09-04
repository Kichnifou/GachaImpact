export type CurrentPlayerStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type CurrentPlayer = Readonly<{
  id: string;
  displayName: string;
  elementKey: string | null;
  status: CurrentPlayerStatus;
}>;
