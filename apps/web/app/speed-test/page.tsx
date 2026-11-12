import type { Metadata } from "next";

import { SpeedTestCard } from "@/components/speed-test/speed-test-card";

export const metadata: Metadata = {
  title: "Speed test · Home Net",
};

export default function SpeedTestPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <h1 className="sr-only">Speed test</h1>
      <SpeedTestCard />
    </main>
  );
}
