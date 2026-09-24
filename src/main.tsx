/**
 * Application entry point.
 *
 * Kept deliberately thin: it mounts the shell and nothing else. The renderer is
 * NOT imported here — it is loaded lazily by the viewport, so the React shell
 * reaches interactive state before Babylon is fetched
 * (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.1).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./ui/App";
import "./styles/global.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error(
    "Planetary Survey could not find its #root container. The build may be incomplete.",
  );
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
