import type { LinkState } from "@/components/connection-chain/hop-state";

const LINK_STYLES: Record<LinkState, string> = {
  up: "link-flow bg-[#0ca30c]",
  cut: "link-cut",
  unknown: "bg-zinc-300 dark:bg-zinc-700",
};

export function HopLink({ state }: { state: LinkState }) {
  return (
    <li
      aria-hidden
      className="ml-[calc(2rem-3px)] h-10 w-1.5 shrink-0 rounded-full md:mt-[calc(2.5rem-3px)] md:ml-0 md:h-1.5 md:w-auto md:min-w-8 md:flex-1"
    >
      <span className={`block h-full w-full rounded-full ${LINK_STYLES[state]}`} />
    </li>
  );
}
