import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-mono text-sm font-semibold uppercase tracking-wider text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-400"
        >
          exec-tracker
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
