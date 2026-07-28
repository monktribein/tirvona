// Tirvona Enterprise Design System 2.0 - Animation Tokens

export const animations = {
  hoverLift: 'transform transition-all duration-300 hover:-translate-y-1',
  hoverScale: 'transform transition-transform duration-200 hover:scale-105 active:scale-95',
  fadeIn: 'animate-in fade-in duration-200',
  zoomIn: 'animate-in zoom-in-95 duration-150',
  pulse: 'animate-pulse',
} as const;

export default animations;
