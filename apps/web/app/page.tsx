import { Suspense } from "react";

import { AutoRefresh } from "@/components/auto-refresh";
import { ChainSkeleton } from "@/components/chain-skeleton";
import { LiveConnectionView } from "@/components/live-connection";

const REFRESH_INTERVAL_MS = 10_000;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
      <h1 className="sr-only">Dashboard</h1>
      <Suspense fallback={<ChainSkeleton />}>
        <LiveConnectionView />
      </Suspense>
      <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />
    </main>
  );
}
