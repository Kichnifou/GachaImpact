import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { isPrismaConcurrencyCollision } from '../src/infrastructure/database/prisma-concurrency.js';

const failure = (message: string, code = 'P2028') => new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '7.10.0' });
describe('bounded retry classification', () => {
  it('allows retry only for a pool timeout proven to precede transaction start', () => {
    expect(isPrismaConcurrencyCollision(failure('Transaction API error: Unable to start a transaction in the given time.'))).toBe(true);
  });
  it.each(['Transaction already closed: A query cannot be executed on an expired transaction.', 'Transaction API error: Commit failed.', 'Transaction API error: Unknown result.'])('does not infer absence of committed effects from %s', message => {
    expect(isPrismaConcurrencyCollision(failure(message))).toBe(false);
  });
  it('preserves serialization/deadlock/unique handling and rejects unrelated errors', () => {
    expect(isPrismaConcurrencyCollision(failure('Serialization failure', 'P2034'))).toBe(true);
    expect(isPrismaConcurrencyCollision(failure('Unique constraint', 'P2002'))).toBe(true);
    expect(isPrismaConcurrencyCollision({ cause: { originalCode: '40P01' } })).toBe(true);
    expect(isPrismaConcurrencyCollision(failure('Connection failed', 'P1001'))).toBe(false);
    expect(isPrismaConcurrencyCollision(failure('Transaction already closed. Input: Unable to start a transaction in the given time.'))).toBe(false);
  });
});
