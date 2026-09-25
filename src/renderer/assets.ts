/**
 * Renderer asset loading.
 *
 * Loads GLB/glTF and KTX2 through the typed manifest. Uses Babylon loaders only —
 * this module never opens its own network or persistence surface; the loaders
 * own the transfer machinery (privacy surface).
 *
 * Progressive: the first mission body is loaded on demand; dispose releases GPU
 * resources when the target changes.
 */

import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
// Side-effect registration of the glTF loader.
import "@babylonjs/loaders/glTF/glTFFileLoader";

import {
  findAsset,
  meshPathForQuality,
  resolveShippingPathUrl,
  type AssetEntry,
} from "@/assets/assetManifest";
import type { QualityProfileId } from "@/assets/qualityProfiles";

export interface LoadedBody {
  readonly root: AbstractMesh;
  readonly meshes: readonly AbstractMesh[];
  dispose(): void;
}

export interface AssetLoadResult {
  readonly body: LoadedBody | null;
  readonly albedoApplied: boolean;
  readonly meshLogicalId: string;
  readonly shippingPath: string;
  readonly notes: readonly string[];
}

function importBase(): string {
  // Vite injects BASE_URL; keep a trailing slash for resolveAssetUrl.
  const base = import.meta.env.BASE_URL ?? "./";
  return base.endsWith("/") ? base : `${base}/`;
}

/**
 * Load the placeholder planetary body for the current quality tier.
 *
 * On failure returns notes and a null body so the scene can keep an honest
 * fallback mesh without inventing science.
 */
export async function loadPlaceholderBody(
  scene: Scene,
  quality: QualityProfileId,
): Promise<AssetLoadResult> {
  const notes: string[] = [];
  const meshAsset = findAsset("body.placeholder.mesh");
  if (!meshAsset) {
    return {
      body: null,
      albedoApplied: false,
      meshLogicalId: "body.placeholder.mesh",
      shippingPath: "",
      notes: ["Placeholder body mesh is missing from the asset manifest."],
    };
  }

  const shippingPath = meshPathForQuality(meshAsset, quality);
  const url = resolveShippingPathUrl(shippingPath, importBase());
  const lastSlash = url.lastIndexOf("/");
  const rootUrl = lastSlash >= 0 ? url.slice(0, lastSlash + 1) : importBase();
  const filename = lastSlash >= 0 ? url.slice(lastSlash + 1) : shippingPath;

  try {
    const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);
    const roots = result.meshes.filter((mesh) => !mesh.parent);
    const root = roots[0] ?? result.meshes[0];
    if (!root) {
      notes.push("GLB loaded but contained no meshes.");
      return {
        body: null,
        albedoApplied: false,
        meshLogicalId: meshAsset.logicalId,
        shippingPath,
        notes,
      };
    }

    for (const mesh of result.meshes) {
      mesh.isPickable = false;
    }

    let albedoApplied = false;
    const albedo = findAsset("body.placeholder.albedo");
    if (albedo) {
      albedoApplied = await tryApplyAlbedo(scene, result.meshes, albedo, notes);
    }

    // Ensure every mesh has a PBR material so quality/IBL have something to light.
    for (const mesh of result.meshes) {
      if (!mesh.material) {
        const material = new PBRMaterial(`pbr-${mesh.name}`, scene);
        material.albedoColor = new Color3(0.36, 0.44, 0.58);
        material.metallic = 0.05;
        material.roughness = 0.72;
        mesh.material = material;
      }
    }

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
      meshLogicalId: meshAsset.logicalId,
      shippingPath,
      notes,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    notes.push(`Failed to load body mesh: ${detail}`);
    return {
      body: null,
      albedoApplied: false,
      meshLogicalId: meshAsset.logicalId,
      shippingPath,
      notes,
    };
  }
}

async function tryApplyAlbedo(
  scene: Scene,
  meshes: readonly AbstractMesh[],
  albedo: AssetEntry,
  notes: string[],
): Promise<boolean> {
  const url = resolveShippingPathUrl(albedo.shippingPath, importBase());
  try {
    const texture = new Texture(url, scene, false, false);
    await new Promise<void>((resolve, reject) => {
      const timer = globalThis.setTimeout(
        () => reject(new Error("albedo texture load timed out")),
        8000,
      );
      texture.onLoadObservable.addOnce(() => {
        globalThis.clearTimeout(timer);
        resolve();
      });
    });
    for (const mesh of meshes) {
      const material = mesh.material;
      if (material instanceof PBRMaterial) {
        material.albedoTexture = texture;
      }
    }
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    notes.push(`KTX2 albedo not applied (${detail}); PBR colour fallback remains.`);
    return false;
  }
}
