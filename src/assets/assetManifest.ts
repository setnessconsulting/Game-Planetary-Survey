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
 * PS-02 ships NO 3D assets and NO mission content. The manifest is empty on
 * purpose: this story establishes the structure and the guarantees, and PS-05 /
 * PS-10 populate it. An empty manifest with a real shape is better than invented
 * content, which GAME-364 explicitly forbids.
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
  /** Provenance manifest id. `null` is allowed only for generated placeholders. */
  readonly provenanceId: string | null;
}

export interface AssetManifest {
  readonly version: string;
  readonly generatedFrom: string;
  readonly assets: readonly AssetEntry[];
}

/**
 * The current manifest.
 *
 * `generatedFrom` records why it is empty, so a reader cannot mistake this for
 * a missing file.
 */
export const ASSET_MANIFEST: AssetManifest = {
  version: "0.1.0",
  generatedFrom:
    "PS-02 bootstrap: no shipping 3D or audio assets exist yet. PS-05 populates renderer assets; PS-10 populates production art, textures, and audio.",
  assets: [],
};

export function assetsOfKind(kind: AssetKind): readonly AssetEntry[] {
  return ASSET_MANIFEST.assets.filter((asset) => asset.kind === kind);
}

export function findAsset(logicalId: string): AssetEntry | undefined {
  return ASSET_MANIFEST.assets.find((asset) => asset.logicalId === logicalId);
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
