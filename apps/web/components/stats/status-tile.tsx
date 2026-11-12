import { TileComet } from "@/components/stats/tile-comet";

type Tone = "red" | "green";

const TONE_STYLES: Record<Tone, { tile: string; dot: string; divider: string; comet: string; glow: string }> = {
  red: {
    tile: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
    dot: "bg-red-600",
    divider: "border-red-200 dark:border-red-500/30",
    comet: "#fca5a5",
    glow: "#ef4444",
  },
  green: {
    tile: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    dot: "bg-emerald-600",
    divider: "border-emerald-200 dark:border-emerald-500/30",
    comet: "#6ee7b7",
    glow: "#10b981",
  },
};

type TileValue = {
  label: string;
  value: string;
  detail?: string;
};

type StatusTileProps = TileValue & {
  tone: Tone;
  /** A second value shown in the right half of the tile. */
  aside?: TileValue;
  /** The state it shows is the current one: a comet runs around its border. */
  live?: boolean;
};

function TileContent({ label, value, detail, dot }: TileValue & { dot?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        {dot && <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>}
    </div>
  );
}

export function StatusTile({ tone, label, value, detail, aside, live }: StatusTileProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div className={`relative rounded-xl border p-4 ${styles.tile} ${aside ? "grid grid-cols-2 gap-4" : ""}`}>
      {live && <TileComet color={styles.comet} glow={styles.glow} />}
      <TileContent label={label} value={value} detail={detail} dot={styles.dot} />
      {aside && (
        <div className={`border-l pl-4 ${styles.divider}`}>
          <TileContent {...aside} />
        </div>
      )}
    </div>
  );
}
