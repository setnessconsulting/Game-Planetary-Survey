/**
 * DEVELOPMENT/TEST FIXTURE — NOT SCIENTIFIC DATA.
 *
 * This file gives the existing synthetic fixture bodies (`devFixture.ts`) a
 * complete, valid source register so that the PS-03 contracts — provenance
 * presence, field resolution, freshness, deterministic serialization, and the
 * mission-data snapshot — can be exercised against a register that really covers
 * its values.
 *
 * What that proves, and what it does not:
 *
 *  - It proves the *mechanism*: every fixture value resolves to a register entry,
 *    the register validates clean, and its digest and the snapshot digest are
 *    stable golden values.
 *  - It does not prove any planetary fact, and it is not a citation. The records
 *    below use `datasetIdentifier` locators precisely so that no real URL appears
 *    here: a fixture that looked like a real citation would be worse than no
 *    fixture at all.
 *
 * Nothing in the application imports this module, so it is not part of the shipped
 * bundle. Canonical, reviewed entries land in `src/content/` in PS-04 (GAME-368).
 */

import type { PresentationScaleDeclaration } from "@/domain/presentation";
import { SOURCE_POLICY_VERSION, type SourceRecord } from "@/domain/sources";
import type { SourceRegister } from "@/domain/register";
import {
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
  FIXTURE_REGISTER_VERSION,
} from "./devFixture";

export const FIXTURE_REGISTER_RETRIEVED_ON = "2026-09-24";

function fixtureSource(
  id: string,
  bodyId: string,
  attributeId: string,
  sourceTitle: string,
): SourceRecord {
  return {
    id,
    bodyId,
    attributeId,
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle,
    organization: "NASA",
    datasetIdentifier: `fixture-dataset:${id}`,
    retrievedOn: FIXTURE_REGISTER_RETRIEVED_ON,
    precisionNote: "Synthetic fixture record. Two significant figures, by construction.",
    reviewStatus: "unreviewed",
    reviewNote: "",
  };
}

/**
 * A register that covers every value in `DEV_FIXTURE_BODIES`, including the
 * locator-only entry that exists to prove a locator can never resolve a value.
 */
export const FIXTURE_SOURCE_REGISTER: SourceRegister = {
  version: FIXTURE_REGISTER_VERSION,
  policyVersion: SOURCE_POLICY_VERSION,
  retrievedOn: FIXTURE_REGISTER_RETRIEVED_ON,
  entries: [
    fixtureSource("fixture.alpha.radius", FIXTURE_ALPHA, "meanRadius", "Fixture Alpha radius"),
    fixtureSource(
      "fixture.alpha.atmosphere",
      FIXTURE_ALPHA,
      "atmosphereDepth",
      "Fixture Alpha atmosphere depth",
    ),
    fixtureSource(
      "fixture.alpha.temperature",
      FIXTURE_ALPHA,
      "meanSurfaceTemperature",
      "Fixture Alpha mean surface temperature",
    ),
    fixtureSource("fixture.beta.radius", FIXTURE_BETA, "meanRadius", "Fixture Beta radius"),
    fixtureSource("fixture.beta.orbit", FIXTURE_BETA, "orbitalRadius", "Fixture Beta orbital radius"),
    fixtureSource("fixture.gamma.radius", FIXTURE_GAMMA, "meanRadius", "Fixture Gamma radius"),
    // A locator: how the author found the primary source above. It must never be
    // able to resolve a displayed value (docs/SCIENCE_MODEL.md §5.1).
    {
      id: "fixture.locator.catalogue",
      bodyId: FIXTURE_ALPHA,
      attributeId: "meanRadius",
      role: "locator",
      sourceClass: "third-party",
      sourceTitle: "Fixture locator index",
      organization: "other",
      organizationName: "Fixture Index (not an authority)",
      datasetIdentifier: "fixture-dataset:locator",
      retrievedOn: FIXTURE_REGISTER_RETRIEVED_ON,
      precisionNote: "No values. Used only to find the fixture records above.",
      reviewStatus: "unreviewed",
      reviewNote: "",
      exceptionJustification:
        "Synthetic fixture: exists only to prove a locator cannot be cited as a value source.",
    },
  ],
};

/**
 * A declared, non-literal presentation for the synthetic comparison view.
 *
 * Exists so the scale/distortion contract is exercised with real data rather than
 * only in the abstract. The learner text is deliberately blunt, because the
 * contract's whole point is that a distorted view says so.
 */
export const FIXTURE_PRESENTATION_DECLARATIONS: readonly PresentationScaleDeclaration[] = [
  {
    id: "SIM-fixture-1",
    representationId: "fixture-comparison",
    kind: "nonLinearCompression",
    ratio: 0.0001,
    sourceBasisIds: ["fixture.alpha.radius", "fixture.beta.radius"],
    rationale:
      "Fixture worlds differ by more than one order of magnitude, so a literal side-by-side " +
      "drawing would show one as a single pixel.",
    modelBoundary:
      "Relative separation and relative size are not to scale with each other. Only the " +
      "distances stated in the notebook are measurements.",
    learnerText:
      "This comparison view is compressed, not literal. The numbers in the notebook are the measurements.",
    reviewStatus: "unreviewed",
  },
];
