/**
 * Renderer capability detection.
 *
 * Policy (docs/TECHNOLOGY_DECISIONS.md §6.1, docs/TECHNICAL_DESIGN.md §6):
 *  - WebGL2 is the required correctness baseline;
 *  - WebGPU is an enhancement path and may never gate a mission, a measurement,
 *    an evidence record, a claim outcome, or an accessible equivalent;
 *  - detection must be non-blocking, must never throw, and must never change
 *    domain behaviour.
 *
 * The probe is injectable so tests and the "renderer unavailable" path can be
 * exercised deterministically without a real GPU. The domain layer never sees a
 * `CapabilityReport`; only `renderer/` and `ui/` do.
 */

export type RendererBackend = "webgpu" | "webgl2" | "unavailable";

export interface WebGL2ProbeResult {
  readonly supported: boolean;
  readonly maxTextureSize: number | null;
}

export interface CapabilityProbe {
  /** Whether a usable WebGPU adapter is likely available. */
  hasWebGPU(): boolean;
  /** Whether WebGL2 is available, plus a bounded presentation fact. */
  probeWebGL2(): WebGL2ProbeResult;
}

export interface CapabilityReport {
  /**
   * The backend this probe REQUESTS, not the backend that ends up running.
   *
   * A capability probe cannot answer the real question synchronously: whether a
   * *usable* WebGPU adapter exists requires an async adapter request. Presence of
   * `navigator.gpu` only means the browser exposes the API, and browsers do expose
   * it while still being unable to provide an adapter. So this field is advisory.
   *
   * The authority on the backend actually in use is the renderer, which reports it
   * in its `ready`/`failed` events. UI that needs the truth must read those, never
   * this field — otherwise the app would claim WebGPU while rendering on WebGL2
   * (docs/TECHNICAL_DESIGN.md §6.2).
   */
  readonly backend: RendererBackend;
  /**
   * Whether the WebGPU API is exposed. This is NOT proof of a usable adapter and
   * must never be treated as one by quality selection or by diagnostics.
   */
  readonly webgpu: boolean;
  /** Whether a WebGL2 context could actually be created. This one is confirmed. */
  readonly webgl2: boolean;
  readonly maxTextureSize: number | null;
  /** Human-readable notes explaining the decision; surfaced in diagnostics. */
  readonly notes: readonly string[];
}

/**
 * Whether WebGPU can be treated as confirmed for the purpose of presentation
 * choices. Only the renderer can answer this, so this helper exists to make the
 * rule explicit and hard to bypass.
 */
export function webgpuIsConfirmed(backendInUse: RendererBackend | null): boolean {
  return backendInUse === "webgpu";
}

export function unavailableReport(notes: readonly string[]): CapabilityReport {
  return {
    backend: "unavailable",
    webgpu: false,
    webgl2: false,
    maxTextureSize: null,
    notes,
  };
}

/**
 * Resolve a backend from a probe.
 *
 * Total and exception-safe: a probe that throws or reports nonsense degrades to
 * `unavailable` with an explanation instead of breaking application startup.
 */
export function detectCapabilities(probe: CapabilityProbe): CapabilityReport {
  const notes: string[] = [];
  let webgpu = false;
  let webgl2Result: WebGL2ProbeResult = { supported: false, maxTextureSize: null };

  try {
    webgpu = probe.hasWebGPU();
  } catch {
    notes.push("WebGPU detection failed; continuing without it.");
  }

  try {
    webgl2Result = probe.probeWebGL2();
  } catch {
    notes.push("WebGL2 detection failed.");
  }

  if (webgpu) {
    notes.push(
      "WebGPU is exposed by this browser: requesting the enhancement path. WebGL2 remains the correctness baseline, and the renderer confirms which one actually runs.",
    );
    return {
      backend: "webgpu",
      webgpu: true,
      webgl2: webgl2Result.supported,
      maxTextureSize: webgl2Result.maxTextureSize,
      notes,
    };
  }

  if (webgl2Result.supported) {
    notes.push("Using WebGL2, the required correctness baseline.");
    return {
      backend: "webgl2",
      webgpu: false,
      webgl2: true,
      maxTextureSize: webgl2Result.maxTextureSize,
      notes,
    };
  }

  notes.push("Neither WebGL2 nor WebGPU is available in this browser.");
  return {
    backend: "unavailable",
    webgpu: false,
    webgl2: false,
    maxTextureSize: null,
    notes,
  };
}

/** The real browser probe. Read-only; creates a throwaway canvas it never keeps. */
export function createBrowserProbe(): CapabilityProbe {
  return {
    hasWebGPU(): boolean {
      if (typeof navigator === "undefined") return false;
      const nav = navigator as Navigator & { gpu?: unknown };
      return nav.gpu !== undefined && nav.gpu !== null;
    },
    probeWebGL2(): WebGL2ProbeResult {
      if (typeof document === "undefined") {
        return { supported: false, maxTextureSize: null };
      }
      const canvas = document.createElement("canvas");
      try {
        const context = canvas.getContext("webgl2");
        if (!context) return { supported: false, maxTextureSize: null };
        const maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE);
        return {
          supported: true,
          maxTextureSize: typeof maxTextureSize === "number" ? maxTextureSize : null,
        };
      } catch {
        return { supported: false, maxTextureSize: null };
      } finally {
        // Release the probe context promptly; a lost context is not a mission asset.
        const lose = (canvas as HTMLCanvasElement & { loseContext?: () => void }).loseContext;
        if (typeof lose === "function") lose.call(canvas);
      }
    },
  };
}

/** Learner-facing explanation for an unavailable renderer. Never a blank viewport. */
export function explainUnavailable(report: CapabilityReport): string {
  const detail = report.notes.length > 0 ? ` ${report.notes.join(" ")}` : "";
  return (
    "This browser cannot start the 3D survey view, so the probe's camera is offline." +
    detail +
    " Every measurement, comparison, and claim still works through the evidence notebook and the accessible data tables — the 3D view is an enhancement, not the source of the science."
  );
}
