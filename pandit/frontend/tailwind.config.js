/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0A4DA6",
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#0A4DA6",
          700: "#083b80",
        },
        secondary: {
          DEFAULT: "#0B192C",
        },
        accent: {
          DEFAULT: "#E58C28",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        xl: "1.5rem",
        lg: "1.25rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
    },
  },
  plugins: [],
};
