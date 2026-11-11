import { Fragment } from "react";

import { HopLink } from "@/components/connection-chain/hop-link";
import { HopNode } from "@/components/connection-chain/hop-node";
import { buildHopViews, linkState } from "@/components/connection-chain/hop-state";
import type { LiveConnection } from "@/lib/api";
import { hopLabel } from "@/lib/hops";

export function ConnectionChain({ live }: { live: LiveConnection }) {
  const hops = buildHopViews(live.hops);
  const internet = live.hops.at(-1);

  return (
    <section aria-labelledby="connection-chain-title" className="flex w-full max-w-4xl flex-col items-center gap-10">
      <div className="text-center">
        <h2 id="connection-chain-title" className="text-sm text-zinc-500 dark:text-zinc-400">
          Connection
        </h2>
        {live.online ? (
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Online
            {internet?.latency_ms != null && (
              <span className="font-normal text-zinc-500 dark:text-zinc-400"> · {internet.latency_ms.toFixed(0)} ms to internet</span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-2xl font-semibold text-[#d03b3b]">Cut at {hopLabel(live.break_at)}</p>
        )}
      </div>

      <ol aria-label="Connection chain" className="flex w-full flex-col md:flex-row md:items-start">
        {hops.map((hop, index) => (
          <Fragment key={hop.name}>
            {index > 0 && <HopLink state={linkState(hop)} />}
            <HopNode hop={hop} />
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
