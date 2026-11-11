import type { ReactNode } from "react";

type ChartCardProps = {
  id: string;
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function ChartCard({ id, title, subtitle, actions, children }: ChartCardProps) {
  return (
    <section
      aria-labelledby={id}
      className="w-full rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
