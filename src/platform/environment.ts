/**
 * Environment and device signals.
 *
 * The ONLY place in the application that reads browser globals for environment
 * facts. Everything is optional and guarded: this module must be safe to import
 * in a server/SSR-like or test context where `window`, `navigator`, and
 * `matchMedia` do not exist.
 *
 * It deliberately does NOT import `assets/`: qualities-profile assembly happens
 * in the UI layer, keeping the dependency direction in
 * docs/TECHNICAL_DESIGN.md §2.1 intact.
 */

export interface DeviceSignals {
  /** Approximate device memory in GiB, when the browser exposes it. */
  readonly deviceMemoryGb: number | null;
  readonly hardwareConcurrency: number | null;
}

/** Read bounded device signals. Never throws; returns nulls when unavailable. */
export function readDeviceSignals(): DeviceSignals {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & {
    deviceMemory?: number;
  });

  const memory = nav?.deviceMemory;
  const cores = nav?.hardwareConcurrency;

  return {
    deviceMemoryGb: typeof memory === "number" && Number.isFinite(memory) ? memory : null,
    hardwareConcurrency:
      typeof cores === "number" && Number.isFinite(cores) && cores > 0 ? cores : null,
  };
}

/**
 * Read `prefers-reduced-motion`.
 *
 * Treated as a serious learner preference, not a hint: reduced motion must reach
 * the same end states with no unnecessary interpolation
 * (docs/ACCESSIBILITY.md A-8).
 */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== "function") return false;
  try {
    return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Read the URL base the app was served from.
 *
 * Used for diagnostics and for asset resolution. Prefers the bundler-provided
 * `BASE_URL` so a nested games-site deployment resolves correctly, and falls back
 * to a relative base rather than assuming domain root.
 */
export function readBaseUrl(fallback = "./"): string {
  if (typeof document === "undefined") return fallback;
  try {
    const base = document.baseURI;
    if (!base) return fallback;
    return base;
  } catch {
    return fallback;
  }
}

export type VisibilityListener = (hidden: boolean) => void;

/**
 * Observe page visibility so audio can pause and animations can idle.
 *
 * Returns an unsubscribe function; returning one (rather than requiring the
 * caller to match removeEventListener calls) is what keeps teardown honest
 * (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §6).
 */
export function observeVisibility(listener: VisibilityListener): () => void {
  if (typeof document === "undefined") return () => undefined;
  const handler = (): void => listener(document.hidden);
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}
