export type TimeRange = { hours: number; label: string; description: string };

const ONE_HOUR: TimeRange = { hours: 1, label: "1h", description: "Last hour" };
const SIX_HOURS: TimeRange = { hours: 6, label: "6h", description: "Last 6 hours" };
const TWELVE_HOURS: TimeRange = { hours: 12, label: "12h", description: "Last 12 hours" };
const ONE_DAY: TimeRange = { hours: 24, label: "24h", description: "Last 24 hours" };
const THREE_DAYS: TimeRange = { hours: 72, label: "3d", description: "Last 3 days" };
const SEVEN_DAYS: TimeRange = { hours: 168, label: "7d", description: "Last 7 days" };

// Every stats card offers the same ranges
export const TIME_RANGES: TimeRange[] = [ONE_HOUR, SIX_HOURS, TWELVE_HOURS, ONE_DAY, THREE_DAYS, SEVEN_DAYS];

export const DEFAULT_TIME_RANGE = ONE_DAY;

// The online/offline card shows one bar per day, so it counts whole days back from today
export const DAY_RANGES: TimeRange[] = [
  { hours: 24, label: "1d", description: "Today" },
  { hours: 72, label: "3d", description: "Today and the 2 days before" },
  { hours: 168, label: "7d", description: "Today and the 6 days before" },
  { hours: 360, label: "15d", description: "Today and the 14 days before" },
];

export function parseTimeRange(
  value: string | string[] | undefined,
  ranges: TimeRange[],
  fallback: TimeRange = DEFAULT_TIME_RANGE,
): TimeRange {
  const hours = Number(Array.isArray(value) ? value[0] : value);
  return ranges.find((range) => range.hours === hours) ?? fallback;
}
