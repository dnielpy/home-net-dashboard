import { ChartCard } from "@/components/stats/chart-card";
import { OutageChart } from "@/components/stats/outage-chart";
import { OutageTable } from "@/components/stats/outage-table";
import { RangeFilter } from "@/components/stats/range-filter";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, getOutages, type Outage } from "@/lib/api";
import { formatDuration } from "@/lib/outage-format";
import { TIME_RANGES, parseTimeRange } from "@/lib/time-ranges";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function OutageStats({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseTimeRange(params.outageHours, TIME_RANGES);

  let outages: Outage[];
  try {
    outages = await getOutages(range.hours);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  const totalHours = outages.reduce((sum, outage) => sum + outage.duration_hours, 0);
  const count = `${outages.length} ${outages.length === 1 ? "outage" : "outages"}`;

  return (
    <ChartCard
      id="outages-chart-title"
      title="Outages"
      subtitle={`${range.description} · ${count}${outages.length ? ` · ${formatDuration(totalHours)} without internet` : ""}`}
      actions={
        <RangeFilter
          label="Outages time range"
          param="outageHours"
          ranges={TIME_RANGES}
          selected={range}
          searchParams={params}
        />
      }
    >
      {outages.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          No outages in this period.
        </p>
      ) : (
        <>
          <OutageChart outages={outages} />
          <OutageTable outages={outages} />
        </>
      )}
    </ChartCard>
  );
}
