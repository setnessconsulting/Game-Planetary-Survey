/**
 * Babylon scene construction.
 *
 * Everything here is PRESENTATION. The scene never decides how large a world is;
 * it draws what `RenderSnapshot` tells it to draw. There are no scientific values
 * in this file, and there must never be (docs/TECHNICAL_DESIGN.md §4.4).
 *
 * PS-02 renders a deliberately un-scientific "reference sphere": no mission body
 * is loaded and no measurement is implied. It exists to prove the renderer
 * initializes, owns the frame loop, and responds to typed snapshots. PS-05
 * replaces it with the authored planetary pipeline.
 */

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

import type { QualityProfile } from "@/assets/qualityProfiles";

export interface SceneHandles {
  readonly camera: ArcRotateCamera;
  readonly referenceBody: Mesh;
  readonly keyLight: DirectionalLight;
  readonly fillLight: HemisphericLight;
}

/**
 * Build the reference scene.
 *
 * Camera notes: an `ArcRotateCamera` is used deliberately. v1 navigation is
 * curated approach/orbit/inspection around a single body placed at the scene
 * origin, so neither a geospatial camera nor floating-origin precision
 * infrastructure is warranted (docs/TECHNICAL_DESIGN.md §5). Keeping the body at
 * the origin is what makes the curated approach exact rather than approximately
 * scaled.
 */
export function buildScene(scene: Scene, profile: QualityProfile): SceneHandles {
  const camera = new ArcRotateCamera(
    "survey-camera",
    -Math.PI / 2,
    Math.PI / 2.6,
    3.2,
    Vector3.Zero(),
    scene,
  );
  const renderingCanvas = scene.getEngine().getRenderingCanvas();
  camera.attachControl(renderingCanvas, true);

  // Babylon's `attachControl` makes the canvas focusable (it sets tabindex="1")
  // so it can receive keyboard input. That is wrong here on two counts, and both
  // are real accessibility defects rather than style preferences:
  //   1. the canvas is decorative (aria-hidden), and an aria-hidden element must
  //      not be focusable (WCAG 4.1.2 / axe `aria-hidden-focus`);
  //   2. it would capture Tab away from the semantic mission controls, which are
  //      the required, keyboard-operable route to every measurement
  //      (docs/ACCESSIBILITY.md A-1, §4).
  // Camera keyboard control therefore belongs to explicit semantic controls, which
  // PS-05 adds; until then the viewport is deliberately pointer/touch-driven only.
  neutralizeCanvasTabStop(renderingCanvas);
  camera.lowerRadiusLimit = 1.6;
  camera.upperRadiusLimit = 12;
  camera.wheelDeltaPercentage = 0.02;
  camera.minZ = 0.05;

  const keyLight = new DirectionalLight("key-light", new Vector3(-1, -0.4, 1), scene);
  keyLight.intensity = 2.2;

  const fillLight = new HemisphericLight("fill-light", new Vector3(0, 1, 0), scene);
  fillLight.intensity = 0.35;
  fillLight.diffuse = new Color3(0.55, 0.62, 0.8);

  // A neutral, plainly non-scientific reference body. It is not a planet, has no
  // texture implying a real surface, and is labelled as a reference in the UI.
  const referenceBody = CreateSphere("reference-body", { diameter: 2, segments: 48 }, scene);
  const material = new StandardMaterial("reference-material", scene);
  material.diffuseColor = new Color3(0.36, 0.44, 0.58);
  material.specularColor = new Color3(0.12, 0.12, 0.14);
  material.roughness = 0.85;
  referenceBody.material = material;
  referenceBody.isPickable = false;

  applyQuality(profile, { camera, referenceBody, keyLight, fillLight }, scene);

  return { camera, referenceBody, keyLight, fillLight };
}

/**
 * Remove the canvas from the keyboard tab order.
 *
 * Exported so the rule is explicit and testable, and so PS-05 can revisit it when
 * accessible camera controls exist (at which point the controls, not the canvas,
 * should hold focus).
 */
export function neutralizeCanvasTabStop(canvas: HTMLElement | null): void {
  if (!canvas) return;
  canvas.setAttribute("tabindex", "-1");
  canvas.setAttribute("focusable", "false");
}

/**
 * Apply a quality profile to the scene.
 *
 * Only presentation cost changes. Nothing here can alter a learner-visible value,
 * because no scientific value exists in the renderer at all.
 */
export function applyQuality(
  profile: QualityProfile,
  handles: SceneHandles,
  scene: Scene,
): void {
  handles.referenceBody.receiveShadows = profile.shadows;

  const scale = profile.renderScale;
  scene.getEngine().setHardwareScalingLevel(1 / Math.max(0.5, Math.min(1, scale)));

  switch (profile.atmosphereQuality) {
    case "full":
      handles.fillLight.intensity = 0.35;
      break;
    case "reduced":
      handles.fillLight.intensity = 0.45;
      break;
    case "simplified":
      handles.fillLight.intensity = 0.6;
      break;
    default: {
      const unreachable: never = profile.atmosphereQuality;
      throw new Error(`Unhandled atmosphere quality: ${String(unreachable)}`);
    }
  }

  handles.keyLight.intensity = profile.shadows ? 2.2 : 1.9;
}
