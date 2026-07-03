export const FEED_WINDOWS = [
  { value: "day", label: "Today", days: 1 },
  { value: "week", label: "This week", days: 7 },
  { value: "month", label: "This month", days: 30 },
  { value: "year", label: "This year", days: 365 },
  { value: "all", label: "All time", days: null },
] as const;

export type FeedWindowValue = (typeof FEED_WINDOWS)[number]["value"];

const DEFAULT_WINDOW = FEED_WINDOWS[1]; // "week" — matches the daily/weekly ingest cadence

export function resolveFeedWindow(value: string | undefined) {
  return FEED_WINDOWS.find((w) => w.value === value) ?? DEFAULT_WINDOW;
}

export function cutoffDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
