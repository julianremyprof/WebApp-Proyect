import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          500: "#3d8bff",
          600: "#2b6fe0",
          700: "#1f56b3",
        },
        coin: "#f5b301",
      },
    },
  },
  plugins: [],
};
export default config;
