/**
 * The per-field source register: schema, source policy, and record validation.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * This module makes "every displayed value is traceable to an authority" a
 * testable property rather than a promise. It encodes docs/SCIENCE_MODEL.md §5 as
 * types and checks:
 *
 *  1. which source classes may carry a *displayed* value at all, in preference
 *     order (agency primary > peer-reviewed > agency dataset > nothing else);
 *  2. what a register record must state before it counts as a citation;
 *  3. how a third-party source may be used without laundering an unsourced
 *     number — it may locate a primary source, and may never be one.
 *
 * The register *data* lives in `src/content/`, because source citations contain
 * absolute URLs and `scripts/check-privacy-surface.mjs` permits those only there.
 * This module stays URL-data-free: it validates URLs without holding any.
 */

import type { ReviewStatus } from "./bodies";
import type { ValidationIssue } from "./validation";

/** An ISO 8601 calendar date, `YYYY-MM-DD`. Compared lexicographically. */
export type IsoDate = string;

/**
 * Accepted source classes, in descending preference (docs/SCIENCE_MODEL.md §5.1).
 *
 * `third-party` is present so it can be *recorded and audited* — never so it can
 * be cited as the origin of a displayed value.
 */
export type SourceClass = "agency-primary" | "peer-reviewed" | "agency-dataset" | "third-party";

export const SOURCE_CLASS_PREFERENCE: readonly SourceClass[] = [
  "agency-primary",
  "peer-reviewed",
  "agency-dataset",
  "third-party",
];

/**
 * The classes that may originate a displayed value.
 *
 * Derived from the preference list rather than written twice, so "preferred" and
 * "permitted" cannot drift apart. `third-party` is excluded by construction:
 * docs/SCIENCE_MODEL.md §5.1 allows it only to *find* a primary source.
 */
export const VALUE_SOURCE_CLASSES: readonly SourceClass[] = SOURCE_CLASS_PREFERENCE.filter(
  (sourceClass) => sourceClass !== "third-party",
);

/** The organizations the science contract prefers, plus an explicit escape hatch. */
export type SourceOrganization = "NASA" | "JPL" | "USGS" | "ESA" | "other";

export const PREFERRED_ORGANIZATIONS: readonly SourceOrganization[] = ["NASA", "JPL", "USGS"];

/**
 * What a register record is *for*.
 *
 * A `value-source` is the authority behind a displayed number. A `locator` is how
 * the author found that authority. Conflating the two is how an infographic ends
 * up cited as a measurement, so they are separate roles.
 */
export type SourceRole = "value-source" | "locator";

/** Bumped whenever the policy in this module changes. Recorded in the register. */
export const SOURCE_POLICY_VERSION = "ps-03-source-policy-1";

/** One row of the per-field source register (docs/SCIENCE_MODEL.md §5.2). */
export interface SourceRecord {
  /** Stable, human-readable id; the value a `SourcedValue.sourceId` points at. */
  readonly id: string;
  /** The body this entry is about. */
  readonly bodyId: string;
  /** The attribute this entry is about. */
  readonly attributeId: string;
  readonly role: SourceRole;
  readonly sourceClass: SourceClass;
  readonly sourceTitle: string;
  readonly organization: SourceOrganization;
  /**
   * Required when `organization` is `other`, so an exception is attributed to a
   * named body rather than to nothing. Must be absent otherwise: agency
   * attribution is a citation line, not a co-brand (docs/SCIENCE_MODEL.md §5.4).
   */
  readonly organizationName?: string;
  /** Absolute https URL of the source page or dataset. */
  readonly url?: string;
  /** Stable dataset/table identifier, where a URL is not the right locator. */
  readonly datasetIdentifier?: string;
  /** The date the value was read from the source. */
  readonly retrievedOn: IsoDate;
  /** What precision the source actually supports — bounds display precision. */
  readonly precisionNote: string;
  /** Reference epoch/orbit when the value is epoch-dependent. */
  readonly appliesToEpoch?: string;
  readonly reviewStatus: ReviewStatus;
  /** Required once a value has been reviewed or contested; empty while unreviewed. */
  readonly reviewNote: string;
  /**
   * Required for `third-party` records: why a non-authoritative source was
   * consulted at all, and which primary source it led to.
   */
  readonly exceptionJustification?: string;
}

/** Rank in the preference order; lower is preferred. Unknown classes rank last. */
export function sourceClassRank(sourceClass: SourceClass): number {
  const index = SOURCE_CLASS_PREFERENCE.indexOf(sourceClass);
  return index === -1 ? SOURCE_CLASS_PREFERENCE.length : index;
}

/** Whether a source class may originate a displayed value. */
export function mayCarryDisplayedValue(sourceClass: SourceClass): boolean {
  return VALUE_SOURCE_CLASSES.includes(sourceClass);
}

/** Whether a record comes from one of the preferred agencies. */
export function isPreferredAgency(organization: SourceOrganization): boolean {
  return PREFERRED_ORGANIZATIONS.includes(organization);
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseIsoDate(value: string): CivilDate | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Whether a string is a well-formed ISO calendar date.
 *
 * Deliberately not wall-clock-based: JavaScript's own date parsing silently rolls
 * a non-existent day over into the next month, which would let a typo'd retrieval
 * date pass validation. Calendar arithmetic is checked directly instead.
 */
export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

/** Days in a Gregorian month. Exported so the register can be audited by tests. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Convert an ISO date to a day number, or `null` if malformed.
 *
 * Howard Hinnant's `days_from_civil`, which is exact for the proleptic Gregorian
 * calendar. Used instead of `Date` so freshness arithmetic cannot depend on the
 * host time zone — the same register must age identically in every environment.
 */
export function isoDateToDayNumber(value: string): number | null {
  const date = parseIsoDate(value);
  if (!date) return null;

  const { year, month, day } = date;
  const adjustedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/**
 * Validate one register record.
 *
 * Returns every problem rather than the first, because an author fixing a
 * citation wants the whole list.
 */
export function validateSourceRecord(record: SourceRecord): readonly ValidationIssue[] {
  const subject = `source:${record.id}`;
  const issues: ValidationIssue[] = [];

  const empty = (field: string, value: string | undefined): boolean => {
    if (value === undefined || value.trim() === "") {
      issues.push({
        severity: "error",
        code: "source-empty-field",
        subject,
        message: `${field} is required and must not be blank.`,
      });
      return true;
    }
    return false;
  };

  empty("id", record.id);
  empty("bodyId", record.bodyId);
  empty("sourceTitle", record.sourceTitle);
  empty("precisionNote", record.precisionNote);

  empty("attributeId", record.attributeId);

  if (!isIsoDate(record.retrievedOn)) {
    issues.push({
      severity: "error",
      code: "source-malformed-date",
      subject,
      message: `retrievedOn must be a real ISO date (YYYY-MM-DD); received "${record.retrievedOn}".`,
    });
  }

  if (!mayCarryDisplayedValue(record.sourceClass) && record.role === "value-source") {
    issues.push({
      severity: "error",
      code: "source-third-party-not-a-value-source",
      subject,
      message:
        `A ${record.sourceClass} source may locate a primary source but may not originate a ` +
        "displayed value (docs/SCIENCE_MODEL.md §5.1). Record the primary source it led to.",
    });
  }

  if (record.sourceClass === "third-party") {
    empty("exceptionJustification", record.exceptionJustification);
  }

  if (record.organization === "other") {
    empty("organizationName", record.organizationName);
  } else if (record.organizationName !== undefined) {
    issues.push({
      severity: "error",
      code: "source-organization-redundant-name",
      subject,
      message:
        `organizationName is only for organization "other"; "${record.organization}" is already ` +
        "a named agency, and agency attribution is a citation line rather than a co-brand.",
    });
  }

  const hasUrl = record.url !== undefined && record.url.trim() !== "";
  const hasDataset = record.datasetIdentifier !== undefined && record.datasetIdentifier.trim() !== "";

  if (!hasUrl && !hasDataset) {
    issues.push({
      severity: "error",
      code: "source-missing-locator",
      subject,
      message: "A register entry needs a stable locator: either url or datasetIdentifier.",
    });
  }

  if (hasUrl && !/^https:\/\/\S+$/.test(record.url as string)) {
    issues.push({
      severity: "error",
      code: "source-unsafe-url",
      subject,
      message:
        `url must be an absolute https URL; received "${record.url}". Plain http and other ` +
        "schemes are not acceptable citations.",
    });
  }

  if (record.reviewStatus !== "unreviewed" && record.reviewNote.trim() === "") {
    issues.push({
      severity: "error",
      code: "source-review-note-missing",
      subject,
      message:
        `reviewNote is required when reviewStatus is "${record.reviewStatus}": a review that ` +
        "states no rationale cannot be audited.",
    });
  }

  if (record.appliesToEpoch !== undefined && record.appliesToEpoch.trim() === "") {
    issues.push({
      severity: "error",
      code: "source-empty-field",
      subject,
      message: "appliesToEpoch, when present, must not be blank.",
    });
  }

  return issues;
}
