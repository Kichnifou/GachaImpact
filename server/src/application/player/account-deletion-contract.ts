export type DeletionIdentity = { subject: string };
export type DeletionResult = { status: 'COMPLETED' | 'PENDING'; };
export interface AccountDeletion {
  execute(identity: DeletionIdentity, proof: { confirmation: 'SUPPRIMER'; reauthenticationToken: string }): Promise<DeletionResult>;
}
