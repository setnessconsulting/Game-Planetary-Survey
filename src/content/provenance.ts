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
 * PS-05 (GAME-369) declares the system-comparison view licensed by SIM-7. The
 * simplification says why compressing is acceptable and what the learner is told;
 * this declaration says which view does it and by how much. Both are required:
 * `validatePresentationsLicensed` refuses a declaration whose SIM id is missing
 * or is not scope `presentation`.
 */
export const PRESENTATION_DECLARATIONS: readonly PresentationScaleDeclaration[] = [
  {
    id: "SIM-7",
    representationId: "system-comparison",
    kind: "nonLinearCompression",
    // Drawn:literal factor for comparative placement — deliberately tiny so the
    // renderer treats distances as choreography, never as a measurable length.
    ratio: 0.0001,
    sourceBasisIds: ["jpl.mean-radius.moon", "jpl.mean-radius.venus"],
    rationale:
      "At literal relative scale across surveyed distances, the smallest world in this survey " +
      "would be a single pixel. A labelled comparison teaches the relationship better than an " +
      "unreadable literal view.",
    modelBoundary:
      "The drawing is compressed and is never a source of a value. Relative size and relative " +
      "separation are not to scale with each other, and no measurement is taken from the " +
      "picture. The numbers in the notebook are the measurements.",
    learnerText:
      "This comparison view is compressed so that small worlds stay visible. It is not drawn to literal scale — the numbers in your notebook are the measurements.",
    reviewStatus: "unreviewed",
  },
];
