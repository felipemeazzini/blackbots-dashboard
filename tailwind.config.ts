import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0B0D0F",
          surface: "#151921",
          hover: "#1C2333",
        },
        border: "#2A3142",
        "text-primary": "#F1F5F9",
        "text-secondary": "#94A3B8",
        "text-muted": "#64748B",
        accent: "#3B82F6",
        green: "#22C55E",
        red: "#EF4444",
        yellow: "#EAB308",
        purple: "#A855F7",
      },
    },
  },
  plugins: [],
};
export default config;
