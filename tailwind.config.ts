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
          primary: "#1A1A1A",
          surface: "#242424",
          hover: "#2E2E2E",
        },
        border: "#3A3A3A",
        "text-primary": "#F5F5F5",
        "text-secondary": "#B0B0B0",
        "text-muted": "#707070",
        accent: "#F5A623",
        green: "#22C55E",
        red: "#EF4444",
        yellow: "#F5A623",
        purple: "#A855F7",
      },
    },
  },
  plugins: [],
};
export default config;
