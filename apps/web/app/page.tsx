import { Suspense } from "react";

import { ChainSkeleton } from "@/components/chain-skeleton";
import { LiveConnectionView } from "@/components/live-connection";
import { LiveDownload } from "@/components/throughput/live-download";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
      <h1 className="sr-only">Dashboard</h1>
      <Suspense fallback={<ChainSkeleton />}>
        <LiveConnectionView />
      </Suspense>
      <LiveDownload />
    </main>
  );
}
