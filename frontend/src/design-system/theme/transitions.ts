
export const transitions = {
  fast: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  medium: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "all 500ms cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "all 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)",
} as const;

export default transitions;
