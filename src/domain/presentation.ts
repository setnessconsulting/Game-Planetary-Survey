/**
 * Presentation scale and distortion metadata.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * PS-03 requires "explicit scale/distortion metadata for rendered
 * representations" (GAME-366). The reason that metadata is a *domain* concern
 * rather than a renderer constant is docs/SCIENCE_MODEL.md §7-§8: the system
 * comparison view is deliberately not drawn to literal scale, and a drawing rule
 * that nobody can inspect is exactly how a learner ends up believing that Saturn
 * is nearly as wide as the gap to the Sun.
 *
 * So a distorted representation must declare, in data:
 *
 *  - what it is a representation of (`representationId`);
 *  - how distorted it is (`ratio`, drawn : literal);
 *  - what it is derived from (`sourceBasisIds`);
 *  - why it is distorted (`rationale`), and where the model stops being valid
 *    (`modelBoundary`);
 *  - the exact words the learner is shown (`learnerText`).
 *
 * `applyPresentationDeclaration` is the only supported way to turn that metadata
 * into renderer-facing values, and it is typed to carry a scale factor and a
 * notice — never a scientific value. A declaration can therefore change what a
 * world *looks* like and can never change what it *is*.
 */

import type { ReviewStatus } from "./bodies";
import type { ValidationIssue } from "./validation";

export type PresentationDistortionKind =
  /** Drawn to literal scale. The only kind that may omit learner text. */
  | "literal"
  /** All lengths scaled by one factor: relative sizes remain truthful. */
  | "uniformScale"
  /** Distance compressed non-linearly so a system view is legible at all. */
  | "nonLinearCompression"
  /** Layer thickness drawn thicker than it is, so a thin shell stays visible. */
  | "layerThicknessExaggeration"
  /** A representative surface, not the surface observed at any particular time. */
  | "representativeSurface";

/** Human-readable wording for a distortion kind, used in accessible descriptions. */
export const DISTORTION_KIND_LABELS: Readonly<Record<PresentationDistortionKind, string>> = {
  literal: "drawn to literal scale",
  uniformScale: "scaled uniformly",
  nonLinearCompression: "compressed non-linearly",
  layerThicknessExaggeration: "layer thickness exaggerated",
  representativeSurface: "a representative surface, not a specific time",
};

export interface PresentationScaleDeclaration {
  /** Simplification id, matching the `SIM-<n>` register in docs/SCIENCE_MODEL.md §7.1. */
  readonly id: string;
  /** Which representation this declaration governs, e.g. `system-comparison`. */
  readonly representationId: string;
  readonly kind: PresentationDistortionKind;
  /** Drawn size divided by literal size. `1` means literally to scale. */
  readonly ratio: number;
  /** Register entries this representation illustrates. Required when distorted. */
  readonly sourceBasisIds: readonly string[];
  readonly rationale: string;
  readonly modelBoundary: string;
  /** The exact words shown to the learner. Required when distorted. */
  readonly learnerText: string;
  readonly reviewStatus: ReviewStatus;
}

function blank(value: string): boolean {
  return value.trim() === "";
}

function issue(
  code: ValidationIssue["code"],
  subject: string,
  message: string,
): ValidationIssue {
  return { severity: "error", code, subject, message };
}

/** Validate one declaration against the rules above. */
export function validatePresentationDeclaration(
  declaration: PresentationScaleDeclaration,
): readonly ValidationIssue[] {
  const subject = `presentation:${declaration.id}`;
  const issues: ValidationIssue[] = [];

  if (blank(declaration.id)) {
    issues.push(issue("presentation-empty-id", subject, "A declaration needs an id."));
  }
  if (blank(declaration.representationId)) {
    issues.push(
      issue("presentation-missing-representation", subject, "representationId must name the view."),
    );
  }
  if (blank(declaration.rationale)) {
    issues.push(issue("presentation-missing-model-boundary", subject, "rationale is required."));
  }
  if (!Number.isFinite(declaration.ratio) || declaration.ratio <= 0) {
    issues.push(
      issue(
        "presentation-ratio-not-literal",
        subject,
        `ratio must be a finite positive drawn:literal factor; received ${String(declaration.ratio)}.`,
      ),
    );
    return issues;
  }

  if (declaration.kind === "literal") {
    if (declaration.ratio !== 1) {
      issues.push(
        issue(
          "presentation-ratio-not-literal",
          subject,
          `kind "literal" requires ratio 1; received ${declaration.ratio}. ` +
            "Declare the distortion instead of hiding it behind a literal label.",
        ),
      );
    }
    return issues;
  }

  // Everything below applies only to a distorted representation.
  if (declaration.ratio === 1) {
    issues.push(
      issue(
        "presentation-undisclosed-distortion",
        subject,
        `kind "${declaration.kind}" is a distortion but ratio is 1, so nothing is actually distorted.`,
      ),
    );
  }
  if (blank(declaration.modelBoundary)) {
    issues.push(
      issue(
        "presentation-missing-model-boundary",
        subject,
        "modelBoundary is required: the learner must be told where the model stops being valid.",
      ),
    );
  }
  if (blank(declaration.learnerText)) {
    issues.push(
      issue(
        "presentation-undisclosed-distortion",
        subject,
        "learnerText is required: a simplification the learner is never told about is a lie, not a simplification.",
      ),
    );
  }
  if (declaration.sourceBasisIds.filter((id) => !blank(id)).length === 0) {
    issues.push(
      issue(
        "presentation-missing-source-basis",
        subject,
        "sourceBasisIds is required: every simplification is licensed by the value it illustrates " +
          "(docs/SCIENCE_MODEL.md §7).",
      ),
    );
  }

  return issues;
}

/** Validate a set of declarations, including that ids are unique. */
export function validatePresentationDeclarations(
  declarations: readonly PresentationScaleDeclaration[],
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const declaration of declarations) {
    issues.push(...validatePresentationDeclaration(declaration));
    if (seen.has(declaration.id)) {
      issues.push(
        issue(
          "presentation-duplicate-id",
          `presentation:${declaration.id}`,
          "Two declarations share this id; a SIM id must identify exactly one simplification.",
        ),
      );
    }
    seen.add(declaration.id);
  }

  return issues;
}

/** The declaration governing a representation, if one exists. */
export function findDeclaration(
  declarations: readonly PresentationScaleDeclaration[],
  representationId: string,
): PresentationScaleDeclaration | undefined {
  return declarations.find((declaration) => declaration.representationId === representationId);
}

/** Renderer-facing presentation facts. Contains no scientific value, by type. */
export interface PresentationApplication {
  readonly scaleFactor: number;
  readonly scaleNotice: string;
  readonly declarationId: string | null;
}

export interface PresentationFallback {
  readonly scaleFactor: number;
  readonly scaleNotice: string;
}

/**
 * Turn a declaration into renderer-facing presentation facts.
 *
 * With no declaration (or a literal one) the caller's fallback is preserved
 * exactly, so the honest "not drawn to literal scale" notice cannot be swallowed
 * by the absence of metadata.
 */
export function applyPresentationDeclaration(
  declaration: PresentationScaleDeclaration | undefined,
  fallback: PresentationFallback,
): PresentationApplication {
  if (!declaration || declaration.kind === "literal") {
    return {
      scaleFactor: declaration ? 1 : fallback.scaleFactor,
      scaleNotice: fallback.scaleNotice,
      declarationId: declaration ? declaration.id : null,
    };
  }

  return {
    scaleFactor: declaration.ratio,
    scaleNotice: declaration.learnerText,
    declarationId: declaration.id,
  };
}
