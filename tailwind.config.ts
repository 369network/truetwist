import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        coral: {
          50: "#FFF5F5",
          100: "#FFE3E3",
          200: "#FFC9C9",
          300: "#FFA8A8",
          400: "#FF8787",
          500: "#FF6B6B",
          600: "#FA5252",
          700: "#F03E3E",
          800: "#E03131",
          900: "#C92A2A",
        },
        dark: {
          bg: "#0F0D1A",
          surface: "#1A1726",
          "surface-2": "#252236",
          "surface-3": "#312D45",
          border: "#3D3856",
          text: "#E8E6F0",
          muted: "#9B97B0",
        },
        platform: {
          instagram: "#E1306C",
          twitter: "#1DA1F2",
          linkedin: "#0A66C2",
          tiktok: "#000000",
          facebook: "#1877F2",
          youtube: "#FF0000",
          pinterest: "#E60023",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.08)",
        elevated: "0 12px 40px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
