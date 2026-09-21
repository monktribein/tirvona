
export const colors = {
  primary: {
    main: "#F28C28",
    hover: "#B45309",
    light: "rgba(242, 140, 40, 0.1)",
    border: "rgba(242, 140, 40, 0.2)",
  },
  secondary: {
    main: "#E58C28",
    hover: "#D47B17",
    light: "rgba(229, 140, 40, 0.15)",
    border: "rgba(229, 140, 40, 0.3)",
  },
  sidebar: {
    bg: "#0B192C",
    border: "#1E293B",
    hover: "#1E293B",
    active: "#F28C28",
    text: "#94A3B8",
    textActive: "#FFFFFF",
  },
  background: {
    default: "#F8FAFC",
    dark: "#070F1B",
    card: "#FFFFFF",
    cardDark: "#0B192C",
  },
  border: {
    light: "#E5E7EB",
    dark: "#1E293B",
  },
  status: {
    success: {
      bg: "#ECFDF5",
      text: "#047857",
      border: "#A7F3D0",
    },
    warning: {
      bg: "#FFFBEB",
      text: "#B45309",
      border: "#FDE68A",
    },
    danger: {
      bg: "#FEF2F2",
      text: "#B91C1C",
      border: "#FECACA",
    },
    info: {
      bg: "#EFF6FF",
      text: "#1D4ED8",
      border: "#BFDBFE",
    },
  },
} as const;

export default colors;
