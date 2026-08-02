// Tirvona Enterprise Design System 2.0 - Typography Tokens

export const typography = {
  fontFamily: {
    sans: "Satoshi, Manrope, Inter, system-ui, -apple-system, sans-serif",
    serif: "Merriweather, serif",
    mono: "JetBrains Mono, Fira Code, monospace",
    display: "Kalam, cursive, sans-serif",
  },
  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
} as const;

export default typography;
