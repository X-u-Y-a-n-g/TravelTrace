import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        pine: {
          50: "#f0f5f2",
          100: "#dce8e1",
          200: "#bcd2c5",
          300: "#93b5a3",
          400: "#67947e",
          500: "#497a64",
          600: "#366150",
          700: "#2c4e42",
          800: "#263f36",
          900: "#21352e",
          950: "#101d19",
        },
        sand: {
          50: "#faf7f1",
          100: "#f4eee1",
          200: "#e8dcc4",
          300: "#d9c49e",
          400: "#c9a873",
          500: "#bc9157",
          600: "#a97a48",
          700: "#8c603d",
          800: "#734f37",
          900: "#5f4230",
        },
        ember: {
          50: "#fdf7ef",
          100: "#f9ead6",
          200: "#f2d1ac",
          300: "#e8b178",
          400: "#dd8c45",
          500: "#d4722a",
          600: "#bd5a20",
          700: "#9d441d",
          800: "#7f381e",
          900: "#682f1c",
        },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Fraunces Variable", "Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(24, 35, 31, 0.04), 0 12px 32px -12px rgba(24, 35, 31, 0.18)",
        lift: "0 2px 4px rgba(24, 35, 31, 0.05), 0 24px 48px -24px rgba(24, 35, 31, 0.3)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "slide-in": "slide-in 0.3s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
