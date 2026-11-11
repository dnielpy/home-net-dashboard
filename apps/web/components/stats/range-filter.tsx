import Link from "next/link";

import type { TimeRange } from "@/lib/time-ranges";

type RangeFilterProps = {
  label: string;
  param: string;
  ranges: TimeRange[];
  selected: TimeRange;
  searchParams: Record<string, string | string[] | undefined>;
};

function hrefFor(param: string, hours: number, searchParams: RangeFilterProps["searchParams"]): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  query.set(param, String(hours));
  return `/stats?${query.toString()}`;
}

export function RangeFilter({ label, param, ranges, selected, searchParams }: RangeFilterProps) {
  return (
    <nav
      aria-label={label}
      className="inline-flex self-start rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {ranges.map((range) => {
        const active = range.hours === selected.hours;
        return (
          <Link
            key={range.hours}
            href={hrefFor(param, range.hours, searchParams)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            title={range.description}
            className={`rounded-md px-3 py-1 text-sm font-medium tabular-nums transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            }`}
          >
            {range.label}
          </Link>
        );
      })}
    </nav>
  );
}
