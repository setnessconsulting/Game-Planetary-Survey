/**
 * Provenance record contract (GAME-374, docs/ASSET_PROVENANCE.md).
 *
 * The policy requires a specific field set on every non-code shipping asset and
 * makes three prohibitions release-blocking: unknown provenance, agency
 * material used without the asset-level review, and anything derived from a
 * comparator. PS-10 chose original procedural art precisely so that none of
 * those apply — and these tests are what makes the choice checkable rather than
 * a claim in a document.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ASSET_MANIFEST } from "@/assets/assetManifest";
import { ALL_CUE_IDS, CUE_INVENTORY } from "@/audio/cues";
import provenanceManifest from "@/assets/provenanceManifest.json";

const root = resolve(__dirname, "..", "..");

interface ProvenanceRecord {
  readonly asset_id: string;
  readonly path: string | null;
  readonly category: string;
  readonly creator: string;
  readonly creation_method: string;
  readonly source_reference: string;
  readonly license_rights_basis: string;
  readonly agency_origin: string;
  readonly usage_restrictions: {
    readonly attribution_required: boolean;
    readonly redistributable: boolean;
    readonly commercial_ok: boolean;
    readonly derivatives_ok: boolean;
  };
  readonly transformations: readonly string[];
  readonly tool: string;
  readonly tool_version: string;
  readonly source_artifact_reference: string;
  readonly scientific_claim_linkage: string;
  readonly bytes: number | null;
  readonly sha256: string | null;
  readonly reviewer: string;
  readonly review_date: string;
  readonly release_status: string;
}

const records = provenanceManifest.records as readonly ProvenanceRecord[];

/** The exact field list docs/ASSET_PROVENANCE.md specifies. */
const REQUIRED_FIELDS = [
  "asset_id",
  "category",
  "creator",
  "creation_method",
  "source_reference",
  "license_rights_basis",
  "agency_origin",
  "usage_restrictions",
  "transformations",
  "tool",
  "tool_version",
  "source_artifact_reference",
  "scientific_claim_linkage",
  "reviewer",
  "review_date",
  "release_status",
] as const;

describe("provenance manifest", () => {
  it("covers every shipping asset in the runtime manifest", () => {
    const ids = new Set(records.map((record) => record.asset_id));
    for (const asset of ASSET_MANIFEST.assets) {
      expect(ids.has(asset.provenanceId), asset.logicalId).toBe(true);
    }
  });

  it("has a complete record for every entry, with no empty required field", () => {
    for (const record of records) {
      for (const field of REQUIRED_FIELDS) {
        const value = record[field];
        expect(value, `${record.asset_id}.${field}`).toBeDefined();
        if (typeof value === "string") {
          expect(value.trim().length, `${record.asset_id}.${field}`).toBeGreaterThan(0);
        }
      }
      expect(record.transformations.length, `${record.asset_id} transformations`).toBeGreaterThan(0);
    }
  });

  it("states all four usage restrictions on every record", () => {
    for (const record of records) {
      for (const key of [
        "attribution_required",
        "redistributable",
        "commercial_ok",
        "derivatives_ok",
      ] as const) {
        expect(typeof record.usage_restrictions[key], `${record.asset_id}.${key}`).toBe(
          "boolean",
        );
      }
    }
  });

  it("approves every record, because only an approved record may ship", () => {
    for (const record of records) {
      expect(record.release_status, record.asset_id).toBe("approved");
    }
  });

  it("records no agency origin anywhere", () => {
    // An agency-derived asset needs the documented asset-level usage review and
    // is not something a generator can clear, so none may appear.
    for (const record of records) {
      expect(record.agency_origin, record.asset_id).toBe("none");
    }
  });

  it("links no asset to a scientific claim", () => {
    // RENDERING_QUALITY_STRATEGY.md §10 rule 6: imagery illustrates a sourced
    // value and is never its source. Procedural art is pure art direction, so
    // the only honest linkage is none.
    for (const record of records) {
      expect(record.scientific_claim_linkage, record.asset_id).toBe("none");
    }
  });

  it("creates everything itself, with no sampled or extracted material", () => {
    for (const record of records) {
      expect(record.creation_method, record.asset_id).toBe("generated");
    }
  });

  it("names no comparator, agency brand, or external product", () => {
    // docs/ASSET_PROVENANCE.md §Comparator boundary and §Branding boundary.
    // Scan the whole serialised manifest rather than a few fields, so a
    // reference hidden in a free-text field is still caught.
    const text = JSON.stringify(provenanceManifest).toLowerCase();
    for (const forbidden of [
      "universe sandbox",
      "kerbal",
      "spaceengine",
      "nasa",
      "jpl",
      "usgs",
      "esa",
      "blender foundation",
      "nssdc",
    ]) {
      expect(text, `provenance must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("audio provenance", () => {
  it("records a provenance entry for every cue, as the policy requires", () => {
    // docs/ASSET_PROVENANCE.md: audio must be "present in the provenance
    // manifest" even though these cues ship zero bytes.
    const ids = new Set(records.map((record) => record.asset_id));
    for (const cue of ALL_CUE_IDS) {
      expect(ids.has(`audio.${cue}`), `audio.${cue}`).toBe(true);
    }
  });

  it("records every cue as synthesised, with no shipped bytes and no file path", () => {
    for (const cue of ALL_CUE_IDS) {
      const record = records.find((candidate) => candidate.asset_id === `audio.${cue}`);
      expect(record, `audio.${cue}`).toBeDefined();
      expect(record?.path, `audio.${cue} path`).toBeNull();
      expect(record?.bytes, `audio.${cue} bytes`).toBe(0);
      expect(record?.creation_method, `audio.${cue} method`).toBe("generated");
    }
  });
});

describe("generator provenance", () => {
  it("points every regenerated asset at a script that still exists", () => {
    for (const record of records) {
      if (record.creation_method !== "generated") continue;
      const match = /^regenerate: node (scripts\/[\w.-]+)$/.exec(record.source_reference);
      if (!match?.[1]) continue;
      const path = join(root, match[1].replace(/\//g, "\\"));
      expect(existsSyncSafe(path), `${match[1]} referenced by ${record.asset_id}`).toBe(true);
    }
  });
});

function existsSyncSafe(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

describe("cue inventory cross-check", () => {
  it("keeps the manifest's cue list in step with the actual inventory", () => {
    // If a cue is added to CUE_INVENTORY without a provenance record, the
    // previous test fails. This one states the intent so the failure is legible.
    const provenanceCues = records
      .map((record) => record.asset_id)
      .filter((id) => id.startsWith("audio."))
      .map((id) => id.replace("audio.", ""));
    expect([...provenanceCues].sort()).toEqual([...ALL_CUE_IDS].sort());
    expect(Object.keys(CUE_INVENTORY).sort()).toEqual([...ALL_CUE_IDS].sort());
  });
});
