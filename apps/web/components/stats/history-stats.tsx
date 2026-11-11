import { ChartCard } from "@/components/stats/chart-card";
import { buildSpans, ConnectionTimeline } from "@/components/stats/connection-timeline";
import { RangeFilter } from "@/components/stats/range-filter";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type ConnectionHistory, getConnectionHistory } from "@/lib/api";
import { HISTORY_RANGES, parseTimeRange } from "@/lib/time-ranges";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const HOUR_MS = 3_600_000;

export async function HistoryStats({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseTimeRange(params.historyHours, HISTORY_RANGES);

  let history: ConnectionHistory;
  try {
    history = await getConnectionHistory(range.hours);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  const to = history.fetchedAt;
  const from = to - range.hours * HOUR_MS;
  const spans = buildSpans(history.segments, from, to);
  const measured = spans.filter((span) => span.online !== null);
  const measuredMs = measured.reduce((sum, span) => sum + span.end - span.start, 0);
  const onlineMs = measured.filter((span) => span.online).reduce((sum, span) => sum + span.end - span.start, 0);
  const uptime = measuredMs > 0 ? `${((onlineMs / measuredMs) * 100).toFixed(1)}% online` : "No checks";

  return (
    <ChartCard
      id="history-chart-title"
      title="Online / offline"
      subtitle={`${range.description} · ${uptime}`}
      actions={
        <RangeFilter
          label="Online history time range"
          param="historyHours"
          ranges={HISTORY_RANGES}
          selected={range}
          searchParams={params}
        />
      }
    >
      {history.segments.length === 0 ? (
        <p className="flex h-20 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          No checks in this period.
        </p>
      ) : (
        <ConnectionTimeline spans={spans} from={from} to={to} />
      )}
    </ChartCard>
  );
}
