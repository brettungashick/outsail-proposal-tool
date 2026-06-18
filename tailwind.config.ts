import type { Config } from "tailwindcss";

// Visual style is governed by docs/design-system.md (OutSail brand kit).
// Brand rules enforced here: blue + neutral only, squared corners everywhere
// (all radii 0), Inter, and warm-neutral (never blue-tinted) shadows.
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

        // Brand palette (use these names going forward)
        harbor: "#1E3A6B", // deepest blue — headings, wordmark, primary-hover
        osblue: "#4277C7", // PRIMARY action color, links, accents
        sky: "#7FA8DC", // lightest blue — highlights, gradient tip
        cool: "#64748B", // tertiary text, eyebrow labels
        line: "#E2E8F0", // dividers, borders
        offwhite: "#F4F7FB", // page background, surfaces
        tint: { 25: "#EEF6FE", 50: "#DCEAF7", 100: "#BFD5EE" },

        // Existing component aliases, remapped to brand values
        outsail: {
          blue: "#4277C7", // osblue
          "blue-dark": "#1E3A6B", // deep harbor (primary hover / headings)
          navy: "#15295A", // press / darkest
          light: "#F4F7FB", // off-white surface
        },

        // Override default Tailwind "blue" so existing blue-* utilities are on-brand
        blue: {
          50: "#EEF6FE",
          100: "#DCEAF7",
          200: "#BFD5EE",
          300: "#7FA8DC",
          400: "#5C90D2",
          500: "#4277C7",
          600: "#4277C7", // primary action
          700: "#1E3A6B", // hover → deep harbor
          800: "#15295A", // press
          900: "#102043",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      // Squared corners everywhere — rounded-* utilities become no-ops.
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "0",
      },
      // Warm-neutral shadows — never blue-tinted.
      boxShadow: {
        sm: "0 1px 2px rgba(15,23,42,0.04)",
        DEFAULT: "0 1px 2px rgba(15,23,42,0.04)",
        md: "0 4px 12px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        lg: "0 12px 32px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)",
        xl: "0 12px 32px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)",
        "2xl": "0 12px 32px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)",
        none: "none",
      },
    },
  },
  plugins: [],
};
export default config;
