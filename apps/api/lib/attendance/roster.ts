/** Position of a date inside a roster cycle; indexes at or above onDays are rest days. */
export function rosterCycleIndex(date: string, effectiveFrom: string, onDays: number, offDays: number) {
  const start = new Date(`${effectiveFrom}T00:00:00`);
  const current = new Date(`${date}T00:00:00`);
  const elapsed = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000));
  const cycleLength = Math.max(1, onDays + offDays);
  return elapsed % cycleLength;
}
