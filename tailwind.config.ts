import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        felt: { DEFAULT: "var(--felt)", ink: "var(--felt-ink)", soft: "var(--felt-soft)" },
        signal: "var(--signal)",
        danger: "var(--danger)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
