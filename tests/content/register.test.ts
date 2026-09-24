/**
 * Shipped-content provenance tests (GAME-366).
 *
 * The shipped register is empty on purpose, and an empty register is only honest
 * if it is *enforced*. So these tests check three things: the shipped register is
 * internally valid, the catalogue is genuinely empty rather than sneakily
 * populated, and the moment a value exists without an entry, the gate fires.
 */

import { describe, expect, it } from "vitest";

import {
  CATALOGUE_SOURCE_REGISTER_VERSION,
  MISSIONS,
  PLANETARY_BODIES,
  PRESENTATION_DECLARATIONS,
  SOURCE_REGISTER,
  SOURCE_REGISTER_VERSION,
  catalogueIsPopulated,
  findMission,
} from "@/content";
import type { BodyRecord } from "@/domain/bodies";
import { validateRegister, validateBodiesAgainstRegister } from "@/domain/register";
import { SOURCE_POLICY_VERSION } from "@/domain/sources";
import { validatePresentationDeclarations } from "@/domain/presentation";
import { validateBody } from "@/domain/validation";

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
  });

  it("ships no entries yet, and says so rather than looking sourced", () => {
    // PS-04 authors the entries with independent science review. Until then the
    // register must not contain an unreviewed citation to a real authority,
    // because that would look like provenance without being provenance.
    expect(SOURCE_REGISTER.entries).toEqual([]);
  });
});

describe("the shipped catalogue", () => {
  it("is empty, and reports itself as such", () => {
    expect(PLANETARY_BODIES).toEqual([]);
    expect(MISSIONS).toEqual([]);
    expect(catalogueIsPopulated()).toBe(false);
    expect(findMission("anything")).toBeUndefined();
  });

  it("ships no presentation distortions it has not declared", () => {
    expect(PRESENTATION_DECLARATIONS).toEqual([]);
    expect(validatePresentationDeclarations(PRESENTATION_DECLARATIONS)).toEqual([]);
  });

  it("passes the provenance gate vacuously, which is the honest state", () => {
    expect(validateBodiesAgainstRegister(PLANETARY_BODIES, SOURCE_REGISTER)).toEqual([]);
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
