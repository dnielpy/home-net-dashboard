import { HOP_STATE_STYLES, type HopView } from "@/components/connection-chain/hop-state";

export function HopNode({ hop }: { hop: HopView }) {
  const styles = HOP_STATE_STYLES[hop.state];

  return (
    <li
      aria-label={`${hop.label} ${hop.ip}: ${styles.status}${hop.latency_ms !== null ? `, ${hop.latency_ms} ms` : ""}`}
      className="flex w-full items-center gap-4 md:w-auto md:flex-col md:gap-3 md:text-center"
    >
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white ring-8 transition-colors md:h-20 md:w-20 ${styles.circle}`}
      >
        <hop.Icon className="h-1/2 w-1/2" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">{hop.label}</p>
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{hop.ip}</p>
        <p className="mt-1 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
          {hop.latency_ms !== null ? `${hop.latency_ms.toFixed(1)} ms` : styles.status}
        </p>
      </div>
    </li>
  );
}
