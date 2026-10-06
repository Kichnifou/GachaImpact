/** Pure projection shared by the standalone tracker and both command transports.
 * No clock, persistence, reward or eligibility is manufactured here. */
export function bossDailyState(boss: Readonly<{ attackState: 'AVAILABLE' | 'USED' | 'DEFEATED'; availableCharacters: readonly unknown[] }>) {
  return boss.attackState !== 'AVAILABLE' ? 'completed' : boss.availableCharacters.length < 4 ? 'ineligible' : 'available';
}
export function expeditionDailyState(expedition: Readonly<{
  operationalStatus: 'IDLE' | 'RUNNING' | 'READY'; startedOnCurrentBusinessDate: boolean;
  departureUsedToday: boolean; canStartToday: boolean;
}>) {
  if (expedition.operationalStatus === 'RUNNING') return expedition.startedOnCurrentBusinessDate ? 'completed' : 'in_progress';
  if (expedition.operationalStatus === 'READY') return 'available';
  return expedition.departureUsedToday ? 'completed' : expedition.canStartToday ? 'available' : 'ineligible';
}
type EventDailyView = Readonly<{
  canJoin: boolean; calendar?: { canClaimToday: boolean } | null; dailyBonus: { canClaim: boolean };
  participation: { joined: boolean }; gameA: { completedToday: boolean };
  gameB: { solvedToday: boolean; canAttempt: boolean }; gameC: { canSend: boolean; unviewedCount: number };
}>;
export type EventDailyDestination = { section: 'registration' } | { section: 'games'; game: 0 | 1 | 2 };
export function eventNextDailyDestination<T extends EventDailyView>(event: T): EventDailyDestination | null {
  if (event.canJoin || event.calendar?.canClaimToday || event.dailyBonus.canClaim) return { section: 'registration' };
  if (event.participation.joined && !event.gameA.completedToday) return { section: 'games', game: 0 };
  if (event.participation.joined && !event.gameB.solvedToday && event.gameB.canAttempt) return { section: 'games', game: 1 };
  if (event.gameC.canSend || event.gameC.unviewedCount > 0) return { section: 'games', game: 2 };
  return null;
}
export function eventHasActionableContentToday<T extends EventDailyView>(event: T): boolean {
  return eventNextDailyDestination(event) !== null;
}
