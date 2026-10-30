/**
 * Anti-skip interval merging and calculation utilities
 */

export type Interval = [number, number];

/**
 * Merges overlapping and adjacent intervals and returns sorted disjoint intervals.
 * E.g.: [[0, 10], [5, 25], [40, 50]] -> [[0, 25], [40, 50]]
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals || intervals.length === 0) return [];

  // Sort intervals by start time
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // If intervals overlap or are adjacent (allowing 1 second tolerance for continuous playback)
    if (next[0] <= current[1] + 1) {
      current = [current[0], Math.max(current[1], next[1])];
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Calculates total unique seconds watched from intervals.
 */
export function calculateUniqueSecondsWatched(intervals: Interval[]): number {
  const merged = mergeIntervals(intervals);
  return merged.reduce((total, [start, end]) => total + Math.max(0, end - start), 0);
}

/**
 * Calculates completion percentage based on unique seconds watched vs duration.
 */
export function calculateCompletionPercentage(
  intervals: Interval[],
  durationSeconds: number
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  const uniqueSeconds = calculateUniqueSecondsWatched(intervals);
  const percentage = (uniqueSeconds / durationSeconds) * 100;
  return Math.min(100, Math.round(percentage * 100) / 100);
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
