import { GlobeIcon } from "@/components/icons/globe-icon";
import { MenuIcon } from "@/components/icons/menu-icon";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AppBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <GlobeIcon className="h-6 w-6 text-emerald-500" />
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Home Net</span>
      </div>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
