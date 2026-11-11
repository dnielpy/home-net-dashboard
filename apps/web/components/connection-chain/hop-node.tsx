import { HOP_STATE_STYLES, type HopView } from "@/components/connection-chain/hop-state";

type HopNodeProps = {
  hop: HopView;
  sweep: number;
  // False when the result is restored from an earlier visit: no flashes
  animate: boolean;
  // The sweep reached internet: every hop that answered flashes together
  celebrate: boolean;
};

export function HopNode({ hop, sweep, animate, celebrate }: HopNodeProps) {
  const styles = HOP_STATE_STYLES[hop.state];

  return (
    <li
      aria-label={`${hop.label} ${hop.ip}: ${styles.status}${hop.latency_ms !== null ? `, ${hop.latency_ms} ms` : ""}`}
      className="flex w-full items-center gap-4 md:w-auto md:flex-col md:gap-3 md:text-center"
    >
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center md:h-20 md:w-20">
        {/* Remounts on every sweep so the flash plays each time the pings reach the hop */}
        {animate && hop.state === "ok" && <span key={sweep} aria-hidden className="hop-flash absolute inset-0 rounded-full" />}
        {animate && celebrate && hop.state === "ok" && (
          <span key={`${sweep}-online`} aria-hidden className="hop-flash absolute inset-0 rounded-full" />
        )}
        {hop.state === "pinging" && (
          <span aria-hidden className="hop-pinging absolute inset-0 rounded-full bg-[#fab219]/50" />
        )}
        <div
          className={`relative flex h-full w-full items-center justify-center rounded-full text-white ring-8 transition-colors duration-300 ${styles.circle}`}
        >
          <hop.Icon className="h-1/2 w-1/2" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">{hop.label}</p>
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{hop.ip}</p>
        <p
          className={`mt-1 text-sm tabular-nums ${
            hop.state === "ok" || hop.state === "down" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {hop.latency_ms !== null ? `${hop.latency_ms.toFixed(1)} ms` : styles.status}
        </p>
      </div>
    </li>
  );
}
