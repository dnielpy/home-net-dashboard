export function ChainSkeleton() {
  return (
    <div aria-hidden className="flex w-full max-w-4xl animate-pulse flex-col items-center gap-10">
      <div className="h-12 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex w-full flex-col gap-10 md:flex-row md:justify-between">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
