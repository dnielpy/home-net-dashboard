type Tone = "red" | "green";

const TONE_STYLES: Record<Tone, { tile: string; dot: string }> = {
  red: {
    tile: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
    dot: "bg-red-600",
  },
  green: {
    tile: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    dot: "bg-emerald-600",
  },
};

type StatusTileProps = {
  tone: Tone;
  label: string;
  value: string;
  detail?: string;
};

export function StatusTile({ tone, label, value, detail }: StatusTileProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div className={`rounded-xl border p-4 ${styles.tile}`}>
      <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <span aria-hidden className={`h-2 w-2 rounded-full ${styles.dot}`} />
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>}
    </div>
  );
}
