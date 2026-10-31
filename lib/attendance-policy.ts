/** A portal click is not Google Meet attendance verification. */
export const JOIN_EARLY_MINUTES = 15;
export function joinWindow(startsAt: string, endsAt: string, now: number) {
  return now >= +new Date(startsAt) - JOIN_EARLY_MINUTES * 60000 && now < +new Date(endsAt);
}
