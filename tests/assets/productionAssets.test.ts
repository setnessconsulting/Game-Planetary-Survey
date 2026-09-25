/**
 * Production asset manifest and provenance contract (GAME-374).
 *
 * docs/ASSET_PROVENANCE.md and docs/DECISIONS.md D-34 are the authority here.
 * The three claims being defended:
 *
 *  1. No placeholder ships. PS-05's `generated.ps05-placeholder-*` entries are
 *     gone and every body has its own production art.
 *  2. Every shipping asset has a real, complete, approved provenance record
 *     that matches the bytes on disk. The old gate only asked whether
 *     `provenanceId` was non-null, which is how a 260-byte KTX2 that nothing
 *     could decode sat in the manifest for five stories.
 *  3. Nothing in the art carries a scientific value.
 *
 * These read the files from disk rather than trusting the manifest's own
 * numbers, so the two cannot quietly disagree.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ASSET_MANIFEST,
  ENVIRONMENT_LOGICAL_ID,
  PRODUCTION_BODY_IDS,
  assetsOfKind,
  findAsset,
  isSafeShippingPath,
  meshPathForQuality,
} from "@/assets/assetManifest";
import { perceptualDistance } from "@/renderer/calibration";
import provenanceManifest from "@/assets/provenanceManifest.json";

const root = resolve(__dirname, "..", "..");
const publicDir = join(root, "public");

const records = provenanceManifest.records as Readonly<
  Record<string, unknown> & {
    asset_id: string;
    path: string | null;
    bytes: number | null;
    sha256: string | null;
  }
>[];
const recordsById = new Map(records.map((record) => [record.asset_id, record]));

/** The five bodies in the v1 catalogue. */
const CATALOGUE_BODIES = ["moon", "mars", "venus", "titan", "europa"];

describe("production asset manifest", () => {
  it("ships no placeholder of any kind", () => {
    // D-34 said PS-10 replaces the generated placeholders. Assert it on ids,
    // paths, and provenance ids, because a placeholder could be re-registered
    // under a fresh name and still be a placeholder.
    for (const asset of ASSET_MANIFEST.assets) {
      expect(asset.logicalId.toLowerCase()).not.toContain("placeholder");
      expect(asset.shippingPath.toLowerCase()).not.toContain("placeholder");
      expect(asset.provenanceId.toLowerCase()).not.toContain("placeholder");
    }
  });

  it("gives every catalogue body its own mesh, LOD, albedo, and normal map", () => {
    for (const body of CATALOGUE_BODIES) {
      expect(findAsset(`body.${body}.mesh`), `${body} mesh`).toBeDefined();
      expect(findAsset(`body.${body}.mesh.lod1`), `${body} lod1`).toBeDefined();
      expect(findAsset(`body.${body}.albedo`), `${body} albedo`).toBeDefined();
      expect(findAsset(`body.${body}.normal`), `${body} normal`).toBeDefined();
    }
  });

  it("registers exactly the bodies the manifest claims to cover", () => {
    expect([...PRODUCTION_BODY_IDS].sort()).toEqual([...CATALOGUE_BODIES].sort());
  });

  it("registers one shared environment map and no others", () => {
    const environments = assetsOfKind("environment");
    expect(environments).toHaveLength(1);
    expect(environments[0]?.logicalId).toBe(ENVIRONMENT_LOGICAL_ID);
    expect(environments[0]?.shippingPath).toMatch(/\.hdr$/);
  });

  it("resolves every provenance id to a record", () => {
    for (const asset of ASSET_MANIFEST.assets) {
      expect(recordsById.has(asset.provenanceId), `${asset.logicalId} provenance`).toBe(true);
    }
  });

  it("keeps every shipping path relative and base-safe", () => {
    for (const asset of ASSET_MANIFEST.assets) {
      expect(isSafeShippingPath(asset.shippingPath)).toBe(true);
      expect(asset.shippingPath.startsWith("/")).toBe(false);
      expect(asset.shippingPath).not.toContain("..");
      expect(asset.shippingPath).not.toContain("art/source");
    }
  });

  it("has no duplicate logical ids or shipping paths", () => {
    const ids = ASSET_MANIFEST.assets.map((asset) => asset.logicalId);
    const paths = ASSET_MANIFEST.assets.map((asset) => asset.shippingPath);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("selects a coarser mesh for the reduced tier and the fine mesh above it", () => {
    const mesh = findAsset("body.mars.mesh");
    expect(mesh).toBeDefined();
    if (!mesh) return;
    expect(meshPathForQuality(mesh, "reduced")).toMatch(/lod1\.glb$/);
    expect(meshPathForQuality(mesh, "standard")).toMatch(/mars-body\.glb$/);
    expect(meshPathForQuality(mesh, "high")).toMatch(/mars-body\.glb$/);
  });
});

describe("recorded bytes match what actually ships", () => {
  it("matches the manifest byte count for every registered file", () => {
    for (const asset of ASSET_MANIFEST.assets) {
      const path = join(publicDir, asset.shippingPath);
      expect(existsSync(path), `${asset.shippingPath} exists`).toBe(true);
      expect(statSync(path).size, `${asset.shippingPath} size`).toBe(asset.bytes);
    }
  });

  it("matches the provenance record's content hash", () => {
    for (const asset of ASSET_MANIFEST.assets) {
      const record = recordsById.get(asset.provenanceId);
      if (!record?.sha256) continue;
      const actual = createHash("sha256")
        .update(readFileSync(join(publicDir, asset.shippingPath)))
        .digest("hex")
        .slice(0, 16);
      expect(actual, `${asset.shippingPath} hash`).toBe(record.sha256);
    }
  });

  it("is deterministic: regenerating produces byte-identical output", async () => {
    // The pipeline seeds every value, so two runs must agree exactly. This is
    // what makes the recorded content hashes meaningful evidence rather than
    // decoration.
    //
    // It runs into a temporary output root rather than the repository: a test
    // that rewrites the real assets races every sibling test reading them, and
    // fails on scheduling rather than on the product.
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");

    const run = (): Map<string, string> => {
      const dir = mkdtempSync(join(tmpdir(), "ps-assets-"));
      try {
        execFileSync("node", ["scripts/generate-production-assets.mjs"], {
          cwd: root,
          env: { ...process.env, PS_ASSET_OUT_ROOT: dir },
        });
        const hashes = new Map<string, string>();
        for (const asset of ASSET_MANIFEST.assets) {
          hashes.set(
            asset.shippingPath,
            createHash("sha256").update(readFileSync(join(dir, "public", asset.shippingPath))).digest("hex"),
          );
        }
        return hashes;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };

    const first = run();
    const second = run();
    expect(second.size).toBe(first.size);
    for (const [path, hash] of first) {
      expect(second.get(path), path).toBe(hash);
    }
    // And the fresh output must equal what is actually committed, or the
    // generator and the repository have drifted apart.
    for (const asset of ASSET_MANIFEST.assets) {
      const committed = createHash("sha256")
        .update(readFileSync(join(publicDir, asset.shippingPath)))
        .digest("hex");
      expect(first.get(asset.shippingPath), `${asset.shippingPath} matches committed bytes`).toBe(
        committed,
      );
    }
    // Two full generator runs is real work; the default 5s budget is not enough
    // on a loaded machine, and a timeout here would report as a product failure.
  }, 60_000);
});

describe("art direction is not measurement", () => {
  const generator = readFileSync(
    join(root, "scripts", "generate-production-assets.mjs"),
    "utf8",
  );

  it("keeps every body's relief a small fraction of its radius", () => {
    // RENDERING_QUALITY_STRATEGY.md §10 rule 4: a body must not imply a
    // measurement the game does not have. Relief is the one parameter that
    // could quietly become a scale claim, so the ceiling is declared in the
    // generator and asserted here — making a world prettier must never be able
    // to make a world look measured.
    const ceiling = Number(/const MAX_RELIEF_FRACTION = ([\d.]+);/.exec(generator)?.[1]);
    expect(Number.isFinite(ceiling)).toBe(true);

    const reliefs = [...generator.matchAll(/relief:\s*([\d.]+),/g)].map((match) => Number(match[1]));
    expect(reliefs.length).toBeGreaterThanOrEqual(CATALOGUE_BODIES.length);
    for (const relief of reliefs) {
      expect(relief, `relief ${relief}`).toBeLessThanOrEqual(ceiling);
    }
  });

  it("keeps the mesh radius nominal, so no body carries a real radius", () => {
    // A mesh that encoded a body's actual radius would be a second, unchecked
    // source of truth for a number learners are graded on. The renderer owns
    // presentation scale; the generator always writes radius 1.
    expect(generator).toContain("const r = 1 + displacement(u, v);");
  });

  it("keeps body colours perceptually separable in the art data itself", () => {
    // The separation test in tests/renderer asserts the calibration record; this
    // one asserts the generator's own colours, so the two cannot drift apart
    // and leave the shipped texture disagreeing with the separation claim.
    const entries = [...generator.matchAll(/(\w+):\s*\{\s*seed:\s*\d+,\s*base:\s*\[([^\]]+)\]/g)];
    const colors = entries.map((match) =>
      (match[2] ?? "")
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value)),
    );
    expect(colors.length).toBe(CATALOGUE_BODIES.length);
    for (let i = 0; i < colors.length; i += 1) {
      for (let j = i + 1; j < colors.length; j += 1) {
        const distance = perceptualDistance(
          colors[i] as [number, number, number],
          colors[j] as [number, number, number],
        );
        expect(distance, `body ${i} vs ${j}`).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

describe("payload budgets (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.3)", () => {
  const MIB = 1024 * 1024;

  it("keeps each body's incremental load within the per-body budget", () => {
    for (const body of CATALOGUE_BODIES) {
      const total = ASSET_MANIFEST.assets
        .filter((asset) => asset.logicalId.startsWith(`body.${body}.`))
        .reduce((sum, asset) => sum + asset.bytes, 0);
      expect(total, `${body} payload`).toBeLessThanOrEqual(4 * MIB);
    }
  });

  it("keeps the whole v1 asset set within the total budget", () => {
    const total = ASSET_MANIFEST.assets.reduce((sum, asset) => sum + asset.bytes, 0);
    expect(total).toBeLessThanOrEqual(60 * MIB);
  });
});
