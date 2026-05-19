import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1a3a5c",
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          500: "#1a3a5c",
          700: "#102740",
          900: "#0a1a2e",
        },
        gold: {
          DEFAULT: "#c9a227",
          100: "#fef3c7",
          500: "#c9a227",
          700: "#a47e1f",
        },
        sand: {
          DEFAULT: "#e8dcc4",
          100: "#f5efe2",
          500: "#e8dcc4",
        },
        paper: "#fafaf7",
        slate: {
          DEFAULT: "#475569",
          100: "#f1f5f9",
          500: "#475569",
          900: "#0f172a",
        },
        success: "#15803d",
        warning: "#d97706",
        danger: "#b91c1c",
        info: "#2563eb",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
