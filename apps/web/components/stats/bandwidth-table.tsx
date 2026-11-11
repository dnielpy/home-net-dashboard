import type { BandwidthBar } from "@/lib/bandwidth-series";
import { formatBytes } from "@/lib/bytes-format";
import { formatTooltipTime } from "@/lib/chart-time";

export function BandwidthTable({ bars }: { bars: BandwidthBar[] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-zinc-500 select-none hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
        View as table
      </summary>
      <table className="mt-3 w-full text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th scope="col" className="py-2 font-medium">From</th>
            <th scope="col" className="py-2 text-right font-medium">Download</th>
            <th scope="col" className="py-2 text-right font-medium">Upload</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.start} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
              <td className="py-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{formatTooltipTime(bar.start)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{formatBytes(bar.rx)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{formatBytes(bar.tx)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
