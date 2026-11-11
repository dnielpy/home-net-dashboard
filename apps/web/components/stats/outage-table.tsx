import type { Outage } from "@/lib/api";
import { hopLabel } from "@/lib/hops";
import { formatDateTime, formatDuration } from "@/lib/outage-format";

export function OutageTable({ outages }: { outages: Outage[] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-zinc-500 select-none hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
        View as table
      </summary>
      <table className="mt-3 w-full text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th scope="col" className="py-2 font-medium">Start</th>
            <th scope="col" className="py-2 font-medium">End</th>
            <th scope="col" className="py-2 font-medium">Cut at</th>
            <th scope="col" className="py-2 text-right font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {outages.map((outage) => (
            <tr key={outage.start} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
              <td className="py-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{formatDateTime(outage.start)}</td>
              <td className="py-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                {outage.ongoing ? "Ongoing" : formatDateTime(outage.end)}
              </td>
              <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{hopLabel(outage.break_at)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatDuration(outage.duration_hours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
