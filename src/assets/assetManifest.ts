/**
 * Runtime asset manifest and progressive-loading contract.
 *
 * Contract (docs/TECHNICAL_DESIGN.md §8):
 *  - shipping 3D assets are glTF 2.0 / GLB;
 *  - shipping textures prefer KTX2 / Basis Universal;
 *  - every shipping asset has a provenance id before it can ship;
 *  - loading is progressive: the first mission must not require the whole
 *    production asset set (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.3).
 *
 * PS-05 populates renderer placeholders. PS-10 replaces them with production
 * art. Generated placeholders carry `generated.*` provenance ids (D-34); the
 * shipping gate rejects `provenanceId: null`.
 */

import type { QualityProfileId } from "./qualityProfiles";

export type AssetKind = "mesh" | "texture" | "environment" | "audio" | "content";

export interface AssetEntry {
  /** Stable logical id used by code; never a raw file path. */
  readonly logicalId: string;
  readonly kind: AssetKind;
  /** Path relative to the build base. Must resolve under the nested version base. */
  readonly shippingPath: string;
  /** Compressed transfer size in bytes, measured at build time. */
  readonly bytes: number;
  /** LOD variants ordered coarse-to-fine, or empty when not applicable. */
  readonly lodVariants: readonly string[];
  /** Tier below which this asset may be substituted by a coarser variant. */
  readonly minimumQuality: QualityProfileId | null;
  /**
   * Provenance manifest id. Required for every shipping asset. Generated
   * placeholders use a `generated.*` id (D-34); external art needs a full
   * provenance record before release.
   */
  readonly provenanceId: string;
}

export interface AssetManifest {
  readonly version: string;
  readonly generatedFrom: string;
  readonly assets: readonly AssetEntry[];
}

/**
 * The current manifest.
 *
 * Byte sizes come from `node scripts/generate-placeholder-assets.mjs`.
 */
export const ASSET_MANIFEST: AssetManifest = {
  version: "0.5.0",
  generatedFrom:
    "PS-05 placeholder pipeline: generated GLB/KTX2 bodies with generated.* provenance. PS-10 owns production art.",
  assets: [
    {
      logicalId: "body.placeholder.mesh",
      kind: "mesh",
      shippingPath: "assets/bodies/placeholder-body.glb",
      bytes: 19132,
      lodVariants: ["assets/bodies/placeholder-body-lod1.glb", "assets/bodies/placeholder-body.glb"],
      minimumQuality: null,
      provenanceId: "generated.ps05-placeholder-body",
    },
    {
      logicalId: "body.placeholder.mesh.lod1",
      kind: "mesh",
      shippingPath: "assets/bodies/placeholder-body-lod1.glb",
      bytes: 5816,
      lodVariants: [],
      minimumQuality: "reduced",
      provenanceId: "generated.ps05-placeholder-body-lod1",
    },
    {
      logicalId: "body.placeholder.albedo",
      kind: "texture",
      shippingPath: "assets/bodies/placeholder-albedo.ktx2",
      bytes: 260,
      lodVariants: [],
      minimumQuality: null,
      provenanceId: "generated.ps05-placeholder-albedo",
    },
  ],
};

export function assetsOfKind(kind: AssetKind): readonly AssetEntry[] {
  return ASSET_MANIFEST.assets.filter((asset) => asset.kind === kind);
}

export function findAsset(logicalId: string): AssetEntry | undefined {
  return ASSET_MANIFEST.assets.find((asset) => asset.logicalId === logicalId);
}

/**
 * Choose the mesh shipping path for a quality tier.
 *
 * Reduced prefers the coarse LOD when registered; higher tiers use the fine mesh.
 */
export function meshPathForQuality(
  mesh: AssetEntry,
  quality: QualityProfileId,
): string {
  if (quality === "reduced" && mesh.lodVariants.length > 0) {
    return mesh.lodVariants[0] ?? mesh.shippingPath;
  }
  if (mesh.lodVariants.length > 1) {
    return mesh.lodVariants[mesh.lodVariants.length - 1] ?? mesh.shippingPath;
  }
  return mesh.shippingPath;
}

/**
 * Resolve an asset's runtime URL beneath the build base.
 *
 * The base is passed in rather than read from the bundler so this stays pure and
 * testable, and so a caller cannot accidentally bypass the version prefix with a
 * root-relative path (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §8).
 */
export function resolveAssetUrl(asset: AssetEntry, base: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const path = asset.shippingPath.replace(/^\/+/, "");
  return `${normalizedBase}${path}`;
}

export function resolveShippingPathUrl(shippingPath: string, base: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const path = shippingPath.replace(/^\/+/, "");
  return `${normalizedBase}${path}`;
}

/**
 * Reject an asset reference that could escape the version base.
 *
 * Used by `scripts/check-asset-pipeline.mjs` and by tests, so the rule is
 * enforced mechanically rather than by convention.
 */
export function isSafeShippingPath(shippingPath: string): boolean {
  if (!shippingPath || shippingPath.startsWith("/") || shippingPath.includes("\\")) {
    return false;
  }
  return shippingPath
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}
