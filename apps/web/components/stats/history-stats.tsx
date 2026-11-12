import { ChartCard } from "@/components/stats/chart-card";
import { buildSpans, ConnectionTimeline } from "@/components/stats/connection-timeline";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type DayHistory, getTodayHistory } from "@/lib/api";

/** Online and offline periods of today: the bar always runs from 00:00 to midnight, whatever the time is now. */
export async function HistoryStats() {
  let history: DayHistory;
  try {
    history = await getTodayHistory();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  // The rest of the day has not happened yet, so the spans stop at the moment of the fetch
  const { dayStart: from, dayEnd: to } = history;
  const spans = buildSpans(history.segments, from, history.fetchedAt);
  const measured = spans.filter((span) => span.online !== null);
  const measuredMs = measured.reduce((sum, span) => sum + span.end - span.start, 0);
  const onlineMs = measured.filter((span) => span.online).reduce((sum, span) => sum + span.end - span.start, 0);
  const uptime = measuredMs > 0 ? `${((onlineMs / measuredMs) * 100).toFixed(1)}% online` : "No checks";

  return (
    <ChartCard
      id="history-chart-title"
      title="Online / offline"
      subtitle={`Today, 00:00 to 23:59 · ${uptime}`}
    >
      {history.segments.length === 0 ? (
        <p className="flex h-20 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          No checks today yet.
        </p>
      ) : (
        <ConnectionTimeline spans={spans} from={from} to={to} />
      )}
    </ChartCard>
  );
}
