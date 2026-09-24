/**
 * Shipped-content provenance tests (GAME-366 schemas, GAME-368 content).
 *
 * These tests are what make "every displayed value is traceable to an authority"
 * a property of the *shipped build* rather than a property of a fixture. They run
 * against `src/content/`, so a value that appears without a citation fails here.
 *
 * The distinction they defend hardest is `sourced` versus `reviewed`. PS-04
 * transcribed values from agency sources and machine-checked them for physical
 * plausibility; no human has independently reviewed the science. So the suite
 * pins the *implication* (reviewed content must have reviewed values) rather than
 * pinning "unreviewed", which would make the suite fail the day a reviewer signs
 * off instead of documenting that event.
 */

import { describe, expect, it } from "vitest";

import {
  CATALOGUE_SOURCE_REGISTER_VERSION,
  MISSIONS,
  PLANETARY_BODIES,
  PRESENTATION_DECLARATIONS,
  SIMPLIFICATION_REGISTER,
  SOURCE_REGISTER,
  SOURCE_REGISTER_RETRIEVED_ON,
  SOURCE_REGISTER_VERSION,
  catalogueIsPopulated,
  catalogueIsScienceReviewed,
  findBody,
  findMission,
} from "@/content";
import { MARS_ID, MOON_ID, SURVEY_BODY_IDS, VENUS_ID } from "@/content/bodies";
import {
  buildMissionDataSnapshot,
  serializeMissionDataSnapshot,
  validateCatalog,
  validateV1Scope,
  type MissionCatalog,
} from "@/domain/catalog";
import type { BodyRecord } from "@/domain/bodies";
import { validatePresentationsLicensed, validateSimplifications } from "@/domain/simplification";
import { validatePresentationDeclarations } from "@/domain/presentation";
import {
  resolveSource,
  registerDigest,
  validateBodiesAgainstRegister,
  validateMissionsAgainstRegister,
  validateRegister,
} from "@/domain/register";
import { SOURCE_POLICY_VERSION, isIsoDate, mayCarryDisplayedValue } from "@/domain/sources";
import { validateBody } from "@/domain/validation";

// Golden digests for the shipped content. Recomputed deliberately, never by
// running an update script: a change here should be a decision someone made.
//
// Both digests cover *facts*: bodies, values, units, precision, citations, the
// completion path, and the claim target. Learner-facing wording is excluded on
// purpose, so copy-editing the learner text does not churn these.
const SHIPPED_REGISTER_DIGEST = "36114437";
const SHIPPED_FACTS_DIGEST = "ab3b03a0";

const SHIPPED_CATALOG: MissionCatalog = {
  registerVersion: SOURCE_REGISTER_VERSION,
  bodies: PLANETARY_BODIES,
  missions: MISSIONS,
};

describe("the shipped source register", () => {
  it("is internally valid", () => {
    expect(validateRegister(SOURCE_REGISTER)).toEqual([]);
  });

  it("declares the policy version this build implements", () => {
    expect(SOURCE_REGISTER.policyVersion).toBe(SOURCE_POLICY_VERSION);
  });

  it("keeps the release-manifest version marker and the register version in step", () => {
    // Two literals on purpose: `scripts/create-release-manifest.mjs` reads the
    // declaration in `src/content/index.ts`, and the register carries its own
    // version. This test is what stops them drifting apart.
    expect(CATALOGUE_SOURCE_REGISTER_VERSION).toBe(SOURCE_REGISTER.version);
    expect(SOURCE_REGISTER_VERSION).toBe(SOURCE_REGISTER.version);
    expect(SOURCE_REGISTER_VERSION).not.toBe("unpopulated");
  });

  it("is dated with a real calendar date, not a rolled-over one", () => {
    expect(SOURCE_REGISTER.retrievedOn).toBe(SOURCE_REGISTER_RETRIEVED_ON);
    expect(isIsoDate(SOURCE_REGISTER.retrievedOn)).toBe(true);
  });

  it("actually ships entries, and they are the authored set", () => {
    expect(SOURCE_REGISTER.entries.length).toBeGreaterThan(0);
    for (const entry of SOURCE_REGISTER.entries) {
      // Every entry must be usable: identified, attributed, dated, and precise.
      expect(entry.id.trim()).not.toBe("");
      expect(entry.sourceTitle.trim()).not.toBe("");
      expect(entry.precisionNote.trim()).not.toBe("");
      expect(isIsoDate(entry.retrievedOn)).toBe(true);
      expect(entry.url ?? entry.datasetIdentifier).toBeTruthy();
      if (entry.reviewStatus !== "unreviewed") {
        expect(entry.reviewNote.trim()).not.toBe("");
      }
    }
  });

  it("cites only source classes that may originate a displayed value", () => {
    // The structural half of the register's central rule: a value-source may
    // resolve a number, and a locator may not. Third-party classes exist in the
    // type system so they can be recorded, never so they can be displayed.
    const valueSources = SOURCE_REGISTER.entries.filter((entry) => entry.role === "value-source");
    expect(valueSources.length).toBeGreaterThan(0);
    for (const entry of valueSources) {
      expect(mayCarryDisplayedValue(entry.sourceClass)).toBe(true);
    }
  });

  it("resolves every value a body displays to the entry the body cites", () => {
    for (const body of PLANETARY_BODIES) {
      for (const [attributeId, sourced] of Object.entries(body.attributes)) {
        const resolved = resolveSource(SOURCE_REGISTER, body.id, attributeId as never);
        expect(resolved?.id).toBe(sourced.sourceId);
        expect(resolved?.role).toBe("value-source");
      }
    }
  });

  it("does not let a locator resolve a value, even when it is the only entry", () => {
    const locatorOnly = {
      ...SOURCE_REGISTER,
      entries: [
        {
          ...SOURCE_REGISTER.entries[0]!,
          id: "locator.only",
          role: "locator" as const,
        },
      ],
    };
    expect(resolveSource(locatorOnly, SOURCE_REGISTER.entries[0]!.bodyId, "meanRadius" as never)).toBeUndefined();
  });
});

describe("the shipped catalogue", () => {
  it("is populated, and reports itself as such", () => {
    expect(PLANETARY_BODIES.length).toBe(5);
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(catalogueIsPopulated()).toBe(true);
    for (const id of SURVEY_BODY_IDS) {
      expect(findBody(id)?.id).toBe(id);
    }
    expect(findBody("not-a-world")).toBeUndefined();
    expect(findMission(MISSIONS[0]!.id)?.id).toBe(MISSIONS[0]!.id);
    expect(findMission("not-a-mission")).toBeUndefined();
  });

  it("passes the full catalog contract, including the v1 content scope", () => {
    expect(validateV1Scope(SHIPPED_CATALOG)).toEqual([]);
    expect(validateCatalog(SHIPPED_CATALOG)).toEqual([]);
  });

  it("has every value physically plausible on its own", () => {
    for (const body of PLANETARY_BODIES) {
      expect(validateBody(body)).toEqual([]);
    }
  });

  it("passes the provenance gate, so no value ships uncited", () => {
    expect(validateBodiesAgainstRegister(PLANETARY_BODIES, SOURCE_REGISTER)).toEqual([]);
  });

  it("keeps a contested value out of every mission's completion path", () => {
    // The Moon's relief is deliberately shipped as contested. This is the check
    // that turns `reviewStatus: "contested"` from a label into a constraint.
    expect(validateMissionsAgainstRegister(SHIPPED_CATALOG, SOURCE_REGISTER)).toEqual([]);
    const contested = PLANETARY_BODIES.flatMap((body) =>
      Object.values(body.attributes).filter((value) => value.reviewStatus === "contested"),
    );
    expect(contested.length).toBeGreaterThan(0);
    for (const mission of MISSIONS) {
      for (const observation of mission.requiredObservations) {
        const body = findBody(observation.bodyId);
        expect(body?.attributes[observation.attributeId]?.reviewStatus).not.toBe("contested");
      }
    }
  });

  it("never reports itself as reviewed while any value is unreviewed", () => {
    // `catalogueIsScienceReviewed` is the gate PS-11/PS-14 read. It must be false
    // unless every body is signed off, and it must not be reachable by having
    // content alone.
    const allReviewed = PLANETARY_BODIES.every((body) => body.provenance.scienceReviewed);
    expect(catalogueIsScienceReviewed()).toBe(allReviewed);
  });

  it("marks every displayed value's review state consistently with its citation", () => {
    for (const body of PLANETARY_BODIES) {
      for (const sourced of Object.values(body.attributes)) {
        const entry = SOURCE_REGISTER.entries.find((record) => record.id === sourced.sourceId);
        expect(entry).toBeTruthy();
        // A body may not be more confident than the source it cites. Reviewing a
        // value does not review its citation, and the reverse.
        if (body.provenance.scienceReviewed) {
          expect(sourced.reviewStatus).toBe("reviewed");
        }
      }
    }
  });

  it("reports an absent value as absent rather than as a small one", () => {
    // The Moon has no sourced heliocentric distance, and the icy moons orbit
    // planets rather than the Sun, so those fields simply do not exist. This is
    // the shape a "no authoritative value" instrument reading depends on.
    expect(findBody(MOON_ID)?.attributes.orbitalRadius).toBeUndefined();
    expect(findBody(MARS_ID)?.attributes.orbitalRadius).toBeDefined();
    expect(findBody(VENUS_ID)?.attributes.orbitalRadius).toBeDefined();
  });
});

describe("the shipped simplification register", () => {
  it("licenses every simplification with all four required elements", () => {
    expect(validateSimplifications(SIMPLIFICATION_REGISTER)).toEqual([]);
    expect(SIMPLIFICATION_REGISTER.length).toBeGreaterThan(0);
    for (const record of SIMPLIFICATION_REGISTER) {
      expect(record.modelBoundary.trim()).not.toBe("");
      expect(record.learnerText.trim()).not.toBe("");
      expect(record.rationale.trim()).not.toBe("");
      expect(record.sourceBasisIds.length).toBeGreaterThan(0);
    }
  });

  it("licenses every simplification against a register entry that exists", () => {
    const known = new Set(SOURCE_REGISTER.entries.map((entry) => entry.id));
    for (const record of SIMPLIFICATION_REGISTER) {
      for (const sourceBasisId of record.sourceBasisIds) {
        expect(known.has(sourceBasisId)).toBe(true);
      }
    }
  });

  it("ships no presentation distortion it has not declared", () => {
    expect(validatePresentationDeclarations(PRESENTATION_DECLARATIONS)).toEqual([]);
    expect(validatePresentationsLicensed(PRESENTATION_DECLARATIONS, SIMPLIFICATION_REGISTER)).toEqual(
      [],
    );
  });
});

describe("the shipped content is deterministic", () => {
  it("records the register identity the facts were derived from", () => {
    const snapshot = buildMissionDataSnapshot({
      catalog: SHIPPED_CATALOG,
      register: SOURCE_REGISTER,
      seed: 11,
    });
    expect(snapshot.registerVersion).toBe(SOURCE_REGISTER_VERSION);
    expect(snapshot.registerDigest).toBe(registerDigest(SOURCE_REGISTER));
  });

  it("produces byte-identical facts for the same content and seed", () => {
    const first = serializeMissionDataSnapshot(
      buildMissionDataSnapshot({ catalog: SHIPPED_CATALOG, register: SOURCE_REGISTER, seed: 11 }),
    );
    const second = serializeMissionDataSnapshot(
      buildMissionDataSnapshot({ catalog: SHIPPED_CATALOG, register: SOURCE_REGISTER, seed: 11 }),
    );
    expect(second).toBe(first);
  });

  it("pins golden digests for the shipped content", () => {
    // Recompute deliberately when content changes: this assertion is the tripwire
    // that makes a shipped-fact change a visible act rather than a diff nobody
    // reads.
    const snapshot = buildMissionDataSnapshot({
      catalog: SHIPPED_CATALOG,
      register: SOURCE_REGISTER,
      seed: 11,
    });
    expect(snapshot.registerDigest).toBe(SHIPPED_REGISTER_DIGEST);
    expect(snapshot.factsDigest).toBe(SHIPPED_FACTS_DIGEST);
  });

  it("is independent of the seed, which selects a run and never a value", () => {
    const one = buildMissionDataSnapshot({ catalog: SHIPPED_CATALOG, register: SOURCE_REGISTER, seed: 1 });
    const other = buildMissionDataSnapshot({
      catalog: SHIPPED_CATALOG,
      register: SOURCE_REGISTER,
      seed: 4_294_967_295,
    });
    expect(other.seed).toBe(4_294_967_295);
    expect(other.factsDigest).toBe(one.factsDigest);
  });
});

describe("the provenance gate is live on the shipped register", () => {
  const unsourced: BodyRecord = {
    id: "would-be-world",
    displayName: "A world with a number and no source",
    summary: "Synthetic, used only to prove the gate fires.",
    attributes: {
      meanRadius: {
        value: { value: 1000, unit: "km" },
        sourceId: "nobody-cited-this",
        significantDigits: 2,
        reviewStatus: "reviewed",
      },
    },
    provenance: { registerVersion: SOURCE_REGISTER_VERSION, scienceReviewed: true },
  };

  it("rejects a displayed value with no register entry", () => {
    const issues = validateBodiesAgainstRegister([unsourced], SOURCE_REGISTER);
    expect(issues.map((issue) => issue.code)).toEqual(["value-without-register-entry"]);
    expect(issues[0]?.subject).toBe("body:would-be-world:meanRadius");
  });

  it("rejects a body authored against a different register version", () => {
    const stale = { ...unsourced, provenance: { ...unsourced.provenance, registerVersion: "ps-02" } };
    const issues = validateBodiesAgainstRegister([stale], SOURCE_REGISTER);
    expect(issues.map((issue) => issue.code)).toContain("register-version-mismatch");
  });

  it("would accept the same value once it is cited and valid", () => {
    // The counterpart to the two tests above: the gate rejects the citation, not
    // the science. A reviewed, cited value in the shipped register passes both the
    // provenance gate and the physical-plausibility check.
    const cited: BodyRecord = {
      ...unsourced,
      attributes: {
        meanRadius: {
          value: { value: 1000, unit: "km" },
          sourceId: "cited",
          significantDigits: 2,
          reviewStatus: "reviewed",
        },
      },
    };
    const register = {
      ...SOURCE_REGISTER,
      entries: [
        {
          id: "cited",
          bodyId: cited.id,
          attributeId: "meanRadius",
          role: "value-source" as const,
          sourceClass: "agency-primary" as const,
          sourceTitle: "A citation",
          organization: "NASA" as const,
          datasetIdentifier: "dataset:cited",
          retrievedOn: SOURCE_REGISTER.retrievedOn,
          precisionNote: "Two significant figures.",
          reviewStatus: "reviewed" as const,
          reviewNote: "Checked against the source table.",
        },
      ],
    };
    expect(validateRegister(register)).toEqual([]);
    expect(validateBodiesAgainstRegister([cited], register)).toEqual([]);
    expect(validateBody(cited)).toEqual([]);
  });
});
