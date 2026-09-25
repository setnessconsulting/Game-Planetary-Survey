/**
 * Curated camera modes for the planetary navigation pipeline.
 *
 * system comparison → approach → orbit → inspection
 * (docs/RENDERING_QUALITY_STRATEGY.md §2, docs/TECHNICAL_DESIGN.md §5).
 *
 * No GeospatialCamera and no floating origin: the active body sits at the scene
 * origin (D-06). Transitions are presentation-only and never alter measurements.
 */

import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Scene } from "@babylonjs/core/scene";

import type { CameraMode } from "@/domain/renderSnapshot";
import { MOTION_TOKENS, cameraTransitionMs } from "@/design/motion";

export interface CameraPose {
  readonly alpha: number;
  readonly beta: number;
  readonly radius: number;
}

const POSES: Readonly<Record<CameraMode, CameraPose>> = {
  systemComparison: { alpha: -Math.PI / 2, beta: Math.PI / 2.4, radius: 9.5 },
  approach: { alpha: -Math.PI / 2.2, beta: Math.PI / 2.5, radius: 5.5 },
  orbit: { alpha: -Math.PI / 2, beta: Math.PI / 2.6, radius: 3.2 },
  inspection: { alpha: -Math.PI / 1.7, beta: Math.PI / 2.8, radius: 2.1 },
};

/**
 * Camera motion duration, in milliseconds.
 *
 * This used to be a literal `900` here, which meant the product shipped two
 * camera-step durations: 900 ms in the viewport and 640 ms from
 * `--ps-motion-camera` in the stylesheet. It is now read from the design token
 * so the two cannot drift, and so editing the token actually moves the camera.
 *
 * The authored 640 ms also sits inside the <=1200 ms camera budget in
 * docs/PERFORMANCE_AND_DEVICE_BUDGETS.md, so following the token costs nothing.
 */
export const CAMERA_TRANSITION_MS = MOTION_TOKENS["--ps-motion-camera"].durationMs;

export function poseFor(mode: CameraMode): CameraPose {
  return POSES[mode];
}

export interface ApplyCameraOptions {
  readonly camera: ArcRotateCamera;
  readonly scene: Scene;
  readonly mode: CameraMode;
  readonly reducedMotion: boolean;
  /** When true, jump immediately even if motion is allowed. */
  readonly skipTransition?: boolean;
}

/**
 * Move the survey camera to the pose for `mode`.
 *
 * Reduced motion (and explicit skip) apply the end state immediately so the
 * learner always reaches the same framing without an interpolation loop.
 */
export function applyCameraMode(options: ApplyCameraOptions): void {
  const { camera, scene, mode, reducedMotion, skipTransition = false } = options;
  const pose = poseFor(mode);

  camera.lowerRadiusLimit = mode === "systemComparison" ? 4 : 1.6;
  camera.upperRadiusLimit = mode === "systemComparison" ? 14 : 12;

  if (reducedMotion || skipTransition) {
    camera.alpha = pose.alpha;
    camera.beta = pose.beta;
    camera.radius = pose.radius;
    return;
  }

  const frames = Math.max(1, Math.round((cameraTransitionMs(false) / 1000) * 60));
  animateNumber(camera, scene, "alpha", camera.alpha, pose.alpha, frames);
  animateNumber(camera, scene, "beta", camera.beta, pose.beta, frames);
  animateNumber(camera, scene, "radius", camera.radius, pose.radius, frames);
}

function animateNumber(
  camera: ArcRotateCamera,
  scene: Scene,
  property: "alpha" | "beta" | "radius",
  from: number,
  to: number,
  frames: number,
): void {
  const animation = new Animation(
    `camera-${property}`,
    property,
    60,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  animation.setKeys([
    { frame: 0, value: from },
    { frame: frames, value: to },
  ]);
  scene.beginDirectAnimation(camera, [animation], 0, frames, false);
}

/** Reset to the current mode's authored pose (accessible recovery). */
export function resetCameraToMode(
  camera: ArcRotateCamera,
  scene: Scene,
  mode: CameraMode,
  reducedMotion: boolean,
): void {
  applyCameraMode({ camera, scene, mode, reducedMotion, skipTransition: true });
}
