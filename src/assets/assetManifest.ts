/**
 * Runtime asset manifest and progressive-loading contract.
 *
 * Contract (docs/TECHNICAL_DESIGN.md §8):
 *  - shipping 3D assets are glTF 2.0 / GLB;
 *  - shipping textures are browser-decodable image formats;
 *  - every shipping asset has a provenance id before it can ship;
 *  - loading is progressive: the first mission must not require the whole
 *    production asset set (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.3).
 *
 * PS-10 replaced the PS-05 generated placeholders with production art. The
 * `generated.ps05-placeholder-*` entries are gone: no placeholder ships, and
 * `scripts/check-asset-pipeline.mjs` now fails the build if one reappears.
 *
 * THE MANIFEST IS DATA, NOT HAND-WRITTEN CODE.
 * `assetManifest.json` is emitted by `scripts/generate-production-assets.mjs`
 * from the same loop that wrote the bytes, and `provenanceManifest.json` is
 * emitted alongside it. This module validates that data and exports it typed.
 *
 * The previous version hand-wrote the entries and had the gate recover them
 * with regular expressions over the source text. That meant a template literal
 * or a factory function registered zero assets and nothing noticed, which is
 * how a 260-byte placeholder KTX2 could sit in the manifest for five stories
 * while never actually being decodable at runtime. Reading real values removes
 * that failure mode.
 *
 * Textures ship as PNG rather than KTX2. The contract *prefers*
 * KTX2/Basis (docs/RENDERING_QUALITY_STRATEGY.md §8), but the approved runtime
 * dependency set contains no KTX2 decoder, so a KTX2 texture cannot be decoded
 * in the browser at all. Shipping an undecodable texture is worse than shipping
 * a larger one that renders, so the deviation is recorded as a decision.
 */

import manifestJson from "./assetManifest.json";
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
   * Provenance manifest id. Required for every shipping asset.
   *
   * `scripts/check-asset-pipeline.mjs` resolves each id against
   * `provenanceManifest.json`; a dangling id is a build failure, not a warning.
   */
  readonly provenanceId: string;
}

export interface AssetManifest {
  readonly version: string;
  readonly generatedFrom: string;
  readonly assets: readonly AssetEntry[];
}

const KINDS: readonly AssetKind[] = ["mesh", "texture", "environment", "audio", "content"];
const QUALITY_IDS: readonly QualityProfileId[] = ["high", "standard", "reduced"];

interface RawEntry {
  logicalId?: unknown;
  kind?: unknown;
  shippingPath?: unknown;
  bytes?: unknown;
  lodVariants?: unknown;
  minimumQuality?: unknown;
  provenanceId?: unknown;
}

/**
 * Validate the generated manifest and narrow it.
 *
 * A malformed entry throws at module load rather than producing a scene that
 * silently falls back, because "the asset was missing" and "the manifest was
 * wrong" are very different bugs and only one of them is visible in a browser.
 */
function parseManifest(raw: unknown): AssetManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("assetManifest.json must be an object");
  }
  const doc = raw as { version?: unknown; generatedFrom?: unknown; assets?: unknown };
  if (typeof doc.version !== "string" || typeof doc.generatedFrom !== "string") {
    throw new Error("assetManifest.json is missing version/generatedFrom");
  }
  if (!Array.isArray(doc.assets)) {
    throw new Error("assetManifest.json is missing an assets array");
  }

  const assets: AssetEntry[] = doc.assets.map((entry: RawEntry, index: number) => {
    const where = `assetManifest.json entry ${index}`;
    if (typeof entry.logicalId !== "string" || entry.logicalId.length === 0) {
      throw new Error(`${where} has no logicalId`);
    }
    if (typeof entry.shippingPath !== "string" || entry.shippingPath.length === 0) {
      throw new Error(`${where} (${entry.logicalId}) has no shippingPath`);
    }
    if (typeof entry.provenanceId !== "string" || entry.provenanceId.length === 0) {
      throw new Error(
        `${where} (${entry.logicalId}) has no provenanceId; every shipping asset needs provenance.`,
      );
    }
    if (!KINDS.includes(entry.kind as AssetKind)) {
      throw new Error(`${where} (${entry.logicalId}) has an unknown kind "${String(entry.kind)}"`);
    }
    if (typeof entry.bytes !== "number" || !Number.isInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error(`${where} (${entry.logicalId}) has a non-integer byte count`);
    }
    if (!Array.isArray(entry.lodVariants)) {
      throw new Error(`${where} (${entry.logicalId}) has no lodVariants array`);
    }
    const minimumQuality = entry.minimumQuality;
    if (minimumQuality !== null && !QUALITY_IDS.includes(minimumQuality as QualityProfileId)) {
      throw new Error(
        `${where} (${entry.logicalId}) has an unknown minimumQuality "${String(minimumQuality)}"`,
      );
    }
    return {
      logicalId: entry.logicalId,
      kind: entry.kind as AssetKind,
      shippingPath: entry.shippingPath,
      bytes: entry.bytes,
      lodVariants: entry.lodVariants as string[],
      minimumQuality: minimumQuality as QualityProfileId | null,
      provenanceId: entry.provenanceId,
    };
  });

  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.logicalId)) {
      throw new Error(`assetManifest.json registers "${asset.logicalId}" twice`);
    }
    seen.add(asset.logicalId);
  }

  return { version: doc.version, generatedFrom: doc.generatedFrom, assets };
}

/**
 * Body ids that carry production art, read from the generated manifest so the
 * list can never disagree with what actually ships.
 */
function parseProductionBodyIds(): readonly string[] {
  const doc = manifestJson as { productionBodyIds?: unknown };
  if (!Array.isArray(doc.productionBodyIds)) {
    throw new Error("assetManifest.json is missing productionBodyIds");
  }
  return doc.productionBodyIds as string[];
}

export const ASSET_MANIFEST: AssetManifest = parseManifest(manifestJson);
export const PRODUCTION_BODY_IDS: readonly string[] = parseProductionBodyIds();

export function isProductionBodyId(value: string): boolean {
  return PRODUCTION_BODY_IDS.includes(value);
}

/** The environment map every body is lit by. Shared, loaded once. */
export const ENVIRONMENT_LOGICAL_ID = "environment.survey.hdr";

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
export function meshPathForQuality(mesh: AssetEntry, quality: QualityProfileId): string {
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
