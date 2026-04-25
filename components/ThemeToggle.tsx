"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  function apply(t: Theme) {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = t === "dark" || (t === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
  }

  function cycle() {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    apply(next);
  }

  const display: Theme = mounted ? theme : "system";
  const icon =
    display === "light" ? <SunIcon /> : display === "dark" ? <MoonIcon /> : <SystemIcon />;
  const label = `Theme: ${display}`;

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${label} (click to cycle)`}
      aria-label={`${label}. Click to switch.`}
      suppressHydrationWarning
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
    >
      {icon}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]" aria-hidden>
      <circle cx="10" cy="10" r="3.5" />
      <path strokeLinecap="round" d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
      <path d="M16.5 12.5A6.5 6.5 0 0 1 7.5 3.5a.75.75 0 0 0-1-.85 8 8 0 1 0 10.85 10.85.75.75 0 0 0-.85-1Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]" aria-hidden>
      <rect x="2.5" y="3.5" width="15" height="11" rx="1.5" />
      <path strokeLinecap="round" d="M7 17.5h6M10 14.5v3" />
    </svg>
  );
}
