/**
 * Babylon scene construction.
 *
 * Everything here is PRESENTATION. The scene never decides how large a world is;
 * it draws what `RenderSnapshot` tells it to draw. There are no scientific values
 * in this file, and there must never be (docs/TECHNICAL_DESIGN.md §4.4).
 *
 * PS-05 replaces the PS-02 reference sphere with the authored planetary pipeline:
 * PBR materials, IBL lighting, optional atmosphere shell, GLB/KTX2 body loading,
 * and curated camera modes.
 */

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Scene } from "@babylonjs/core/scene";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";

import type { QualityProfile } from "@/assets/qualityProfiles";
import type { CameraMode, RenderSnapshot } from "@/domain/renderSnapshot";

import { loadPlaceholderBody, type LoadedBody } from "./assets";
import { applyCameraMode, resetCameraToMode } from "./cameraModes";

export interface SceneHandles {
  readonly camera: ArcRotateCamera;
  readonly keyLight: DirectionalLight;
  readonly fillLight: HemisphericLight;
  readonly fallbackBody: Mesh;
  readonly atmosphereShell: Mesh;
  readonly companionBodies: readonly Mesh[];
  applySnapshot(snapshot: RenderSnapshot, reducedMotion: boolean): void;
  resetCamera(reducedMotion: boolean): void;
  setQuality(profile: QualityProfile, reducedMotion: boolean): void;
  /** Kick off progressive body loading; safe to call repeatedly. */
  ensureBodyLoaded(qualityId: QualityProfile["id"]): Promise<readonly string[]>;
  disposeLoadedBody(): void;
}

/**
 * Build the survey scene.
 *
 * Camera notes: an `ArcRotateCamera` is used deliberately. v1 navigation is
 * curated approach/orbit/inspection around a single body placed at the scene
 * origin, so neither a geospatial camera nor floating-origin precision
 * infrastructure is warranted (docs/TECHNICAL_DESIGN.md §5).
 */
export function buildScene(scene: Scene, profile: QualityProfile): SceneHandles {
  scene.clearColor = new Color4(0.031, 0.04, 0.055, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.environmentIntensity = 0.85;

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
  neutralizeCanvasTabStop(renderingCanvas);
  camera.lowerRadiusLimit = 1.6;
  camera.upperRadiusLimit = 12;
  camera.wheelDeltaPercentage = 0.02;
  camera.minZ = 0.05;

  const keyLight = new DirectionalLight("key-light", new Vector3(-1, -0.4, 1), scene);
  keyLight.intensity = 2.2;
  keyLight.position = new Vector3(4, 6, -3);

  const fillLight = new HemisphericLight("fill-light", new Vector3(0, 1, 0), scene);
  fillLight.intensity = 0.35;
  fillLight.diffuse = new Color3(0.55, 0.62, 0.8);

  // Calm procedural IBL stand-in: a low-cost environment colour so PBR has a
  // reflection context without shipping a large HDR for the foundation gate.
  scene.ambientColor = new Color3(0.08, 0.09, 0.12);

  const fallbackBody = CreateSphere("fallback-body", { diameter: 2, segments: 48 }, scene);
  const fallbackMaterial = new PBRMaterial("fallback-pbr", scene);
  fallbackMaterial.albedoColor = new Color3(0.36, 0.44, 0.58);
  fallbackMaterial.metallic = 0.05;
  fallbackMaterial.roughness = 0.72;
  fallbackBody.material = fallbackMaterial;
  fallbackBody.isPickable = false;

  const atmosphereShell = CreateSphere("atmosphere-shell", { diameter: 2.18, segments: 32 }, scene);
  const atmosphereMaterial = new PBRMaterial("atmosphere-pbr", scene);
  atmosphereMaterial.albedoColor = new Color3(0.45, 0.65, 0.95);
  atmosphereMaterial.alpha = 0.18;
  atmosphereMaterial.metallic = 0;
  atmosphereMaterial.roughness = 1;
  atmosphereMaterial.backFaceCulling = false;
  atmosphereShell.material = atmosphereMaterial;
  atmosphereShell.isPickable = false;
  atmosphereShell.setEnabled(false);

  // System-comparison companions: non-literal relative sizes, never measurements.
  const companionBodies = [0.55, 0.85, 1.15].map((scale, index) => {
    const mesh = CreateSphere(`companion-${index}`, { diameter: 2 * scale, segments: 24 }, scene);
    const material = new PBRMaterial(`companion-pbr-${index}`, scene);
    material.albedoColor = new Color3(0.28 + index * 0.08, 0.34, 0.48);
    material.metallic = 0.04;
    material.roughness = 0.8;
    mesh.material = material;
    mesh.position = new Vector3((index - 1) * 3.2, 0, 0);
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return mesh;
  });

  let shadowGenerator: ShadowGenerator | null = null;
  let pipeline: DefaultRenderingPipeline | null = null;
  let loadedBody: LoadedBody | null = null;
  let loadInFlight: Promise<readonly string[]> | null = null;
  let currentMode: CameraMode = "orbit";
  let lastPresentationMode: RenderSnapshot["presentation"]["mode"] | null = null;
  let activeProfile: QualityProfile = profile;

  const handles: SceneHandles = {
    camera,
    keyLight,
    fillLight,
    fallbackBody,
    atmosphereShell,
    companionBodies,
    applySnapshot(snapshot: RenderSnapshot, reducedMotion: boolean): void {
      const mode = snapshot.presentation.cameraMode;
      const modeChanged = mode !== currentMode;
      currentMode = mode;

      const isSystem = snapshot.presentation.mode === "systemComparison";
      const isBody = snapshot.presentation.mode === "body";
      const isReference = snapshot.presentation.mode === "reference";

      for (const companion of companionBodies) {
        companion.setEnabled(isSystem);
      }

      const showLoaded = Boolean(loadedBody) && (isBody || isSystem);
      if (loadedBody) {
        for (const mesh of loadedBody.meshes) {
          mesh.setEnabled(showLoaded && isBody);
        }
        // In system comparison the loaded mesh becomes the centre companion substitute.
        if (isSystem) {
          loadedBody.root.setEnabled(true);
          loadedBody.root.position = Vector3.Zero();
          loadedBody.root.scaling.setAll(1);
        } else if (isBody) {
          loadedBody.root.position = Vector3.Zero();
          loadedBody.root.scaling.setAll(1);
        }
      }

      fallbackBody.setEnabled((!loadedBody && (isBody || isReference)) || (isReference && !isSystem));
      if (isSystem && !loadedBody) {
        fallbackBody.setEnabled(true);
        fallbackBody.position = Vector3.Zero();
      }

      const wantsAtmosphere =
        isBody &&
        snapshot.bodyAvailableAttributes.includes("atmosphereDepth") &&
        activeProfile.atmosphereQuality !== "simplified";
      atmosphereShell.setEnabled(wantsAtmosphere);

      if (modeChanged || lastPresentationMode !== snapshot.presentation.mode) {
        applyCameraMode({ camera, scene, mode, reducedMotion });
      }
      lastPresentationMode = snapshot.presentation.mode;
    },
    resetCamera(reducedMotion: boolean): void {
      resetCameraToMode(camera, scene, currentMode, reducedMotion);
    },
    setQuality(next: QualityProfile, reducedMotion: boolean): void {
      activeProfile = next;
      applyQuality(next, handles, scene, {
        getShadowGenerator: () => shadowGenerator,
        setShadowGenerator: (value) => {
          shadowGenerator = value;
        },
        getPipeline: () => pipeline,
        setPipeline: (value) => {
          pipeline = value;
        },
        loadedMeshes: loadedBody?.meshes ?? [],
        reducedMotion,
      });
    },
    async ensureBodyLoaded(qualityId): Promise<readonly string[]> {
      if (loadedBody) return [];
      if (loadInFlight) return loadInFlight;
      loadInFlight = (async () => {
        const result = await loadPlaceholderBody(scene, qualityId);
        if (result.body) {
          loadedBody = result.body;
          fallbackBody.setEnabled(false);
          if (shadowGenerator) {
            for (const mesh of result.body.meshes) {
              shadowGenerator.addShadowCaster(mesh as Mesh);
              mesh.receiveShadows = true;
            }
          }
        }
        loadInFlight = null;
        return result.notes;
      })();
      return loadInFlight;
    },
    disposeLoadedBody(): void {
      loadedBody?.dispose();
      loadedBody = null;
      loadInFlight = null;
    },
  };

  applyQuality(profile, handles, scene, {
    getShadowGenerator: () => shadowGenerator,
    setShadowGenerator: (value) => {
      shadowGenerator = value;
    },
    getPipeline: () => pipeline,
    setPipeline: (value) => {
      pipeline = value;
    },
    loadedMeshes: [],
    reducedMotion: false,
  });

  return handles;
}

/**
 * Remove the canvas from the keyboard tab order.
 *
 * Exported so the rule is explicit and testable, and so accessible camera
 * controls (not the canvas) hold focus.
 */
export function neutralizeCanvasTabStop(canvas: HTMLElement | null): void {
  if (!canvas) return;
  canvas.setAttribute("tabindex", "-1");
  canvas.setAttribute("focusable", "false");
}

interface QualityContext {
  getShadowGenerator(): ShadowGenerator | null;
  setShadowGenerator(value: ShadowGenerator | null): void;
  getPipeline(): DefaultRenderingPipeline | null;
  setPipeline(value: DefaultRenderingPipeline | null): void;
  loadedMeshes: readonly AbstractMesh[];
  reducedMotion: boolean;
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
  context?: QualityContext,
): void {
  const scale = profile.renderScale;
  scene.getEngine().setHardwareScalingLevel(1 / Math.max(0.5, Math.min(1, scale)));

  switch (profile.atmosphereQuality) {
    case "full":
      handles.fillLight.intensity = 0.35;
      if (handles.atmosphereShell.material instanceof PBRMaterial) {
        handles.atmosphereShell.material.alpha = 0.22;
      }
      break;
    case "reduced":
      handles.fillLight.intensity = 0.45;
      if (handles.atmosphereShell.material instanceof PBRMaterial) {
        handles.atmosphereShell.material.alpha = 0.14;
      }
      break;
    case "simplified":
      handles.fillLight.intensity = 0.6;
      handles.atmosphereShell.setEnabled(false);
      break;
    default: {
      const unreachable: never = profile.atmosphereQuality;
      throw new Error(`Unhandled atmosphere quality: ${String(unreachable)}`);
    }
  }

  handles.keyLight.intensity = profile.shadows ? 2.2 : 1.9;
  handles.fallbackBody.receiveShadows = profile.shadows;

  if (!context) return;

  if (profile.shadows) {
    let generator = context.getShadowGenerator();
    if (!generator) {
      generator = new ShadowGenerator(1024, handles.keyLight);
      generator.useBlurExponentialShadowMap = true;
      generator.addShadowCaster(handles.fallbackBody);
      context.setShadowGenerator(generator);
    }
    for (const mesh of context.loadedMeshes) {
      generator.addShadowCaster(mesh as Mesh);
      mesh.receiveShadows = true;
    }
  } else {
    const existing = context.getShadowGenerator();
    existing?.dispose();
    context.setShadowGenerator(null);
  }

  if (profile.postProcessing && !context.reducedMotion) {
    let pipeline = context.getPipeline();
    if (!pipeline) {
      pipeline = new DefaultRenderingPipeline("survey-pipeline", true, scene, [handles.camera]);
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = false;
      pipeline.imageProcessingEnabled = true;
      context.setPipeline(pipeline);
    }
  } else {
    const existing = context.getPipeline();
    existing?.dispose();
    context.setPipeline(null);
  }
}
