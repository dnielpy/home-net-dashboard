import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/auto-refresh";
import { DeviceDetail } from "@/components/devices/device-detail";
import { DeviceHistoryStats } from "@/components/devices/device-history-stats";
import { ChartCardSkeleton } from "@/components/stats/chart-card-skeleton";

const REFRESH_INTERVAL_MS = 60_000;

export const metadata: Metadata = {
  title: "Device · Home Net",
};

export default async function DevicePage({ params, searchParams }: PageProps<"/devices/[mac]">) {
  const mac = decodeURIComponent((await params).mac).toUpperCase();
  const query = await searchParams;

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <Link href="/devices" className="self-start text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
        ← Devices
      </Link>
      <Suspense fallback={<ChartCardSkeleton height={160} />}>
        <DeviceDetail mac={mac} />
      </Suspense>
      <Suspense fallback={<ChartCardSkeleton height={340} />}>
        <DeviceHistoryStats mac={mac} kind="speed" searchParams={query} />
      </Suspense>
      <Suspense fallback={<ChartCardSkeleton height={340} />}>
        <DeviceHistoryStats mac={mac} kind="usage" searchParams={query} />
      </Suspense>
      <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />
    </main>
  );
}
