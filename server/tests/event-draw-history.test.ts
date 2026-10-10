import { expect, it } from 'vitest';
import { publicEventDraw } from '../src/application/history/history-service.js';

it.each(['PENDING', 'FROZEN', 'NO_ELIGIBLE'])('does not project a winner or private facts for %s', status => {
  expect(publicEventDraw({ status, winner: { status: 'ACTIVE' }, operation: { resultSummary: { winnerName: 'Hidden', entropy: 'private' } } })).toEqual({ status, winnerName: null, reward: null });
});
it('projects only the sealed winner snapshot, independently of ranking and current name', () => {
  expect(publicEventDraw({ status: 'COMPLETED', winner: { status: 'ACTIVE' }, operation: { resultSummary: { winnerName: 'Not rank one', ticketIndex: '999', totalTickets: '1000', operationId: 'private' } } })).toEqual({ status: 'COMPLETED', winnerName: 'Not rank one', reward: { itemKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', amount: 1 } });
  expect(publicEventDraw({ status: 'COMPLETED', winner: { status: 'ARCHIVED' }, operation: { resultSummary: { winnerName: 'Old player' } } }).winnerName).toBe('Progression archivée');
});
it('never invents a historical winner', () => expect(publicEventDraw(null)).toEqual({ status: 'NOT_RECORDED', winnerName: null, reward: null }));
