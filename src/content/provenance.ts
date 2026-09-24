/**
 * Authored provenance: the per-field source register and the presentation
 * scale/distortion declarations.
 *
 * This is the only place in `src/` that may hold absolute source URLs, because
 * `scripts/check-privacy-surface.mjs` treats a URL as a citation only here. A
 * citation is not a network call: nothing in this file is ever fetched, and the
 * application ships it as data.
 *
 * The register entries themselves live in `./sourceRegister.ts`, next to the
 * values and precision notes they describe. This module is the assembly point plus
 * the presentation declarations, so importing `@/content` gives one place to read
 * "what is this build's data, and where did it come from".
 */

import type { PresentationScaleDeclaration } from "@/domain/presentation";

export { SOURCE_REGISTER, SOURCE_REGISTER_VERSION, SOURCE_REGISTER_RETRIEVED_ON } from "./sourceRegister";

/**
 * Declared scale/distortion metadata for rendered representations.
 *
 * Still empty, and that is a statement rather than an omission: PS-05 (GAME-369)
 * gives the renderer representations to declare, and until then there is no view
 * whose distortion could be described. The contract a declaration must satisfy —
 * an explicit ratio, a licensed source basis, a model boundary, and the exact
 * learner-facing text — is enforced by `validatePresentationDeclarations`, and
 * `validatePresentationsLicensed` additionally requires that the SIM id it cites
 * exists in the simplification register with scope `presentation`.
 *
 * SIM-7 in `./simplifications.ts` already states the compression rule this
 * declaration will implement. The two are deliberately separate: the
 * simplification says *why* compressing is acceptable and *what the learner is
 * told*; the declaration will say *which view* does it and by *how much*.
 */
export const PRESENTATION_DECLARATIONS: readonly PresentationScaleDeclaration[] = [];
