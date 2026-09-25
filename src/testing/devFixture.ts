/**
 * DEVELOPMENT/TEST FIXTURE — NOT SCIENTIFIC DATA.
 *
 * The values below are synthetic. They are not planetary facts, they are not
 * sourced, and they are never displayed to a learner. They exist so that the pure
 * contract tests can exercise measurement, comparison, claim evaluation, and
 * determinism without inventing (or prematurely shipping) canonical content.
 *
 * Canonical bodies and missions are authored in PS-04 (GAME-368) after
 * source-based science review, and land in src/content/ with per-field source
 * register entries. Nothing in this file may be promoted into src/content/.
 *
 * Nothing in the application imports this module, so it is not part of the
 * shipped bundle.
 */

import type { BodyRecord } from "@/domain/bodies";
import type { MissionDefinition } from "@/domain/catalog";
import type { MissionContext } from "@/domain/mission";
import type { Seed } from "@/domain/random";

export const FIXTURE_REGISTER_VERSION = "dev-fixture-not-a-source-register";

/** Deterministic fixture seed. */
export const FIXTURE_SEED: Seed = 20260924;

export const FIXTURE_ALPHA = "fixture-alpha";
export const FIXTURE_BETA = "fixture-beta";
/** Deliberately missing an atmosphere value, to exercise the honest-gap path. */
export const FIXTURE_GAMMA = "fixture-gamma";

export const DEV_FIXTURE_BODIES: readonly BodyRecord[] = [
  {
    id: FIXTURE_ALPHA,
    displayName: "Fixture Alpha",
    summary: "Synthetic test body. Not a real world.",
    attributes: {
      meanRadius: {
        value: { value: 1000, unit: "km" },
        sourceId: "fixture.alpha.radius",
        significantDigits: 2,
        reviewStatus: "unreviewed",
      },
      atmosphereDepth: {
        value: { value: 20, unit: "km" },
        sourceId: "fixture.alpha.atmosphere",
        significantDigits: 2,
        reviewStatus: "unreviewed",
      },
      meanSurfaceTemperature: {
        value: { value: 300, unit: "K" },
        sourceId: "fixture.alpha.temperature",
        significantDigits: 2,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: FIXTURE_REGISTER_VERSION, scienceReviewed: false },
  },
  {
    id: FIXTURE_BETA,
    displayName: "Fixture Beta",
    summary: "Synthetic test body. Not a real world.",
    attributes: {
      meanRadius: {
        value: { value: 4000, unit: "km" },
        sourceId: "fixture.beta.radius",
        significantDigits: 3,
        reviewStatus: "unreviewed",
      },
      orbitalRadius: {
        value: { value: 250000000, unit: "km" },
        sourceId: "fixture.beta.orbit",
        significantDigits: 4,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: FIXTURE_REGISTER_VERSION, scienceReviewed: false },
  },
  {
    id: FIXTURE_GAMMA,
    displayName: "Fixture Gamma",
    summary: "Synthetic test body with a deliberate data gap. Not a real world.",
    attributes: {
      meanRadius: {
        value: { value: 250, unit: "km" },
        sourceId: "fixture.gamma.radius",
        significantDigits: 3,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: FIXTURE_REGISTER_VERSION, scienceReviewed: false },
  },
];

/**
 * A synthetic mission over the fixture bodies, so the pure state machine's
 * debrief/completion transitions (PS-08) can be tested without importing canonical
 * content into a domain contract test. It is a fixture, not science: the bodies it
 * surveys are not real worlds.
 */
export const DEV_FIXTURE_MISSION_ID = "dev-survey";

export const DEV_FIXTURE_MISSION: MissionDefinition = {
  id: DEV_FIXTURE_MISSION_ID,
  kind: "independent",
  title: "Fixture survey",
  brief: "Measure two fixture bodies and claim which is larger.",
  scaleProperty: "meanRadius",
  targetBodyIds: [FIXTURE_ALPHA, FIXTURE_BETA],
  seedBase: FIXTURE_SEED,
  variantOf: null,
  targetMinutes: 5,
  requiredObservations: [
    {
      bodyId: FIXTURE_ALPHA,
      attributeId: "meanRadius",
      instrumentId: "radiusSounder",
      purpose: "Measure Fixture Alpha's radius.",
    },
    {
      bodyId: FIXTURE_BETA,
      attributeId: "meanRadius",
      instrumentId: "radiusSounder",
      purpose: "Measure Fixture Beta's radius.",
    },
  ],
  claimTarget: {
    attributeId: "meanRadius",
    basis: "magnitude",
    subject: FIXTURE_BETA,
    relation: "largerThan",
    object: FIXTURE_ALPHA,
    assertion: "Fixture Beta is larger than Fixture Alpha.",
    requiredEvidence: ["fixture-beta.meanRadius", "fixture-alpha.meanRadius"],
  },
  misconceptions: [
    {
      id: "misconception.fixture-size",
      belief: "Fixture Alpha is the larger body.",
      feedback: "The fixtures measure Alpha at 1,000 km and Beta at 4,000 km, so Beta is larger.",
      refutedBy: ["fixture-alpha.meanRadius", "fixture-beta.meanRadius"],
    },
  ],
  hints: [
    { order: 1, text: "Both fixtures need a radius measurement before either can be compared." },
    { order: 2, text: "Cite both readings before submitting, or the claim cannot be checked." },
  ],
  debriefFacts: [
    {
      id: "debrief.fixture-size",
      text: "Your two readings put Fixture Beta at 4,000 km and Fixture Alpha at 1,000 km.",
      basis: "measured",
      sourceBasisIds: [],
    },
  ],
  scienceBoundaries: [
    { id: "boundary.fixture", statement: "These are synthetic fixtures and assert nothing about real bodies." },
  ],
};

export function fixtureContext(): MissionContext {
  return { bodies: DEV_FIXTURE_BODIES, missions: [DEV_FIXTURE_MISSION] };
}
