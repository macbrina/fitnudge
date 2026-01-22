"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/store";

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button className="p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
        <Sun className="h-5 w-5 text-white" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 text-white" />
      ) : (
        <Sun className="h-5 w-5 text-white" />
      )}
    </button>
  );
}
