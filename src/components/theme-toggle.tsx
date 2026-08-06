"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button variant="secondary" onClick={toggle} className="px-[var(--space-3)] py-[7px] gap-2">
      <span
        className="w-3 h-3 rounded-full"
        style={{
          background: isDark ? "var(--color-neutral-800)" : "var(--color-accent-2)",
          boxShadow: `inset -3px 0 0 ${isDark ? "var(--color-neutral-500)" : "var(--color-accent-600)"}`,
        }}
      />
      <span>{isDark ? "Dark" : "Light"}</span>
    </Button>
  );
}
