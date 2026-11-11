import { BandwidthChart, buildBars } from "@/components/stats/bandwidth-chart";
import { BandwidthTable } from "@/components/stats/bandwidth-table";
import { ChartCard } from "@/components/stats/chart-card";
import { RangeFilter } from "@/components/stats/range-filter";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type BandwidthBucket, type BandwidthResult, getBandwidth } from "@/lib/api";
import { formatBytes } from "@/lib/bytes-format";
import { BANDWIDTH_RANGES, parseTimeRange } from "@/lib/time-ranges";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const HOUR_MS = 3_600_000;

export async function BandwidthStats({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseTimeRange(params.bandwidthHours, BANDWIDTH_RANGES);
  const bucket: BandwidthBucket = range.hours <= 24 ? "hour" : "day";

  let result: BandwidthResult;
  try {
    result = await getBandwidth(range.hours, bucket);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  const { bandwidth, fetchedAt: to } = result;
  const bars = buildBars(bandwidth.items, bucket, to - range.hours * HOUR_MS, to);
  const totals = `${formatBytes(bandwidth.total_rx_bytes)} down · ${formatBytes(bandwidth.total_tx_bytes)} up`;

  return (
    <ChartCard
      id="bandwidth-chart-title"
      title="Bandwidth used"
      subtitle={`${range.description} · ${totals} · per ${bucket}`}
      actions={
        <RangeFilter
          label="Bandwidth time range"
          param="bandwidthHours"
          ranges={BANDWIDTH_RANGES}
          selected={range}
          searchParams={params}
        />
      }
    >
      {bandwidth.items.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          No traffic samples in this period.
        </p>
      ) : (
        <>
          <BandwidthChart bars={bars} bucket={bucket} />
          <BandwidthTable bars={bars} />
        </>
      )}
    </ChartCard>
  );
}
