export function ChartCardSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      style={{ height }}
    />
  );
}
