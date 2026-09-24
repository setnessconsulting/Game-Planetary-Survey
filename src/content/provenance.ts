/**
 * Authored provenance: the per-field source register and the presentation
 * scale/distortion declarations.
 *
 * This is the only place in `src/` that may hold absolute source URLs, because
 * `scripts/check-privacy-surface.mjs` treats a URL as a citation only here. A
 * citation is not a network call: nothing in this file is ever fetched, and the
 * application ships it as data.
 *
 * ## Why the register is empty and versioned
 *
 * The register is deliberately **empty on purpose**, exactly as the body
 * catalogue is. GAME-364 forbids inventing production science content during
 * bootstrap, and the register it produces would be a set of *unreviewed* citations
 * to real authorities. That is worse than nothing: it would look sourced.
 *
 * PS-03 (GAME-366) builds the register — its schema, policy, validation,
 * freshness, and determinism, all in `src/domain/`. PS-04 (GAME-368) authors the
 * entries here, per field, and puts them through independent science review.
 * Between those two stories, `validateBodiesAgainstRegister` is the gate that
 * makes an uncited value impossible to ship: the moment a body carries a value
 * without an entry, the check fails loudly.
 */

import type { PresentationScaleDeclaration } from "@/domain/presentation";
import type { SourceRegister } from "@/domain/register";
import { SOURCE_POLICY_VERSION } from "@/domain/sources";

/**
 * Version of the register *content*.
 *
 * Recorded in the release manifest, so a shipped build names the exact set of
 * citations its values came from, and re-published only when that set changes.
 */
export const SOURCE_REGISTER_VERSION = "ps-03-unpopulated";

/** The register itself. Entries arrive in PS-04, each one science-reviewed. */
export const SOURCE_REGISTER: SourceRegister = {
  version: SOURCE_REGISTER_VERSION,
  policyVersion: SOURCE_POLICY_VERSION,
  retrievedOn: "2026-09-24",
  entries: [],
};

/**
 * Declared scale/distortion metadata for rendered representations.
 *
 * Intentionally empty until PS-05 (GAME-369) gives the renderer representations
 * to declare. The contract they must satisfy — an explicit ratio, a licensed
 * source basis, a model boundary, and the exact learner-facing text — is already
 * enforced by `validatePresentationDeclarations`, so a distorted view cannot be
 * added without saying so.
 */
export const PRESENTATION_DECLARATIONS: readonly PresentationScaleDeclaration[] = [];
