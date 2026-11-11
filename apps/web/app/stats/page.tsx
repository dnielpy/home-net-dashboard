import type { Metadata } from "next";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/auto-refresh";
import { BandwidthStats } from "@/components/stats/bandwidth-stats";
import { ChartCardSkeleton } from "@/components/stats/chart-card-skeleton";
import { ConnectionStatusCard } from "@/components/stats/connection-status-card";
import { HistoryStats } from "@/components/stats/history-stats";
import { OutageStats } from "@/components/stats/outage-stats";

const REFRESH_INTERVAL_MS = 60_000;

export const metadata: Metadata = {
  title: "Stats · Home Net",
};

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Stats</h1>
      <Suspense fallback={<ChartCardSkeleton height={190} />}>
        <ConnectionStatusCard />
      </Suspense>
      <Suspense fallback={<ChartCardSkeleton height={150} />}>
        <HistoryStats searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ChartCardSkeleton height={220} />}>
        <OutageStats searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ChartCardSkeleton height={380} />}>
        <BandwidthStats searchParams={searchParams} />
      </Suspense>
      <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />
    </main>
  );
}
