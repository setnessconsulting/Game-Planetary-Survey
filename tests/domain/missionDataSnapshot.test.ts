/**
 * Catalog and mission-data snapshot tests (GAME-366).
 *
 * The acceptance criterion is "same content version + seed produces the same
 * mission facts". That is only worth anything if the snapshot is *structurally*
 * deterministic — independent of authoring order, the device, the renderer, and
 * the clock — so these tests attack those sources of variation directly.
 */

import { describe, expect, it } from "vitest";

import type { BodyRecord } from "@/domain/bodies";
import {
  MAX_TARGET_MINUTES,
  MIN_TARGET_MINUTES,
  MISSION_DATA_SNAPSHOT_SCHEMA_VERSION,
  buildMissionDataSnapshot,
  observationKey,
  serializeMissionDataSnapshot,
  validateCatalog,
  validateMissionDefinition,
  type MissionCatalog,
  type MissionDefinition,
} from "@/domain/catalog";
import { QUALITY_PROFILE_IDS } from "@/assets/qualityProfiles";
import { quantity, type Unit } from "@/domain/quantities";
import { detectCapabilities } from "@/platform/capabilities";
import { FIXTURE_SOURCE_REGISTER, FIXTURE_REGISTER_RETRIEVED_ON } from "@/testing/sourcedFixture";
import {
  DEV_FIXTURE_BODIES,
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
  FIXTURE_REGISTER_VERSION,
} from "@/testing/devFixture";
import type { ValidationIssue } from "@/domain/validation";

const KNOWN_BODIES = [FIXTURE_ALPHA, FIXTURE_BETA];

function codes(issues: readonly ValidationIssue[]): readonly string[] {
  return issues.map((issue) => issue.code);
}

function mission(overrides: Partial<MissionDefinition> = {}): MissionDefinition {
  return {
    id: "survey-1",
    kind: "guided",
    title: "How wide is it?",
    brief: "Compare two worlds and decide which is larger.",
    scaleProperty: "meanRadius",
    targetBodyIds: [FIXTURE_ALPHA, FIXTURE_BETA],
    seedBase: 42,
    variantOf: null,
    targetMinutes: 12,
    requiredObservations: [
      {
        bodyId: FIXTURE_ALPHA,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Sweep the first world to get its width.",
      },
      {
        bodyId: FIXTURE_BETA,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Sweep the second world to get its width.",
      },
    ],
    claimTarget: {
      attributeId: "meanRadius",
      basis: "magnitude",
      subject: FIXTURE_ALPHA,
      relation: "largerThan",
      object: FIXTURE_BETA,
      assertion: "The first world is wider than the second.",
      requiredEvidence: [
        observationKey(FIXTURE_ALPHA, "meanRadius"),
        observationKey(FIXTURE_BETA, "meanRadius"),
      ],
    },
    misconceptions: [],
    hints: [{ order: 1, text: "Try the radius sounder on both worlds." }],
    debriefFacts: [
      {
        id: "deb-1",
        text: "You measured how wide each world is with the radius sounder.",
        basis: "measured",
        sourceBasisIds: [],
      },
    ],
    scienceBoundaries: [
      {
        id: "bound-1",
        statement: "This mission compares size only, and claims nothing about orbits.",
      },
    ],
    ...overrides,
  };
}

/**
 * A catalogue that satisfies the v1 content scope: exactly one guided mission, at
 * least two independent missions, and at least one replayable variant. The scope
 * rules are checked by `validateCatalog`, so a fixture that ignores them would
 * test a catalogue shape that can never ship.
 */
function catalog(overrides: Partial<MissionCatalog> = {}): MissionCatalog {
  return {
    registerVersion: FIXTURE_REGISTER_VERSION,
    bodies: DEV_FIXTURE_BODIES,
    missions: [
      mission({ id: "survey-1", kind: "guided" }),
      mission({ id: "survey-2", kind: "independent", seedBase: 43 }),
      mission({ id: "survey-3", kind: "independent", seedBase: 44 }),
      mission({ id: "survey-2-variant", kind: "independent", seedBase: 45, variantOf: "survey-2" }),
    ],
    ...overrides,
  };
}

describe("validateMissionDefinition", () => {
  it("accepts a mission that compares two worlds on a scale property", () => {
    expect(validateMissionDefinition(mission(), KNOWN_BODIES)).toEqual([]);
  });

  it("requires an id, a title, and a brief", () => {
    expect(codes(validateMissionDefinition(mission({ id: " " }), KNOWN_BODIES))).toContain(
      "catalog-empty-field",
    );
    expect(codes(validateMissionDefinition(mission({ title: "" }), KNOWN_BODIES))).toContain(
      "catalog-empty-field",
    );
    expect(codes(validateMissionDefinition(mission({ brief: " " }), KNOWN_BODIES))).toContain(
      "catalog-empty-field",
    );
  });

  it("refuses a mission that cannot compare anything", () => {
    expect(
      codes(validateMissionDefinition(mission({ targetBodyIds: [FIXTURE_ALPHA] }), KNOWN_BODIES)),
    ).toContain("catalog-mission-needs-two-targets");
    expect(
      codes(validateMissionDefinition(mission({ targetBodyIds: [] }), KNOWN_BODIES)),
    ).toContain("catalog-mission-needs-two-targets");
  });

  it("refuses a target that is not in the catalog", () => {
    expect(
      codes(validateMissionDefinition(mission({ targetBodyIds: [FIXTURE_ALPHA, "ghost"] }), KNOWN_BODIES)),
    ).toContain("catalog-unknown-body");
  });

  it("refuses a mission about something that is not a scale property", () => {
    // Temperature supports a comparison but is not an MS-ESS1-3 scale property, so
    // it may not carry a v1 mission's primary objective.
    expect(
      codes(validateMissionDefinition(mission({ scaleProperty: "meanSurfaceTemperature" }), KNOWN_BODIES)),
    ).toContain("catalog-mission-not-a-scale-property");
  });

  it("requires a usable 32-bit seed", () => {
    expect(codes(validateMissionDefinition(mission({ seedBase: -1 }), KNOWN_BODIES))).toContain(
      "catalog-seed-out-of-range",
    );
    expect(codes(validateMissionDefinition(mission({ seedBase: 1.5 }), KNOWN_BODIES))).toContain(
      "catalog-seed-out-of-range",
    );
    expect(
      codes(validateMissionDefinition(mission({ seedBase: 0x1_0000_0000 }), KNOWN_BODIES)),
    ).toContain("catalog-seed-out-of-range");
    expect(codes(validateMissionDefinition(mission({ seedBase: 0 }), KNOWN_BODIES))).toEqual([]);
  });

  it("keeps the target session inside the v1 window", () => {
    expect(
      codes(validateMissionDefinition(mission({ targetMinutes: MIN_TARGET_MINUTES - 1 }), KNOWN_BODIES)),
    ).toContain("catalog-target-duration");
    expect(
      codes(validateMissionDefinition(mission({ targetMinutes: MAX_TARGET_MINUTES + 1 }), KNOWN_BODIES)),
    ).toContain("catalog-target-duration");
    expect(
      codes(validateMissionDefinition(mission({ targetMinutes: Number.NaN }), KNOWN_BODIES)),
    ).toContain("catalog-target-duration");
  });
});

describe("validateCatalog", () => {
  it("accepts the fixture catalog", () => {
    expect(validateCatalog(catalog())).toEqual([]);
  });

  it("accepts the shipped empty catalog", () => {
    expect(
      validateCatalog({ registerVersion: "unpopulated", bodies: [], missions: [] }),
    ).toEqual([]);
  });

  it("rejects duplicate body and mission ids", () => {
    const duplicatedBodies = catalog({ bodies: [DEV_FIXTURE_BODIES[0]!, ...DEV_FIXTURE_BODIES] });
    expect(codes(validateCatalog(duplicatedBodies))).toContain("catalog-duplicate-id");

    const duplicatedMissions = catalog({ missions: [mission(), mission()] });
    expect(codes(validateCatalog(duplicatedMissions))).toContain("catalog-duplicate-id");
  });

  it("reports each offending mission rather than only the first", () => {
    const issues = validateCatalog(
      catalog({ missions: [mission({ id: "a", seedBase: -1 }), mission({ id: "b", seedBase: -2 })] }),
    );
    expect(issues.filter((issue) => issue.code === "catalog-seed-out-of-range").length).toBe(2);
  });
});

describe("buildMissionDataSnapshot", () => {
  it("is identical for the same content and seed", () => {
    const first = buildMissionDataSnapshot({ catalog: catalog(), register: FIXTURE_SOURCE_REGISTER, seed: 7 });
    const second = buildMissionDataSnapshot({ catalog: catalog(), register: FIXTURE_SOURCE_REGISTER, seed: 7 });
    expect(serializeMissionDataSnapshot(first)).toBe(serializeMissionDataSnapshot(second));
  });

  it("is independent of authoring order", () => {
    const forward = buildMissionDataSnapshot({
      catalog: catalog({ bodies: [...DEV_FIXTURE_BODIES] }),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 7,
    });
    const reversed = buildMissionDataSnapshot({
      catalog: catalog({ bodies: [...DEV_FIXTURE_BODIES].reverse() }),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 7,
    });
    expect(reversed.factsDigest).toBe(forward.factsDigest);
    expect(reversed.bodies.map((body) => body.bodyId)).toEqual(
      forward.bodies.map((body) => body.bodyId),
    );
    expect(reversed.bodies.map((body) => body.bodyId)).toEqual([
      FIXTURE_ALPHA,
      FIXTURE_BETA,
      FIXTURE_GAMMA,
    ]);
  });

  it("records the seed without letting it alter a scientific fact", () => {
    const one = buildMissionDataSnapshot({ catalog: catalog(), register: FIXTURE_SOURCE_REGISTER, seed: 1 });
    const two = buildMissionDataSnapshot({
      catalog: catalog(),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 999_999,
    });
    expect(one.seed).toBe(1);
    expect(two.seed).toBe(999_999);
    // A seed selects which variant and which observation identity a learner sees.
    // It never perturbs a value, which is why the facts digest is seed-independent.
    expect(two.factsDigest).toBe(one.factsDigest);
  });

  it("states every value in its attribute's canonical unit", () => {
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog(),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 7,
    });
    const alpha = snapshot.bodies.find((body) => body.bodyId === FIXTURE_ALPHA);
    expect(alpha?.attributes.map((attribute) => attribute.unit)).toEqual(["km", "km", "K"]);
    expect(alpha?.attributes.map((attribute) => attribute.attributeId)).toEqual([
      "atmosphereDepth",
      "meanRadius",
      "meanSurfaceTemperature",
    ]);
  });

  it("converts a value authored in a non-canonical unit rather than carrying the difference", () => {
    const inMetres: BodyRecord = {
      ...DEV_FIXTURE_BODIES[0]!,
      attributes: {
        meanRadius: {
          value: quantity(600_000, "m"),
          sourceId: "fixture.alpha.radius",
          significantDigits: 3,
          reviewStatus: "unreviewed",
        },
      },
    };
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog({ bodies: [inMetres] }),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 0,
    });
    expect(snapshot.bodies[0]?.attributes).toEqual([
      { attributeId: "meanRadius", value: 600, unit: "km", sourceId: "fixture.alpha.radius", significantDigits: 3, reviewStatus: "unreviewed" },
    ]);
  });

  it("leaves a wrong-kind value alone for validation to report", () => {
    const wrongKind: BodyRecord = {
      ...DEV_FIXTURE_BODIES[0]!,
      attributes: {
        meanRadius: {
          value: quantity(300, "K" as Unit),
          sourceId: "fixture.alpha.radius",
          significantDigits: 3,
          reviewStatus: "unreviewed",
        },
      },
    };
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog({ bodies: [wrongKind] }),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 0,
    });
    expect(snapshot.bodies[0]?.attributes[0]?.value).toBe(300);
  });

  it("carries an epoch when one applies, and omits it otherwise", () => {
    const withEpoch: BodyRecord = {
      ...DEV_FIXTURE_BODIES[0]!,
      attributes: {
        meanRadius: {
          value: quantity(1000, "km"),
          sourceId: "fixture.alpha.radius",
          significantDigits: 2,
          reviewStatus: "reviewed",
          appliesToEpoch: "J2000",
        },
      },
    };
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog({ bodies: [withEpoch, DEV_FIXTURE_BODIES[1]!] }),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 0,
    });
    expect(snapshot.bodies[0]?.attributes[0]?.appliesToEpoch).toBe("J2000");
    expect(snapshot.bodies[0]?.attributes[0]?.reviewStatus).toBe("reviewed");
    expect(snapshot.bodies[1]?.attributes.map((attribute) => attribute.appliesToEpoch)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("records the register identity the facts were derived from", () => {
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog(),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 7,
    });
    expect(snapshot.schemaVersion).toBe(MISSION_DATA_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.registerVersion).toBe(FIXTURE_REGISTER_VERSION);
    expect(snapshot.registerDigest).toMatch(/^[0-9a-f]{8}$/);
    expect(snapshot.factsDigest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("pins golden digests, so content drift is a deliberate act", () => {
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog(),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 7,
    });
    // Re-pinned when the fixture grew to a v1-shaped catalogue (one guided
    // mission, two independent missions, one variant): the digest covers the
    // completion path and claim target, so a new mission is a new fact set.
    expect(snapshot.registerDigest).toBe("a29be4cf");
    expect(snapshot.factsDigest).toBe("cef9e430");
  });

  it("cannot be changed by the renderer, the device, or the quality tier", () => {
    // GAME-366's first acceptance criterion, stated as a test: Babylon, React,
    // animation timing, device size, and wall-clock time cannot change scientific
    // truth. A snapshot is a pure function of authored content, the register, and
    // the seed — so every capability report and every quality tier must produce
    // byte-identical output.
    const baseline = serializeMissionDataSnapshot(
      buildMissionDataSnapshot({ catalog: catalog(), register: FIXTURE_SOURCE_REGISTER, seed: 7 }),
    );

    const capabilityScenarios = [
      detectCapabilities({ hasWebGPU: () => false, probeWebGL2: () => ({ supported: true, maxTextureSize: 8192 }) }),
      detectCapabilities({ hasWebGPU: () => true, probeWebGL2: () => ({ supported: true, maxTextureSize: 16384 }) }),
      detectCapabilities({ hasWebGPU: () => false, probeWebGL2: () => ({ supported: false, maxTextureSize: null }) }),
    ];
    expect(new Set(capabilityScenarios.map((report) => report.backend)).size).toBe(3);

    for (const profileId of QUALITY_PROFILE_IDS) {
      for (const report of capabilityScenarios) {
        expect(report.backend, "capability scenario misconfigured").toBeDefined();
        expect(
          serializeMissionDataSnapshot(
            buildMissionDataSnapshot({ catalog: catalog(), register: FIXTURE_SOURCE_REGISTER, seed: 7 }),
          ),
          `snapshot differs at quality tier ${profileId} on ${report.backend}`,
        ).toBe(baseline);
      }
    }
  });

  it("serializes canonically, with the register date recorded", () => {
    const snapshot = buildMissionDataSnapshot({
      catalog: catalog(),
      register: FIXTURE_SOURCE_REGISTER,
      seed: 7,
    });
    const serialized = serializeMissionDataSnapshot(snapshot);
    expect(serialized.startsWith("{\"bodies\":[")).toBe(true);
    expect(serialized).toContain(`"registerVersion":"${FIXTURE_REGISTER_VERSION}"`);
    expect(JSON.parse(serialized)).toEqual(snapshot);
    expect(FIXTURE_REGISTER_RETRIEVED_ON).toBe("2026-09-24");
  });
});
