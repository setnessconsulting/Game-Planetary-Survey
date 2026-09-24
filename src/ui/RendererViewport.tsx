/**
 * The 3D viewport.
 *
 * React's entire responsibility here is: mount a canvas, create the renderer
 * controller, push typed snapshots into it, and dispose it. React does NOT own
 * the frame loop, does not hold per-frame state, and does not re-render per frame
 * (docs/TECHNICAL_DESIGN.md §4.1).
 *
 * When the renderer is unavailable or fails, the learner gets an honest,
 * accessible explanation instead of a blank box — and the rest of the game still
 * works, because the 3D view is never the only route to evidence
 * (docs/ACCESSIBILITY.md §1, §4).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { QualityProfileId } from "@/assets/qualityProfiles";
import type { RenderSnapshot } from "@/domain/renderSnapshot";
import { detectCapabilities, explainUnavailable, type CapabilityReport } from "@/platform/capabilities";
// TYPE-ONLY imports of the renderer seam. The renderer itself is imported
// DYNAMICALLY inside the effect below, so Babylon is not part of the initial
// eager bundle and the React shell reaches interactive state first
// (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.1-§3.2).
import type { RendererController, RendererEvent } from "@/renderer";

import styles from "./RendererViewport.module.css";

export type ViewportState =
  | { readonly kind: "idle" }
  | { readonly kind: "starting" }
  | { readonly kind: "ready"; readonly backend: string }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string };

export interface RendererViewportProps {
  readonly capabilities: CapabilityReport;
  readonly quality: QualityProfileId;
  readonly reducedMotion: boolean;
  readonly snapshot: RenderSnapshot;
  readonly onEvent?: (event: RendererEvent) => void;
}

export function RendererViewport(props: RendererViewportProps) {
  const { capabilities, quality, reducedMotion, snapshot, onEvent } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const diagnosticsRef = useRef<HTMLParagraphElement | null>(null);
  const controllerRef = useRef<RendererController | null>(null);

  // Refs keep the creation effect independent of values that change often, so a
  // quality change never rebuilds the engine.
  const qualityRef = useRef(quality);
  const motionRef = useRef(reducedMotion);
  const onEventRef = useRef(onEvent);
  const snapshotRef = useRef(snapshot);

  const [state, setState] = useState<ViewportState>({ kind: "idle" });

  useEffect(() => {
    qualityRef.current = quality;
    motionRef.current = reducedMotion;
    onEventRef.current = onEvent;
    snapshotRef.current = snapshot;
  });

  const emit = useCallback((event: RendererEvent): void => {
    onEventRef.current?.(event);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (capabilities.backend === "unavailable") {
      const reason = explainUnavailable(capabilities);
      setState({ kind: "unavailable", reason });
      emit({ kind: "failed", reason, backend: "unavailable" });
      return undefined;
    }

    let disposed = false;
    let controller: RendererController | null = null;
    setState({ kind: "starting" });

    void (async () => {
      try {
        // Lazy: this is the only place the renderer is pulled in.
        const { createRendererController } = await import("@/renderer");
        const created = await createRendererController({
          canvas,
          capabilities,
          quality: qualityRef.current,
          reducedMotion: motionRef.current,
          diagnostics: diagnosticsRef.current,
          onEvent: emit,
        });
        if (disposed) {
          created.dispose();
          return;
        }
        controller = created;
        controllerRef.current = created;
        created.setQuality(qualityRef.current, motionRef.current);
        created.applySnapshot(snapshotRef.current);
        setState({ kind: "ready", backend: created.backend });
      } catch (error) {
        if (disposed) return;
        setState({
          kind: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      disposed = true;
      controllerRef.current = null;
      controller?.dispose();
      controller = null;
    };
  }, [capabilities, emit]);

  // Semantic changes only. No per-frame React work happens anywhere in this file.
  useEffect(() => {
    controllerRef.current?.applySnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    controllerRef.current?.setQuality(quality, reducedMotion);
  }, [quality, reducedMotion]);

  const statusText = describeState(state);

  return (
    <section
      aria-labelledby="viewport-heading"
      data-testid="renderer-viewport"
      data-viewport-state={state.kind}
    >
      <h2 id="viewport-heading">Survey view</h2>
      <p className={styles.notice}>{snapshot.presentation.scaleNotice}</p>

      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-hidden="true"
          data-testid="renderer-canvas"
        />
        {state.kind === "ready" ? null : (
          <p className={styles.overlay} data-testid="renderer-overlay">
            {statusText}
          </p>
        )}
      </div>

      <p className={styles.status} data-testid="renderer-status">
        {statusText}
      </p>

      {/*
        Frame diagnostics: presentation-only facts written by the renderer, not by
        React. This is what makes "Babylon owns the frame loop" observable without
        putting frame state into React. It must never be announced.
      */}
      <p
        ref={diagnosticsRef}
        className="ps-visually-hidden"
        aria-hidden="true"
        data-testid="renderer-diagnostics"
      />
    </section>
  );
}

export function describeState(state: ViewportState): string {
  switch (state.kind) {
    case "idle":
      return "Survey view not started yet.";
    case "starting":
      return "Starting the 3D survey view…";
    case "ready":
      return `3D survey view running on ${state.backend.toUpperCase()}.`;
    case "unavailable":
      return state.reason;
    case "failed":
      return `The 3D survey view could not start: ${state.reason} Everything in the notebook still works.`;
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

/** Convenience for tests and diagnostics: probe the current environment. */
export function probeCapabilities(): CapabilityReport {
  return detectCapabilities(createBrowserProbeFromEnvironment());
}

function createBrowserProbeFromEnvironment() {
  // Kept behind a function so importing this module never touches the DOM.
  return {
    hasWebGPU: () => typeof navigator !== "undefined" && "gpu" in navigator,
    probeWebGL2: () => {
      if (typeof document === "undefined") return { supported: false, maxTextureSize: null };
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2");
      if (!context) return { supported: false, maxTextureSize: null };
      const maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE);
      return { supported: true, maxTextureSize: typeof maxTextureSize === "number" ? maxTextureSize : null };
    },
  };
}
