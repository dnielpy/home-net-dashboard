import type { Metadata } from "next";

import { LocalSpeedTestCard } from "@/components/local-speed-test/local-speed-test-card";

export const metadata: Metadata = {
  title: "Local speed test · Home Net",
};

export default function LocalSpeedTestPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <h1 className="sr-only">Local speed test</h1>
      <LocalSpeedTestCard />
    </main>
  );
}
