import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// A tab opened before a deploy still references the old hashed chunks, which
// the new deploy removed; loading a lazy page then fails and leaves a blank
// screen. Reload once to pick up the current build. The timestamp guard stops
// a reload loop if the chunk is genuinely missing.
const CHUNK_RELOAD_KEY = "tirvona:chunk-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: without the guard a reload could loop, so don't.
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
