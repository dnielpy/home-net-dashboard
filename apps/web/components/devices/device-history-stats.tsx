import { ChartCard } from "@/components/stats/chart-card";
import { BandwidthChart } from "@/components/stats/bandwidth-chart";
import { RangeFilter } from "@/components/stats/range-filter";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type DeviceHistoryResult, getDeviceHistory } from "@/lib/api";
import { BUCKET_LABELS, bucketFor } from "@/lib/bandwidth-bucket";
import { buildBars } from "@/lib/bandwidth-series";
import { formatBytes } from "@/lib/bytes-format";
import { TIME_RANGES, parseTimeRange } from "@/lib/time-ranges";

type SearchParams = Record<string, string | string[] | undefined>;

const HOUR_MS = 3_600_000;

type DeviceHistoryStatsProps = { mac: string; searchParams: SearchParams };

/** The device's estimated usage over time, with its own range filter. */
export async function DeviceHistoryStats({ mac, searchParams }: DeviceHistoryStatsProps) {
  const range = parseTimeRange(searchParams.usageHours, TIME_RANGES);
  const bucket = bucketFor(range.hours);

  let result: DeviceHistoryResult;
  try {
    result = await getDeviceHistory(mac, range.hours, bucket);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  const { history, fetchedAt: to } = result;
  const from = to - range.hours * HOUR_MS;
  // The chart reads rx/tx: bytes downloaded and uploaded
  const points = history.items.map((item) => ({ start: item.start, rx_bytes: item.down_bytes, tx_bytes: item.up_bytes }));
  const bars = buildBars(points, bucket, from, to);
  const subtitle = `${range.description} · ${formatBytes(history.total_down_bytes)} down · ${formatBytes(history.total_up_bytes)} up · per ${BUCKET_LABELS[bucket]}`;

  return (
    <ChartCard
      id="usage-chart-title"
      title="Data used (estimated)"
      subtitle={subtitle}
      actions={
        <RangeFilter
          label="Data used time range"
          param="usageHours"
          ranges={TIME_RANGES}
          selected={range}
          searchParams={searchParams}
          path={`/devices/${encodeURIComponent(mac)}`}
        />
      }
    >
      {history.items.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          No samples of this device in this period.
        </p>
      ) : (
        <BandwidthChart bars={bars} bucket={bucket} to={to} ariaLabel="Data downloaded and uploaded over time." />
      )}
    </ChartCard>
  );
}
