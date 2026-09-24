/**
 * Content validation: the domain refuses impossible and contradictory science.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * PS-03 requires validation that catches "impossible or contradictory values"
 * (GAME-366) before any value can be displayed. Authoring a body is a
 * hand-written act, so the failure modes this module exists to catch are real:
 * a swapped semi-axis, a value in the wrong unit, a typo that makes an atmosphere
 * deeper than its planet, or a precision claim the source cannot support.
 *
 * Two design rules make this useful rather than decorative:
 *
 *  - **Every issue carries a stable `code`.** A code can be asserted in a test and
 *    matched in a build check; a prose message cannot.
 *  - **Blocking and advisory are different severities.** An impossible value is an
 *    `error` and must stop a build. A stylistic or confidence problem is a
 *    `warning` and may ship, because turning every advisory into a blocker trains
 *    authors to suppress the check.
 *
 * Nothing here reads content, the renderer, the clock, or the network: validation
 * is a pure function of the values it is given.
 */

import { ATTRIBUTES, ATTRIBUTE_IDS, type AttributeId } from "./attributes";
import { sourcedAttribute, type BodyId, type BodyRecord, type SourcedValue } from "./bodies";
import { canonicalMagnitude, unitKind } from "./quantities";

export type ValidationSeverity = "error" | "warning";

/** A single, machine-matchable validation finding. */
export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: ValidationIssueCode;
  /** What the issue is about: `body:<id>`, `body:<id>:<attribute>`, `register`, … */
  readonly subject: string;
  /** Developer/author-facing explanation. Learner-facing text lives in content. */
  readonly message: string;
}

export type ValidationIssueCode =
  // source register
  | "source-empty-field"
  | "source-unknown-attribute"
  | "source-missing-locator"
  | "source-unsafe-url"
  | "source-organization-unattributed"
  | "source-organization-redundant-name"
  | "source-malformed-date"
  | "source-review-note-missing"
  | "source-third-party-not-a-value-source"
  | "source-third-party-without-justification"
  | "register-duplicate-source-id"
  | "register-duplicate-field-entry"
  | "register-empty-version"
  | "register-policy-version-mismatch"
  | "register-entry-newer-than-register"
  // field resolution
  | "value-without-register-entry"
  | "value-references-missing-source"
  | "register-version-mismatch"
  | "value-source-attribute-mismatch"
  | "value-source-body-mismatch"
  // physical plausibility
  | "value-not-a-finite-number"
  | "value-negative"
  | "value-below-absolute-zero"
  | "value-precision-out-of-range"
  | "value-unit-kind-mismatch"
  | "value-non-canonical-unit"
  | "body-polar-exceeds-equatorial"
  | "body-radius-outside-axis-range"
  | "body-atmosphere-exceeds-radius"
  | "body-atmosphere-without-radius"
  | "body-relief-exceeds-diameter"
  | "body-orbital-radius-inside-body"
  // catalog
  | "catalog-duplicate-id"
  | "catalog-unknown-body"
  | "catalog-empty-field"
  | "catalog-mission-not-a-scale-property"
  | "catalog-mission-needs-two-targets"
  | "catalog-seed-out-of-range"
  | "catalog-target-duration"
  // presentation
  | "presentation-empty-id"
  | "presentation-missing-representation"
  | "presentation-duplicate-id"
  | "presentation-ratio-not-literal"
  | "presentation-undisclosed-distortion"
  | "presentation-missing-source-basis"
  | "presentation-missing-model-boundary";

export function isBlocking(issue: ValidationIssue): boolean {
  return issue.severity === "error";
}

export function blockingIssues(issues: readonly ValidationIssue[]): readonly ValidationIssue[] {
  return issues.filter(isBlocking);
}

export function hasBlockingIssues(issues: readonly ValidationIssue[]): boolean {
  return issues.some(isBlocking);
}

/** One-line rendering, used by build output and test failure messages. */
export function formatIssue(issue: ValidationIssue): string {
  return `${issue.severity.toUpperCase()} ${issue.code} ${issue.subject}: ${issue.message}`;
}

const MAX_SIGNIFICANT_DIGITS = 15;

/** Relative slack for same-body comparisons, so float noise is not a defect. */
const COMPARISON_TOLERANCE = 1e-9;

interface IssueInput {
  readonly severity?: ValidationSeverity;
  readonly code: ValidationIssueCode;
  readonly subject: string;
  readonly message: string;
}

function issue({ severity = "error", code, subject, message }: IssueInput): ValidationIssue {
  return { severity, code, subject, message };
}

/**
 * Validate one attribute value of one body against physics and the attribute
 * registry. `attributeId` is taken as data (not only as a type) because authored
 * content can be wrong, and a wrong key must be reported rather than ignored.
 */
export function validateSourcedValue(
  bodyId: BodyId,
  attributeId: string,
  sourced: SourcedValue,
): readonly ValidationIssue[] {
  const subject = `body:${bodyId}:${attributeId}`;
  const issues: ValidationIssue[] = [];

  if (!ATTRIBUTE_IDS.includes(attributeId as AttributeId)) {
    issues.push(
      issue({
        code: "source-unknown-attribute",
        subject,
        message: `"${attributeId}" is not an attribute in the science contract.`,
      }),
    );
    return issues;
  }

  const definition = ATTRIBUTES[attributeId as AttributeId];
  const { value } = sourced;

  if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
    issues.push(
      issue({
        code: "value-not-a-finite-number",
        subject,
        message: `Value must be a finite number; received ${String(value.value)}.`,
      }),
    );
    return issues;
  }

  if (unitKind(value.unit) !== definition.kind) {
    issues.push(
      issue({
        code: "value-unit-kind-mismatch",
        subject,
        message: `${definition.label} is a ${definition.kind}; "${value.unit}" is not.`,
      }),
    );
    return issues;
  }

  if (value.unit !== definition.canonicalUnit) {
    issues.push(
      issue({
        severity: "warning",
        code: "value-non-canonical-unit",
        subject,
        message:
          `Stored in "${value.unit}" but the declared canonical unit for ${definition.label} ` +
          `is "${definition.canonicalUnit}". Convert at authoring time so the stored value is canonical.`,
      }),
    );
  }

  if (
    !Number.isInteger(sourced.significantDigits) ||
    sourced.significantDigits < 1 ||
    sourced.significantDigits > MAX_SIGNIFICANT_DIGITS
  ) {
    issues.push(
      issue({
        code: "value-precision-out-of-range",
        subject,
        message:
          `significantDigits must be an integer in 1..${MAX_SIGNIFICANT_DIGITS}; ` +
          `received ${String(sourced.significantDigits)}.`,
      }),
    );
  }

  if (definition.kind === "length" && value.value < 0) {
    issues.push(
      issue({
        code: "value-negative",
        subject,
        message: `${definition.label} cannot be negative; received ${value.value} ${value.unit}.`,
      }),
    );
  }

  const baseMagnitude = canonicalMagnitude(value);
  if (definition.kind === "temperature" && baseMagnitude < 0) {
    issues.push(
      issue({
        code: "value-below-absolute-zero",
        subject,
        message:
          `Temperature ${value.value} ${value.unit} is below absolute zero ` +
          `(${baseMagnitude} K in canonical form).`,
      }),
    );
  }

  return issues;
}

/**
 * Validate one body: every attribute value is plausible, and no attribute is
 * declared twice.
 *
 * Cross-field checks are the ones that catch reversed or mistyped semi-axes,
 * which a per-field check cannot see.
 */
export function validateBody(body: BodyRecord): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Object keys cannot repeat in JavaScript, so an attribute cannot be declared
  // twice *on a body*. Two register entries claiming the same field is the real
  // duplicate hazard, and `validateRegister` catches it there.
  for (const [attributeId, sourced] of Object.entries(body.attributes)) {
    if (!sourced) continue;
    issues.push(...validateSourcedValue(body.id, attributeId, sourced));
  }

  issues.push(...validateBodyGeometry(body));
  return issues;
}

function magnitudeInBase(body: BodyRecord, attributeId: AttributeId): number | null {
  const sourced = sourcedAttribute(body, attributeId);
  if (!sourced) return null;
  const definition = ATTRIBUTES[attributeId];
  if (unitKind(sourced.value.unit) !== definition.kind) return null;
  return canonicalMagnitude(sourced.value);
}

function toleranceFor(reference: number): number {
  return Math.abs(reference) * COMPARISON_TOLERANCE;
}

/**
 * Cross-field geometry and layering checks.
 *
 * These are the "contradictory value" cases PS-03 calls out: they cannot be
 * detected field by field because each field is individually well-formed.
 */
function validateBodyGeometry(body: BodyRecord): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const subject = `body:${body.id}`;

  const mean = magnitudeInBase(body, "meanRadius");
  const equatorial = magnitudeInBase(body, "equatorialRadius");
  const polar = magnitudeInBase(body, "polarRadius");
  const atmosphere = magnitudeInBase(body, "atmosphereDepth");
  const relief = magnitudeInBase(body, "surfaceRelief");
  const orbit = magnitudeInBase(body, "orbitalRadius");

  if (equatorial !== null && polar !== null && polar > equatorial + toleranceFor(equatorial)) {
    issues.push(
      issue({
        code: "body-polar-exceeds-equatorial",
        subject,
        message:
          "Polar radius exceeds equatorial radius. Only a prolate body would do that; " +
          "confirm the two semi-axes were not swapped.",
      }),
    );
  }

  if (mean !== null && polar !== null && equatorial !== null) {
    const outside =
      mean < polar - toleranceFor(equatorial) || mean > equatorial + toleranceFor(equatorial);
    if (outside) {
      issues.push(
        issue({
          code: "body-radius-outside-axis-range",
          subject,
          message:
            "Mean radius lies outside the polar..equatorial range, which is impossible for " +
            "a triaxial body. One of the three radii is wrong.",
        }),
      );
    }
  }

  if (atmosphere !== null && (mean === null || mean <= 0)) {
    issues.push(
      issue({
        severity: "warning",
        code: "body-atmosphere-without-radius",
        subject,
        message:
          "An atmosphere-depth value exists but no mean radius does, so the layer proportion " +
          "cannot be checked. Add the radius before this proportion is displayed.",
      }),
    );
  } else if (atmosphere !== null && mean !== null && atmosphere >= mean) {
    issues.push(
      issue({
        code: "body-atmosphere-exceeds-radius",
        subject,
        message:
          "Atmosphere depth is at least the body's mean radius: the layer would contain the " +
          "whole body. Confirm the unit and the value.",
      }),
    );
  }

  if (relief !== null && mean !== null && relief >= 2 * mean) {
    issues.push(
      issue({
        code: "body-relief-exceeds-diameter",
        subject,
        message:
          "Surface relief is at least the body's diameter. Relief cannot exceed the span it " +
          "is measured across; confirm the unit and the value.",
      }),
    );
  }

  if (orbit !== null && mean !== null && orbit <= mean) {
    issues.push(
      issue({
        code: "body-orbital-radius-inside-body",
        subject,
        message:
          "Orbital radius is not greater than the body's own radius: the body would orbit " +
          "inside itself. Confirm the unit and the reference (heliocentric, not planetocentric).",
      }),
    );
  }

  return issues;
}
