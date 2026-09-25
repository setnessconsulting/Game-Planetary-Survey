/**
 * Renderer layer — the Babylon presentation/input adapter.
 *
 * The UI may import ONLY from this barrel, and only the controller seam. It must
 * never import `@babylonjs/*` directly, and it must never own the frame loop
 * (docs/TECHNICAL_DESIGN.md §4, enforced by eslint.config.mjs and
 * scripts/check-architecture.mjs).
 */

export {
  createRendererController,
  type RendererController,
  type RendererControllerOptions,
  type RendererEvent,
} from "./controller";
export { RendererEngineError, type EngineInitResult } from "./engine";
export { applyQuality, buildScene, neutralizeCanvasTabStop, type SceneHandles } from "./scene";
export { applyCameraMode, poseFor, resetCameraToMode, CAMERA_TRANSITION_MS } from "./cameraModes";
