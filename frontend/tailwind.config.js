/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          950: "#0A3535",
          900: "#0F4C4C",
          800: "#155E5E",
          700: "#1C7373",
          600: "#258A8A",
          400: "#5BA3A3",
          300: "#8FC4C4",
          200: "#B8DCDC",
          100: "#DCEEEE",
          50: "#F1F8F8",
        },
        coral: {
          600: "#D14E33",
          500: "#E8674B",
          100: "#FCE4DD",
          50: "#FDF1ED",
        },
        sage: {
          700: "#4F7A60",
          600: "#5F8F71",
          500: "#7FA88E",
          100: "#E3EFE7",
          50: "#F1F7F3",
        },
        amber: {
          700: "#B6791F",
          600: "#CC8B28",
          500: "#E8A23D",
          100: "#FBEBD2",
          50: "#FDF6EA",
        },
        ink: {
          900: "#1E2524",
          800: "#2D3436",
          700: "#414948",
          600: "#5B6362",
          500: "#737B79",
          400: "#8B9290",
          200: "#D7DBDA",
          100: "#E8EAE9",
          50: "#F4F5F4",
        },
        cream: "#FAF8F4",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30, 37, 36, 0.04), 0 4px 12px rgba(30, 37, 36, 0.06)",
        cardHover: "0 2px 4px rgba(30, 37, 36, 0.06), 0 8px 20px rgba(30, 37, 36, 0.10)",
      },
    },
  },
  plugins: [],
};
