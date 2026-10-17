/** Month/day only; 2000 is a leap year, so February 29 is valid. */
export function validBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(2000, month, 0)).getUTCDate();
}
export function birthdayDate(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(Math.min(day, last)).padStart(2, '0');
}
export function lastDueBirthdayYear(today: string, month: number, day: number): number {
  const year = Number(today.slice(0, 4));
  return birthdayDate(year, month, day) <= today ? year : year - 1;
}
