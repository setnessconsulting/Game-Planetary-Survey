/**
 * The renderer controller: the single seam between the React shell and Babylon.
 *
 * THIS FILE OWNS THE FRAME LOOP. `engine.runRenderLoop` is called exactly once,
 * here. React mounts and disposes this controller and pushes typed
 * `RenderSnapshot`s into it; React never receives per-frame state and never
 * re-renders per frame (docs/TECHNICAL_DESIGN.md §4.1-§4.3).
 *
 * The diagnostics element below is how the frame loop is made OBSERVABLE without
 * React state: the controller writes frame facts straight into a DOM node it
 * owns. That keeps the boundary honest and gives the real-browser smoke test
 * something real to assert (tests/e2e/smoke.spec.ts).
 */

import { Scene } from "@babylonjs/core/scene";

import {
  qualityProfile,
  type QualityProfileId,
} from "@/assets/qualityProfiles";
import type { CapabilityReport, RendererBackend } from "@/platform/capabilities";
import type { CameraMode, RenderSnapshot } from "@/domain/renderSnapshot";

import { createEngineFor, RendererEngineError } from "./engine";
import { buildScene, type SceneHandles } from "./scene";

/**
 * Renderer-originated presentation facts.
 *
 * Every terminal event reports the backend the renderer SETTLED ON, because only
 * the renderer can confirm whether a usable WebGPU adapter exists. The capability
 * probe merely requests a backend (src/platform/capabilities.ts), and reporting a
 * request as if it were the running backend is a correctness defect, not a cosmetic
 * one — it would escalate quality on a machine that cannot use WebGPU.
 *
 * A `RenderEvent` may never carry a scientific value and may never be treated as
 * one (docs/TECHNICAL_DESIGN.md §4.3d). The app translates an event into a domain
 * intent only when the domain agrees the transition is legal.
 */
export type RendererEvent =
  | { readonly kind: "ready"; readonly backend: RendererBackend }
  | { readonly kind: "sceneReady"; readonly backend: RendererBackend }
  | { readonly kind: "targetApproached"; readonly cameraMode: CameraMode }
  | { readonly kind: "degraded"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string; readonly backend: RendererBackend };

export interface RendererController {
  readonly backend: RendererBackend;
  /** Push presentation state. Cheap, synchronous, and never triggers React work. */
  applySnapshot(snapshot: RenderSnapshot): void;
  setQuality(id: QualityProfileId, reducedMotion: boolean): void;
  /** Accessible camera reset / orientation recovery. */
  resetCamera(): void;
  /** Frames rendered so far. Diagnostics only. */
  frameCount(): number;
  /** Release every GPU and DOM resource this controller owns. */
  dispose(): void;
}

export interface RendererControllerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly capabilities: CapabilityReport;
  readonly quality: QualityProfileId;
  readonly reducedMotion: boolean;
  /** Optional element the controller writes frame diagnostics into. */
  readonly diagnostics?: HTMLElement | null;
  /** Notified once per meaningful renderer state change, never per frame. */
  readonly onEvent?: (event: RendererEvent) => void;
}

/** DOM writes happen at most this often, to keep the loop free of layout churn. */
const DIAGNOSTICS_INTERVAL_FRAMES = 10;

export async function createRendererController(
  options: RendererControllerOptions,
): Promise<RendererController> {
  const { canvas, capabilities, diagnostics = null, onEvent } = options;

  if (capabilities.backend === "unavailable") {
    const failure = new RendererEngineError(
      "This browser reports no usable WebGL2 or WebGPU backend.",
      "unavailable",
    );
    onEvent?.({ kind: "failed", reason: failure.message, backend: failure.backend });
    throw failure;
  }

  let engine;
  let backend: RendererBackend;
  const notes: string[] = [];
  try {
    const result = await createEngineFor({ canvas, backend: capabilities.backend, notes });
    engine = result.engine;
    backend = result.backend;
  } catch (error) {
    const failedBackend: RendererBackend =
      error instanceof RendererEngineError ? error.backend : capabilities.backend;
    const detail = error instanceof Error ? error.message : String(error);
    const reason = [detail, ...notes].join(" ");
    onEvent?.({ kind: "failed", reason, backend: failedBackend });
    throw error;
  }

  const scene = new Scene(engine);
  const handles: SceneHandles = buildScene(scene, qualityProfile(options.quality));

  let frames = 0;
  let disposed = false;
  let lastSnapshot: RenderSnapshot | null = null;
  let currentQuality: QualityProfileId = options.quality;
  let currentReducedMotion = options.reducedMotion;
  let lastCameraMode: CameraMode | null = null;
  let sceneReadyEmitted = false;

  const writeDiagnostics = (force: boolean): void => {
    if (!diagnostics) return;
    if (!force && frames % DIAGNOSTICS_INTERVAL_FRAMES !== 0) return;
    diagnostics.setAttribute("data-renderer-backend", backend);
    diagnostics.setAttribute("data-renderer-frames", String(frames));
    diagnostics.setAttribute("data-renderer-quality", currentQuality);
    diagnostics.setAttribute(
      "data-renderer-reference",
      lastSnapshot?.presentation.mode ?? "reference",
    );
    diagnostics.setAttribute(
      "data-renderer-camera",
      lastSnapshot?.presentation.cameraMode ?? "orbit",
    );
    diagnostics.setAttribute(
      "data-renderer-scale",
      lastSnapshot?.presentation.scaleMode ?? "bodyRelative",
    );
  };

  engine.runRenderLoop(() => {
    if (disposed) return;
    scene.render();
    frames += 1;
    writeDiagnostics(false);
  });

  if (engine.onContextLostObservable) {
    engine.onContextLostObservable.add(() => {
      onEvent?.({
        kind: "degraded",
        reason:
          "The 3D context was lost. The evidence notebook and data tables still work; reload to restore the camera.",
      });
    });
  }

  writeDiagnostics(true);
  onEvent?.({ kind: "ready", backend });
  for (const note of notes) {
    onEvent?.({ kind: "degraded", reason: note });
  }

  // Progressive first-mission body load.
  void handles.ensureBodyLoaded(currentQuality).then((loadNotes) => {
    if (disposed) return;
    for (const note of loadNotes) {
      onEvent?.({ kind: "degraded", reason: note });
    }
    if (!sceneReadyEmitted) {
      sceneReadyEmitted = true;
      onEvent?.({ kind: "sceneReady", backend });
    }
    if (lastSnapshot) {
      handles.applySnapshot(lastSnapshot, currentReducedMotion);
      writeDiagnostics(true);
    }
  });

  return {
    backend,
    applySnapshot: (snapshot: RenderSnapshot): void => {
      if (disposed) return;
      lastSnapshot = snapshot;
      handles.applySnapshot(snapshot, currentReducedMotion);
      if (lastCameraMode !== null && lastCameraMode !== snapshot.presentation.cameraMode) {
        // Approach/orbit/inspection transitions are presentation facts the shell may
        // announce; they never carry a measurement.
        if (snapshot.presentation.cameraMode === "inspection") {
          onEvent?.({ kind: "targetApproached", cameraMode: snapshot.presentation.cameraMode });
        }
      }
      lastCameraMode = snapshot.presentation.cameraMode;
      writeDiagnostics(true);
    },
    setQuality: (id: QualityProfileId, reducedMotion: boolean): void => {
      if (disposed) return;
      currentQuality = id;
      currentReducedMotion = reducedMotion;
      handles.setQuality(qualityProfile(id), reducedMotion);
      writeDiagnostics(true);
    },
    resetCamera: (): void => {
      if (disposed) return;
      handles.resetCamera(currentReducedMotion);
      writeDiagnostics(true);
    },
    frameCount: (): number => frames,
    dispose: (): void => {
      if (disposed) return;
      disposed = true;
      engine.stopRenderLoop();
      handles.disposeLoadedBody();
      scene.dispose();
      engine.dispose();
      if (diagnostics) {
        diagnostics.removeAttribute("data-renderer-backend");
        diagnostics.removeAttribute("data-renderer-frames");
        diagnostics.removeAttribute("data-renderer-quality");
        diagnostics.removeAttribute("data-renderer-reference");
        diagnostics.removeAttribute("data-renderer-camera");
        diagnostics.removeAttribute("data-renderer-scale");
      }
    },
  };
}
