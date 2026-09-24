/**
 * The simplification register.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * `docs/SCIENCE_MODEL.md` §7 permits simplification but requires it to be
 * *licensed*: every simplification needs a source basis, a rationale, a stated
 * model boundary, and the exact words the learner is told. PS-04 authors them;
 * this module defines the shape and refuses a record that is missing any of the
 * four.
 *
 * Why this is separate from `presentation.ts`: a presentation distortion is one
 * *kind* of simplification — a claim about what a picture shows. This register is
 * broader, because the honest simplifications in a survey game are mostly not
 * visual at all. "The probe reports one mean radius, not the body's shape" and
 * "the survey measures a single mean surface temperature, not a day-night range"
 * are simplifications of the *measurement*, and a learner who is never told them
 * will over-read the number they see.
 *
 * A record with `scope: "presentation"` is what a renderer view must cite; the
 * contract test in `tests/content/simplifications.test.ts` requires every
 * declared presentation distortion to have one.
 */

import type { ReviewStatus } from "./bodies";
import type { PresentationScaleDeclaration } from "./presentation";
import type { ValidationIssue } from "./validation";

/** What a simplification simplifies. */
export type SimplificationScope = "presentation" | "measurement" | "mission";

export interface SimplificationRecord {
  /** `SIM-<n>`, matching docs/SCIENCE_MODEL.md §7.1. */
  readonly id: string;
  readonly scope: SimplificationScope;
  /** What the game shows or asserts. */
  readonly statement: string;
  /** Register entries the simplification derives from. Required, per §7. */
  readonly sourceBasisIds: readonly string[];
  /** Why the simplification is necessary. */
  readonly rationale: string;
  /** Where the model stops being valid, and what is deliberately ignored. */
  readonly modelBoundary: string;
  /** The exact in-game explanation shown to the learner. */
  readonly learnerText: string;
  readonly reviewStatus: ReviewStatus;
}

function issue(
  code: ValidationIssue["code"],
  subject: string,
  message: string,
): ValidationIssue {
  return { severity: "error", code, subject, message };
}

function blank(value: string): boolean {
  return value.trim() === "";
}

/** Validate one simplification against the four required elements in §7. */
export function validateSimplification(
  record: SimplificationRecord,
): readonly ValidationIssue[] {
  const subject = `simplification:${record.id}`;
  const issues: ValidationIssue[] = [];

  if (blank(record.id)) {
    issues.push(issue("simplification-empty-id", subject, "A simplification needs a SIM id."));
  }
  if (blank(record.statement)) {
    issues.push(
      issue("simplification-incomplete", subject, "statement must say what the game shows or asserts."),
    );
  }
  if (blank(record.rationale)) {
    issues.push(
      issue("simplification-incomplete", subject, "rationale is required: an unjustified simplification is a defect."),
    );
  }
  if (blank(record.modelBoundary)) {
    issues.push(
      issue(
        "simplification-missing-boundary",
        subject,
        "modelBoundary is required: the learner must be told where the model stops being valid.",
      ),
    );
  }
  if (blank(record.learnerText)) {
    issues.push(
      issue(
        "simplification-undisclosed",
        subject,
        "learnerText is required: a simplification the learner is never told about is not a simplification.",
      ),
    );
  }
  if (record.sourceBasisIds.filter((id) => !blank(id)).length === 0) {
    issues.push(
      issue(
        "simplification-missing-source-basis",
        subject,
        "sourceBasisIds is required: every simplification is licensed by what it derives from.",
      ),
    );
  }

  return issues;
}

/** Validate a set of simplifications, including that ids are unique. */
export function validateSimplifications(
  records: readonly SimplificationRecord[],
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    issues.push(...validateSimplification(record));
    if (seen.has(record.id)) {
      issues.push(
        issue(
          "simplification-duplicate-id",
          `simplification:${record.id}`,
          "Two simplifications share this id; a SIM id must identify exactly one simplification.",
        ),
      );
    }
    seen.add(record.id);
  }

  return issues;
}

/**
 * The simplification that licenses a presentation distortion, if one exists.
 *
 * `presentation.ts` decides how a view is drawn; this register says the distortion
 * was licensed. Both are required before a distorted view may ship.
 */
export function findSimplification(
  records: readonly SimplificationRecord[],
  id: string,
): SimplificationRecord | undefined {
  return records.find((record) => record.id === id);
}

/**
 * Require that a declared presentation distortion is licensed.
 *
 * A view declares *how* it is distorted; this register declares that someone
 * decided the distortion was acceptable and told the learner about it. Without
 * this check a renderer could add a distortion and reference a SIM id that does
 * not exist, which would read as licensed while licensing nothing.
 */
export function validatePresentationsLicensed(
  declarations: readonly PresentationScaleDeclaration[],
  records: readonly SimplificationRecord[],
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const declaration of declarations) {
    const licence = findSimplification(records, declaration.id);
    if (!licence) {
      issues.push({
        severity: "error",
        code: "catalog-presentation-unlicensed",
        subject: `presentation:${declaration.id}`,
        message:
          `Presentation "${declaration.representationId}" cites SIM id "${declaration.id}", which is ` +
          "not in the simplification register.",
      });
      continue;
    }
    if (licence.scope !== "presentation") {
      issues.push({
        severity: "error",
        code: "catalog-presentation-unlicensed",
        subject: `presentation:${declaration.id}`,
        message:
          `SIM id "${declaration.id}" is registered with scope "${licence.scope}", so it does not ` +
          "license a rendering decision.",
      });
    }
  }

  return issues;
}
