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
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
