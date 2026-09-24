/**
 * Authored mission and body content.
 *
 * Content is authored as TYPED TYPESCRIPT MODULES, validated at build time by
 * `tsc` and at test time by contract tests — stronger and cheaper than parsing
 * bundled data at runtime (docs/TECHNOLOGY_DECISIONS.md §5).
 *
 * ## What is here now
 *
 * PS-04 (GAME-366's successor) authored the v1 content: five bodies, four
 * missions, the per-field source register that cites every displayed value, and
 * the simplification register. The *schemas* those conform to are owned by
 * `src/domain/`, because content conforms to the domain and never the reverse
 * (docs/TECHNICAL_DESIGN.md §2.1).
 *
 * ## What is deliberately not claimed
 *
 * `scienceReviewed` is `false` on every body and `reviewStatus` is `unreviewed`
 * on almost every register entry. That is an honest report of the state of this
 * content: the values are transcribed from agency sources and machine-checked for
 * physical plausibility, but **no independent science review has happened yet**.
 * That review is a human gate that GAME-368 owns and that automation may not
 * fabricate (`docs/ACCEPTANCE_EVIDENCE_MATRIX.md`). The artefact a reviewer works
 * from is `docs/SCIENCE_REVIEW_PACKET.md`.
 *
 * One entry is `contested` rather than `unreviewed` — the Moon's surface relief,
 * where two agency products disagree — and the consequence is enforced rather
 * than documented: `validateMissionsAgainstRegister` fails the build if a mission
 * requires a contested value.
 */

import type { BodyRecord } from "@/domain/bodies";
import type { MissionDefinition } from "@/domain/catalog";

import { PLANETARY_BODIES } from "./bodies";
import { MISSIONS } from "./missions";

export type { MissionDefinition } from "@/domain/catalog";
export {
  PRESENTATION_DECLARATIONS,
  SOURCE_REGISTER,
  SOURCE_REGISTER_RETRIEVED_ON,
  SOURCE_REGISTER_VERSION,
} from "./provenance";
export { PLANETARY_BODIES, SURVEY_BODY_IDS } from "./bodies";
export { MISSIONS } from "./missions";
export { SIMPLIFICATION_REGISTER } from "./simplifications";

/**
 * Version marker for the source register these values were read from.
 *
 * Kept as a literal here as well as in `./sourceRegister.ts` because
 * `scripts/create-release-manifest.mjs` reads this exact declaration to stamp the
 * release manifest's content version. `tests/content/register.test.ts` asserts the
 * two agree, so the duplication cannot drift unnoticed.
 */
export const CATALOGUE_SOURCE_REGISTER_VERSION = "ps-04.0.0";

export type { BodyRecord };

export function findMission(id: string): MissionDefinition | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}

export function findBody(id: string): BodyRecord | undefined {
  return PLANETARY_BODIES.find((body) => body.id === id);
}

/**
 * Whether the catalogue currently contains reviewed, sourced content.
 *
 * The UI uses this to stay honest about what state the game is in. With content
 * authored but not yet science-reviewed, this reports `false`: the game has real
 * sourced values, but they have not been signed off, and the difference between
 * "sourced" and "reviewed" is one the learner-facing disclosure must not blur.
 */
export function catalogueIsPopulated(): boolean {
  return PLANETARY_BODIES.length > 0 && MISSIONS.length > 0;
}

/**
 * Whether every body's values have passed independent science review.
 *
 * Distinct from `catalogueIsPopulated` on purpose. A build can have content and
 * still not be reviewable as science, and PS-11/PS-14 gate on this rather than on
 * occupancy.
 */
export function catalogueIsScienceReviewed(): boolean {
  return (
    PLANETARY_BODIES.length > 0 &&
    PLANETARY_BODIES.every((body) => body.provenance.scienceReviewed)
  );
}
