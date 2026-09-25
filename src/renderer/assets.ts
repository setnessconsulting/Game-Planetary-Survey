/**
 * Renderer asset loading.
 *
 * Loads GLB/glTF meshes, shipping textures, and the HDR environment through the
 * typed manifest. Uses Babylon loaders only — this module never opens its own
 * network or persistence surface; the loaders own the transfer machinery
 * (privacy surface).
 *
 * Progressive: the current body is loaded on demand; dispose releases GPU
 * resources when the target changes. The first mission must become interactive
 * without downloading the whole production asset set
 * (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.3).
 *
 * PS-10 changed what "production art" means here. PS-05 loaded a single
 * generated placeholder sphere and one KTX2 albedo that, as it turned out,
 * nothing in the dependency set could decode — so every surface the slice ever
 * showed was the flat PBR colour fallback. Each body now has its own mesh, LOD,
 * albedo, and normal map, and failures are still reported rather than hidden.
 */

import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
// Side-effect registration of the glTF 2.0 loader.
//
// The `glTF/2.0/glTFLoader` entry point is the one that matters. Importing
// `glTF/glTFFileLoader` on its own registers only the file plugin: it never calls
// `RegisterGLTF2Loader()`, so `GLTFFileLoader._CreateGLTF2Loader` stays
// undefined and every `.glb` is rejected with
// "Unsupported version: 2.0". That is not a malformed-file error — the file
// parses perfectly — it is a missing factory, and it is silent until something
// actually tries to load a body.
import "@babylonjs/loaders/glTF/2.0/glTFLoader";

import {
  ENVIRONMENT_LOGICAL_ID,
  findAsset,
  meshPathForQuality,
  resolveShippingPathUrl,
  type AssetEntry,
} from "@/assets/assetManifest";
import type { QualityProfileId } from "@/assets/qualityProfiles";
import { materialForBody } from "./calibration";

export interface LoadedBody {
  readonly root: AbstractMesh;
  readonly meshes: readonly AbstractMesh[];
  dispose(): void;
}

export interface AssetLoadResult {
  readonly body: LoadedBody | null;
  readonly albedoApplied: boolean;
  readonly normalApplied: boolean;
  readonly meshLogicalId: string;
  readonly shippingPath: string;
  readonly notes: readonly string[];
}

function importBase(): string {
  // Vite injects BASE_URL; keep a trailing slash for resolveAssetUrl.
  const base = import.meta.env.BASE_URL ?? "./";
  return base.endsWith("/") ? base : `${base}/`;
}

/** Split a resolved URL into the (rootUrl, filename) pair SceneLoader wants. */
function splitUrl(url: string, fallbackRoot: string): { rootUrl: string; filename: string } {
  const lastSlash = url.lastIndexOf("/");
  return lastSlash >= 0
    ? { rootUrl: url.slice(0, lastSlash + 1), filename: url.slice(lastSlash + 1) }
    : { rootUrl: fallbackRoot, filename: url };
}

/**
 * Load the production art for one body at the current quality tier.
 *
 * On failure returns notes and a null body so the scene can keep an honest
 * fallback mesh without inventing science: a body that fails to load is shown
 * as an untextured sphere and says so, never as a plausible-looking planet.
 */
export async function loadSurveyBody(
  scene: Scene,
  quality: QualityProfileId,
  bodyId: string,
): Promise<AssetLoadResult> {
  const notes: string[] = [];
  const meshAsset = findAsset(`body.${bodyId}.mesh`);
  if (!meshAsset) {
    return {
      body: null,
      albedoApplied: false,
      normalApplied: false,
      meshLogicalId: `body.${bodyId}.mesh`,
      shippingPath: "",
      notes: [`No production mesh is registered for body "${bodyId}".`],
    };
  }

  const shippingPath = meshPathForQuality(meshAsset, quality);
  const url = resolveShippingPathUrl(shippingPath, importBase());
  const { rootUrl, filename } = splitUrl(url, importBase());

  try {
    const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);
    const roots = result.meshes.filter((mesh) => !mesh.parent);
    const root = roots[0] ?? result.meshes[0];
    if (!root) {
      notes.push("GLB loaded but contained no meshes.");
      return {
        body: null,
        albedoApplied: false,
        normalApplied: false,
        meshLogicalId: meshAsset.logicalId,
        shippingPath,
        notes,
      };
    }

    for (const mesh of result.meshes) {
      mesh.isPickable = false;
    }

    // Give every mesh a calibrated PBR material before textures arrive, so a
    // failed texture leaves a correct-shaped body rather than a default one.
    //
    // The materials are held in a list rather than rediscovered on the meshes
    // later. This module *creates* them, so keeping the reference is both simpler
    // and safer than an `instanceof` check: a type guard silently does nothing
    // if the bundle ever ends up with two copies of the Babylon module, and the
    // symptom is a body that renders with a flat fallback colour while every
    // asset reports as loaded.
    const calibration = materialForBody(bodyId);
    const materials: PBRMaterial[] = [];
    for (const mesh of result.meshes) {
      const material = new PBRMaterial(`pbr-${bodyId}-${mesh.name}`, scene);
      material.albedoColor = new Color3(...calibration.albedoTint);
      material.metallic = calibration.metallic;
      material.roughness = calibration.roughness;
      mesh.material = material;
      materials.push(material);
    }

    const albedoAsset = findAsset(`body.${bodyId}.albedo`);
    const albedoApplied = albedoAsset
      ? await tryApplyTexture(scene, materials, albedoAsset, "albedo", notes)
      : false;

    const normalAsset = findAsset(`body.${bodyId}.normal`);
    const normalApplied = normalAsset
      ? await tryApplyTexture(scene, materials, normalAsset, "normal", notes)
      : false;

    return {
      body: {
        root,
        meshes: result.meshes,
        dispose: () => {
          for (const mesh of result.meshes) {
            mesh.dispose(false, true);
          }
        },
      },
      albedoApplied,
      normalApplied,
      meshLogicalId: meshAsset.logicalId,
      shippingPath,
      notes,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    notes.push(`Failed to load body mesh for "${bodyId}": ${detail}`);
    return {
      body: null,
      albedoApplied: false,
      normalApplied: false,
      meshLogicalId: meshAsset.logicalId,
      shippingPath,
      notes,
    };
  }
}

/**
 * Load the shared HDR environment and prefilter it into an IBL.
 *
 * PS-05 shipped a flat ambient colour with a comment saying a real HDR was
 * deliberately deferred. docs/RENDERING_QUALITY_STRATEGY.md §3 approves
 * "HDR / prefiltered image-based lighting for environments where physically
 * sensible", so this is where that deferral ends. Prefiltering matters: an
 * unprefiltered equirect makes roughness meaningless, which would make the
 * per-body roughness in `calibration.ts` a decoration.
 *
 * Failure is non-fatal by design. A missing environment degrades the lighting
 * model but must never stop a learner from measuring a world, so the caller
 * gets a note and keeps the directional lights.
 */
export async function loadEnvironment(
  scene: Scene,
  notes: string[],
): Promise<HDRCubeTexture | null> {
  const asset = findAsset(ENVIRONMENT_LOGICAL_ID);
  if (!asset) {
    notes.push("No environment asset is registered; falling back to lights only.");
    return null;
  }
  const url = resolveShippingPathUrl(asset.shippingPath, importBase());
  try {
    const environment = await new Promise<HDRCubeTexture>((resolve, reject) => {
      const timer = globalThis.setTimeout(
        () => reject(new Error("environment HDR load timed out")),
        8000,
      );
      const texture = new HDRCubeTexture(
        url,
        scene,
        128,
        /* noMipmap */ false,
        /* generateHarmonics */ true,
        /* gammaSpace */ false,
        /* prefilterOnLoad */ true,
        () => {
          globalThis.clearTimeout(timer);
          resolve(texture);
        },
        (message) => {
          globalThis.clearTimeout(timer);
          reject(new Error(message ?? "environment HDR failed to load"));
        },
      );
    });
    scene.environmentTexture = environment;
    return environment;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    notes.push(`HDR environment not applied (${detail}); directional lights remain.`);
    return null;
  }
}

type TextureSlot = "albedo" | "normal";

/**
 * Load a shipping texture and bind it to the materials we created for the body.
 *
 * Readiness is checked *before* waiting as well as after. `new Texture(url)`
 * can finish decoding before `onLoadObservable` is subscribed — a real race when
 * the file is in the HTTP cache — and a listener attached only afterwards never
 * fires, so the await would sit until the timeout and report a texture as failed
 * that had in fact loaded. That is exactly the class of silent failure this
 * module exists to avoid.
 */
async function tryApplyTexture(
  scene: Scene,
  materials: readonly PBRMaterial[],
  asset: AssetEntry,
  slot: TextureSlot,
  notes: string[],
): Promise<boolean> {
  const url = resolveShippingPathUrl(asset.shippingPath, importBase());
  try {
    const texture = new Texture(url, scene, false, false);
    await new Promise<void>((resolve, reject) => {
      if (texture.isReady()) {
        resolve();
        return;
      }
      const timer = globalThis.setTimeout(
        () => reject(new Error("texture load timed out")),
        8000,
      );
      texture.onLoadObservable.addOnce(() => {
        globalThis.clearTimeout(timer);
        resolve();
      });
    });

    for (const material of materials) {
      if (slot === "albedo") {
        material.albedoTexture = texture;
        // The shipped albedo already carries the body's colour; the calibrated
        // tint is only a fallback for a failed load, so it must not double up.
        material.albedoColor = Color3.White();
      } else {
        material.bumpTexture = texture;
        material.bumpTexture.level = 0.8;
      }
    }
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    notes.push(
      `${slot} texture "${asset.shippingPath}" not applied (${detail}); calibrated colour remains.`,
    );
    return false;
  }
}
