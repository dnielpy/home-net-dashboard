import { ChartCard } from "@/components/stats/chart-card";
import { StatusTile } from "@/components/stats/status-tile";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type ConnectionStatusResult, getConnectionStatus, type Period } from "@/lib/api";
import { hopLabel } from "@/lib/hops";
import { formatDateTime, formatElapsed } from "@/lib/outage-format";

const HOUR_MS = 3_600_000;

function periodValue(period: Period | null): string {
  return period ? formatElapsed(period.duration_hours * HOUR_MS) : "None recorded";
}

function periodDetail(period: Period | null): string | undefined {
  return period ? `${formatDateTime(period.start)} → ${formatDateTime(period.end)}` : undefined;
}

export async function ConnectionStatusCard() {
  let result: ConnectionStatusResult;
  try {
    result = await getConnectionStatus();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  const { status, fetchedAt } = result;

  if (status.online === null || status.current_since === null) {
    return (
      <ChartCard id="connection-status-title" title="Connection status" subtitle="No checks yet">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">The status will appear once the API stores a check.</p>
      </ChartCard>
    );
  }

  const current = {
    value: formatElapsed(fetchedAt - Date.parse(status.current_since)),
    detail: `Since ${formatDateTime(status.current_since)}`,
  };

  const tiles = status.online ? (
    <>
      <StatusTile tone="green" label="Online" value={current.value} detail={current.detail} />
      <StatusTile
        tone="red"
        label="Last outage"
        value={periodValue(status.last_outage)}
        detail={
          status.last_outage
            ? `Cut at ${hopLabel(status.last_outage.break_at)} · ${periodDetail(status.last_outage)}`
            : undefined
        }
      />
    </>
  ) : (
    <>
      <StatusTile tone="red" label="Offline" value={current.value} detail={current.detail} />
      <StatusTile
        tone="green"
        label="Online before"
        value={periodValue(status.last_online_period)}
        detail={status.last_online_period ? `Before this outage · ${periodDetail(status.last_online_period)}` : undefined}
      />
    </>
  );

  return (
    <ChartCard
      id="connection-status-title"
      title="Connection status"
      subtitle={status.online ? "Internet is answering" : `Cut at ${hopLabel(status.break_at)}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">{tiles}</div>
    </ChartCard>
  );
}
