import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        outsail: {
          blue: '#4277c7',
          'blue-dark': '#0052cc',
          navy: '#082f69',
          cyan: '#00c1ff',
          light: '#ebeff2',
        },
      },
    },
  },
  plugins: [],
};
export default config;
