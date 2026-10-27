import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // A production build must never pick up NODE_ENV=development from a local .env file: Vite would
  // then ship React's development build, with every component's local file path and line number.
  // Vite only reads NODE_ENV from .env when this is unset, so this keeps `vite build` a real
  // production build. The dev server and `vite build --mode development` are unaffected.
  if (command === 'build' && mode === 'production') process.env.VITE_USER_NODE_ENV ??= '';

  return {
    plugins: [react()],
    server: {
      port: 5174,
      open: true
    },
    build: {
      sourcemap: false
    }
  };
});
