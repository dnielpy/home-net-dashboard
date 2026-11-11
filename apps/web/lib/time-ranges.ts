export type TimeRange = { hours: number; label: string; description: string };

const ONE_HOUR: TimeRange = { hours: 1, label: "1h", description: "Last hour" };
const SIX_HOURS: TimeRange = { hours: 6, label: "6h", description: "Last 6 hours" };
const TWELVE_HOURS: TimeRange = { hours: 12, label: "12h", description: "Last 12 hours" };
const ONE_DAY: TimeRange = { hours: 24, label: "24h", description: "Last 24 hours" };
const SEVEN_DAYS: TimeRange = { hours: 168, label: "7d", description: "Last 7 days" };
const THIRTY_DAYS: TimeRange = { hours: 720, label: "30d", description: "Last 30 days" };

export const HISTORY_RANGES: TimeRange[] = [ONE_HOUR, SIX_HOURS, ONE_DAY, SEVEN_DAYS];
export const OUTAGE_RANGES: TimeRange[] = [TWELVE_HOURS, ONE_DAY, SEVEN_DAYS];
export const BANDWIDTH_RANGES: TimeRange[] = [ONE_DAY, SEVEN_DAYS, THIRTY_DAYS];

export const DEFAULT_TIME_RANGE = ONE_DAY;

export function parseTimeRange(value: string | string[] | undefined, ranges: TimeRange[]): TimeRange {
  const hours = Number(Array.isArray(value) ? value[0] : value);
  return ranges.find((range) => range.hours === hours) ?? DEFAULT_TIME_RANGE;
}
