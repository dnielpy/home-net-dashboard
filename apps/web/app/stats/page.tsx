import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stats · Home Net",
};

export default function StatsPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Stats</h1>
    </main>
  );
}
