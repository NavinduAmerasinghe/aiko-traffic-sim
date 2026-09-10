/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0e14",
          panel: "#111722",
          elevated: "#161d2b",
          hover: "#1c2432",
        },
        border: {
          subtle: "#212a3a",
          strong: "#2c374a",
        },
        text: {
          primary: "#e6edf5",
          secondary: "#9aa7bd",
          muted: "#5f6b82",
        },
        accent: {
          DEFAULT: "#3b82f6",
          soft: "#1e3a5f",
        },
        traffic: {
          free: "#22c55e",
          moderate: "#eab308",
          slow: "#f97316",
          heavy: "#ef4444",
          none: "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
