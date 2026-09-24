/**
 * Authored mission and body content.
 *
 * Content is authored as TYPED TYPESCRIPT MODULES, validated at build time by
 * `tsc` and at test time by contract tests — stronger and cheaper than parsing
 * bundled data at runtime (docs/TECHNOLOGY_DECISIONS.md §5).
 *
 * The catalogue is EMPTY ON PURPOSE.
 *
 * GAME-364 requires that no production science content is invented during
 * bootstrap, and docs/SCIENCE_MODEL.md §5.2 requires every displayed value to have
 * a per-field source-register entry. PS-03 (GAME-366) built that register — its
 * schema, policy, validation, freshness, and determinism now live in
 * `src/domain/`, and the register content lives in `./provenance.ts`. PS-04
 * (GAME-368) authors the bodies, missions, and claims here and puts them through
 * independent science review. Nothing here may be filled in before then.
 *
 * The *schema* for a mission is owned by the domain (`@/domain/catalog`), not by
 * this file: content conforms to the domain, never the reverse
 * (docs/TECHNICAL_DESIGN.md §2.1).
 */

import type { BodyRecord } from "@/domain/bodies";
import type { MissionDefinition } from "@/domain/catalog";

export type { MissionDefinition } from "@/domain/catalog";
export { SOURCE_REGISTER, SOURCE_REGISTER_VERSION, PRESENTATION_DECLARATIONS } from "./provenance";

/**
 * Version marker for the source register these values were read from.
 *
 * Kept as a literal here as well as in `./provenance.ts` because
 * `scripts/create-release-manifest.mjs` reads this exact declaration to stamp the
 * release manifest's content version. `tests/content/register.test.ts` asserts the
 * two agree, so the duplication cannot drift unnoticed.
 */
export const CATALOGUE_SOURCE_REGISTER_VERSION = "ps-03-unpopulated";

/** Bodies with authoritative, reviewed values. Empty until PS-04. */
export const PLANETARY_BODIES: readonly BodyRecord[] = [];

/** Missions available to the learner. Empty until PS-04. */
export const MISSIONS: readonly MissionDefinition[] = [];

export function findMission(id: string): MissionDefinition | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}

/**
 * Whether the catalogue currently contains reviewed, sourced content.
 *
 * The UI uses this to stay honest: with an empty catalogue it says so rather than
 * presenting an empty survey as if it were a finished game.
 */
export function catalogueIsPopulated(): boolean {
  return PLANETARY_BODIES.length > 0 && MISSIONS.length > 0;
}
