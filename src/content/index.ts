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
 * bootstrap, and docs/SCIENCE_MODEL.md §5.2 requires every displayed value to
 * have a per-field source-register entry. PS-03 (GAME-366) builds the register;
 * PS-04 (GAME-368) authors the bodies, missions, and claims and puts them through
 * independent science review. Nothing here may be filled in before then.
 */

import type { AttributeId } from "@/domain/attributes";
import type { BodyId, BodyRecord } from "@/domain/bodies";
import type { Seed } from "@/domain/random";

export interface MissionDefinition {
  readonly id: string;
  readonly title: string;
  /** Plain-language survey question the learner must answer with data. */
  readonly brief: string;
  /** The scale property this mission is about (docs/SCIENCE_MODEL.md §1.2). */
  readonly scaleProperty: AttributeId;
  readonly targetBodyIds: readonly BodyId[];
  readonly seedBase: Seed;
  /** Set when this mission is a seeded/data variant of another mission. */
  readonly variantOf: string | null;
  /** Target session length in minutes, from docs/PRD.md §5. */
  readonly targetMinutes: number;
}

/** Version marker for the source register these values were read from. */
export const CATALOGUE_SOURCE_REGISTER_VERSION = "unpopulated";

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
