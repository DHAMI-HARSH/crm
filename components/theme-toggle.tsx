"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "groweasy-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document === "undefined") {
      return "light";
    }

    const current = document.documentElement.dataset.theme;
    return current === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        return;
      }

      const nextTheme = media.matches ? "dark" : "light";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  function applyTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
  }

  return (
    <div className="inline-flex border border-[var(--line-strong)] bg-[var(--surface-raised)] p-1">
      <button
        type="button"
        onClick={() => applyTheme("light")}
        aria-pressed={theme === "light"}
        className={[
          "px-3 py-2 font-mono text-xs font-semibold outline-none transition-colors",
          theme === "light"
            ? "bg-[var(--accent)] text-[var(--accent-ink)]"
            : "text-[var(--muted)] hover:bg-[var(--surface)]",
        ].join(" ")}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => applyTheme("dark")}
        aria-pressed={theme === "dark"}
        className={[
          "px-3 py-2 font-mono text-xs font-semibold outline-none transition-colors",
          theme === "dark"
            ? "bg-[var(--accent)] text-[var(--accent-ink)]"
            : "text-[var(--muted)] hover:bg-[var(--surface)]",
        ].join(" ")}
      >
        Dark
      </button>
    </div>
  );
}
