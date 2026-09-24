/**
 * Source register contract tests (GAME-366).
 *
 * These pin the acceptance criteria that make provenance real:
 *  - every scored/required fact resolves to a source record;
 *  - a value with no register entry cannot ship;
 *  - the same register content always produces the same serialization and digest;
 *  - freshness is a function of recorded dates, not of the clock.
 */

import { describe, expect, it } from "vitest";

import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, FIXTURE_REGISTER_VERSION } from "@/testing/devFixture";
import {
  FIXTURE_REGISTER_RETRIEVED_ON,
  FIXTURE_SOURCE_REGISTER,
} from "@/testing/sourcedFixture";
import {
  DEFAULT_FRESHNESS_THRESHOLDS,
  assessRegisterFreshness,
  assertRegisterValid,
  createRegisterIndex,
  emptyRegister,
  findSourceById,
  registerDigest,
  resolveSource,
  serializeRegister,
  sourcesFor,
  validateBodiesAgainstRegister,
  validateRegister,
  type SourceRegister,
} from "@/domain/register";
import {
  SOURCE_CLASS_PREFERENCE,
  SOURCE_POLICY_VERSION,
  VALUE_SOURCE_CLASSES,
  daysInMonth,
  isIsoDate,
  isLeapYear,
  isoDateToDayNumber,
  isPreferredAgency,
  mayCarryDisplayedValue,
  sourceClassRank,
  validateSourceRecord,
  type SourceClass,
  type SourceRecord,
} from "@/domain/sources";
import { hasBlockingIssues, type ValidationIssue } from "@/domain/validation";

function codes(issues: readonly ValidationIssue[]): readonly string[] {
  return issues.map((issue) => issue.code);
}

function baseRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "entry",
    bodyId: FIXTURE_ALPHA,
    attributeId: "meanRadius",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "A title",
    organization: "NASA",
    url: "https://example.invalid/a",
    retrievedOn: FIXTURE_REGISTER_RETRIEVED_ON,
    precisionNote: "Two significant figures.",
    reviewStatus: "unreviewed",
    reviewNote: "",
    ...overrides,
  };
}

interface RegisterOverrides {
  readonly version?: string;
  readonly policyVersion?: string;
  readonly retrievedOn?: string;
}

function registerWith(
  entries: readonly SourceRecord[],
  overrides: RegisterOverrides = {},
): SourceRegister {
  return {
    ...emptyRegister(overrides.version ?? "test-register", overrides.retrievedOn ?? FIXTURE_REGISTER_RETRIEVED_ON),
    ...(overrides.policyVersion !== undefined ? { policyVersion: overrides.policyVersion } : {}),
    entries,
  };
}

describe("source policy", () => {
  it("orders agency primary ahead of every other class", () => {
    expect(SOURCE_CLASS_PREFERENCE).toEqual([
      "agency-primary",
      "peer-reviewed",
      "agency-dataset",
      "third-party",
    ]);
    const ranks = SOURCE_CLASS_PREFERENCE.map(sourceClassRank);
    expect(ranks).toEqual([0, 1, 2, 3]);
  });

  it("ranks an unknown class last rather than accepting it", () => {
    expect(sourceClassRank("invented-blog" as SourceClass)).toBe(SOURCE_CLASS_PREFERENCE.length);
  });

  it("permits a displayed value only from an accepted class", () => {
    expect(VALUE_SOURCE_CLASSES).toEqual(["agency-primary", "peer-reviewed", "agency-dataset"]);
    expect(mayCarryDisplayedValue("agency-primary")).toBe(true);
    expect(mayCarryDisplayedValue("peer-reviewed")).toBe(true);
    expect(mayCarryDisplayedValue("agency-dataset")).toBe(true);
    // The whole point of the third-party exception: it may locate, not originate.
    expect(mayCarryDisplayedValue("third-party")).toBe(false);
  });

  it("names the preferred agencies", () => {
    expect(isPreferredAgency("NASA")).toBe(true);
    expect(isPreferredAgency("JPL")).toBe(true);
    expect(isPreferredAgency("USGS")).toBe(true);
    expect(isPreferredAgency("ESA")).toBe(false);
    expect(isPreferredAgency("other")).toBe(false);
  });
});

describe("calendar dates", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isIsoDate("2026-09-24")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-2-4")).toBe(false);
    expect(isIsoDate("2026-09-24T00:00:00Z")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("2026-09-00")).toBe(false);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
  });

  it("converts dates to day numbers deterministically", () => {
    const day = (value: string): number => {
      const result = isoDateToDayNumber(value);
      if (result === null) throw new Error(`expected ${value} to be a real date`);
      return result;
    };

    expect(day("1970-01-01")).toBe(0);
    expect(day("1970-01-02")).toBe(1);
    expect(day("1969-12-31")).toBe(-1);
    // The leap day exists in 2024 and does not skip a day number.
    expect(day("2024-02-29")).toBe(day("2024-03-01") - 1);
    expect(day("2026-09-24")).toBe(day("2026-09-23") + 1);
    expect(isoDateToDayNumber("not-a-date")).toBeNull();
    expect(isoDateToDayNumber("2026-02-30")).toBeNull();
  });
});

describe("validateSourceRecord", () => {
  it("accepts a complete record and one located by dataset id", () => {
    expect(validateSourceRecord(baseRecord())).toEqual([]);
    const { url: _url, ...withoutUrl } = baseRecord({ datasetIdentifier: "dataset:1" });
    expect(validateSourceRecord(withoutUrl as SourceRecord)).toEqual([]);
  });

  it("requires every identifying field", () => {
    expect(codes(validateSourceRecord(baseRecord({ id: "  " })))).toContain("source-empty-field");
    expect(codes(validateSourceRecord(baseRecord({ bodyId: "" })))).toContain("source-empty-field");
    expect(codes(validateSourceRecord(baseRecord({ sourceTitle: "" })))).toContain(
      "source-empty-field",
    );
    expect(codes(validateSourceRecord(baseRecord({ precisionNote: "" })))).toContain(
      "source-empty-field",
    );
    expect(codes(validateSourceRecord(baseRecord({ attributeId: "" })))).toContain(
      "source-empty-field",
    );
  });

  it("rejects a malformed retrieval date", () => {
    expect(codes(validateSourceRecord(baseRecord({ retrievedOn: "24/09/2026" })))).toContain(
      "source-malformed-date",
    );
  });

  it("never lets a third-party source originate a displayed value", () => {
    expect(
      codes(
        validateSourceRecord(
          baseRecord({ sourceClass: "third-party", exceptionJustification: "used to locate" }),
        ),
      ),
    ).toContain("source-third-party-not-a-value-source");
  });

  it("requires a justification for a third-party exception", () => {
    expect(
      codes(
        validateSourceRecord(
          baseRecord({
            sourceClass: "third-party",
            role: "locator",
            organization: "other",
            organizationName: "Some Index",
            exceptionJustification: "  ",
          }),
        ),
      ),
    ).toContain("source-empty-field");
  });

  it("accepts a documented third-party locator", () => {
    const locator = baseRecord({
      sourceClass: "third-party",
      role: "locator",
      organization: "other",
      organizationName: "Some Index",
      exceptionJustification: "Located the agency page that carries the value.",
    });
    expect(validateSourceRecord(locator)).toEqual([]);
  });

  it("requires a named organization for an exception, and forbids a redundant one", () => {
    expect(
      codes(validateSourceRecord(baseRecord({ organization: "other" }))),
    ).toContain("source-empty-field");
    expect(
      codes(validateSourceRecord(baseRecord({ organizationName: "NASA also" }))),
    ).toContain("source-organization-redundant-name");
  });

  it("requires a locator, and requires it to be a safe one", () => {
    const { url: _url, ...withoutLocator } = baseRecord();
    expect(codes(validateSourceRecord(withoutLocator as SourceRecord))).toContain(
      "source-missing-locator",
    );
    expect(codes(validateSourceRecord(baseRecord({ url: "   " })))).toContain(
      "source-missing-locator",
    );
    expect(codes(validateSourceRecord(baseRecord({ url: "http://example.invalid" })))).toContain(
      "source-unsafe-url",
    );
    expect(codes(validateSourceRecord(baseRecord({ url: "ftp://example.invalid" })))).toContain(
      "source-unsafe-url",
    );
  });

  it("requires a rationale once a value has been reviewed", () => {
    expect(
      codes(validateSourceRecord(baseRecord({ reviewStatus: "reviewed", reviewNote: "" }))),
    ).toContain("source-review-note-missing");
    expect(
      codes(validateSourceRecord(baseRecord({ reviewStatus: "contested", reviewNote: "disputed" }))),
    ).toEqual([]);
    expect(codes(validateSourceRecord(baseRecord({ reviewStatus: "unreviewed" })))).toEqual([]);
  });

  it("rejects a blank epoch when one is present", () => {
    expect(codes(validateSourceRecord(baseRecord({ appliesToEpoch: " " })))).toContain(
      "source-empty-field",
    );
    expect(codes(validateSourceRecord(baseRecord({ appliesToEpoch: "J2000" })))).toEqual([]);
  });
});

describe("the fixture register", () => {
  it("validates clean, which is what makes it usable as a golden fixture", () => {
    expect(validateRegister(FIXTURE_SOURCE_REGISTER)).toEqual([]);
    expect(() => assertRegisterValid(FIXTURE_SOURCE_REGISTER)).not.toThrow();
  });

  it("covers every value in the fixture bodies, so the gate is actually exercised", () => {
    expect(validateBodiesAgainstRegister(DEV_FIXTURE_BODIES, FIXTURE_SOURCE_REGISTER)).toEqual([]);
  });

  it("resolves each field to its agency primary entry", () => {
    const resolved = resolveSource(FIXTURE_SOURCE_REGISTER, FIXTURE_ALPHA, "meanRadius");
    expect(resolved?.id).toBe("fixture.alpha.radius");
    expect(resolved?.sourceClass).toBe("agency-primary");
  });

  it("never resolves a locator as the authority for a value", () => {
    const sources = sourcesFor(FIXTURE_SOURCE_REGISTER, FIXTURE_ALPHA, "meanRadius");
    expect(sources.map((entry) => entry.role)).toEqual(["value-source", "locator"]);
    expect(sources.every((entry) => entry.attributeId === "meanRadius")).toBe(true);
  });
});

describe("register resolution", () => {
  it("indexes by id and by field", () => {
    const index = createRegisterIndex(FIXTURE_SOURCE_REGISTER);
    expect(index.byId.size).toBe(FIXTURE_SOURCE_REGISTER.entries.length);
    expect(index.byField.size).toBe(6);
    expect(index.byField.get(`${FIXTURE_ALPHA}::meanRadius`)?.length).toBe(2);
  });

  it("finds a source by id, and reports an unknown id as absent", () => {
    expect(findSourceById(FIXTURE_SOURCE_REGISTER, "fixture.beta.radius")?.bodyId).toBe("fixture-beta");
    expect(findSourceById(FIXTURE_SOURCE_REGISTER, "nope")).toBeUndefined();
  });

  it("returns an empty list for a field with no entries", () => {
    expect(sourcesFor(FIXTURE_SOURCE_REGISTER, FIXTURE_ALPHA, "surfaceRelief")).toEqual([]);
    expect(resolveSource(FIXTURE_SOURCE_REGISTER, FIXTURE_ALPHA, "surfaceRelief")).toBeUndefined();
  });

  it("prefers the higher-priority class when a field has two authorities", () => {
    const register = registerWith([
      baseRecord({ id: "dataset", sourceClass: "agency-dataset" }),
      baseRecord({ id: "primary", sourceClass: "agency-primary" }),
    ]);
    expect(resolveSource(register, FIXTURE_ALPHA, "meanRadius")?.id).toBe("primary");
  });

  it("does not resolve a value that only a rejected class covers", () => {
    const register = registerWith([
      baseRecord({
        id: "third-party",
        sourceClass: "third-party",
        role: "locator",
        organization: "other",
        organizationName: "An Index",
        exceptionJustification: "found it",
      }),
    ]);
    expect(resolveSource(register, FIXTURE_ALPHA, "meanRadius")).toBeUndefined();
  });
});

describe("validateRegister", () => {
  it("accepts the fixture register and the shipped empty register", () => {
    expect(validateRegister(emptyRegister("v1", FIXTURE_REGISTER_RETRIEVED_ON))).toEqual([]);
  });

  it("requires a version, because nothing can be re-derived without one", () => {
    expect(
      codes(validateRegister(registerWith([], { version: " " }))),
    ).toContain("register-empty-version");
  });

  it("rejects a register that conforms to a policy this build does not implement", () => {
    expect(
      codes(validateRegister(registerWith([], { policyVersion: "ps-01-source-policy-0" }))),
    ).toContain("register-policy-version-mismatch");
  });

  it("rejects a malformed register date", () => {
    expect(
      codes(validateRegister(registerWith([], { retrievedOn: "yesterday" }))),
    ).toContain("source-malformed-date");
  });

  it("rejects two entries sharing an id", () => {
    const register = registerWith([
      baseRecord({ id: "dupe" }),
      baseRecord({ id: "dupe", attributeId: "polarRadius" }),
    ]);
    expect(codes(validateRegister(register))).toContain("register-duplicate-source-id");
  });

  it("rejects two authorities for one displayed field", () => {
    const register = registerWith([baseRecord({ id: "a" }), baseRecord({ id: "b" })]);
    expect(codes(validateRegister(register))).toContain("register-duplicate-field-entry");
  });

  it("allows several locators beside one value source", () => {
    const register = registerWith([
      baseRecord({ id: "authority" }),
      baseRecord({
        id: "locator-1",
        role: "locator",
        sourceClass: "third-party",
        organization: "other",
        organizationName: "An Index",
        exceptionJustification: "found it",
      }),
    ]);
    expect(validateRegister(register)).toEqual([]);
  });

  it("rejects an entry retrieved after the register was assembled", () => {
    const register = registerWith([baseRecord({ retrievedOn: "2026-10-01" })]);
    expect(codes(validateRegister(register))).toContain("register-entry-newer-than-register");
  });

  it("rejects an attribute the science contract does not define", () => {
    const register = registerWith([baseRecord({ attributeId: "diameter" })]);
    expect(codes(validateRegister(register))).toContain("source-unknown-attribute");
  });

  it("does not attribute-check a locator, whose field is only where it led", () => {
    const register = registerWith([
      baseRecord({
        id: "locator",
        role: "locator",
        attributeId: "not-an-attribute",
        sourceClass: "third-party",
        organization: "other",
        organizationName: "An Index",
        exceptionJustification: "found it",
      }),
    ]);
    expect(codes(validateRegister(register))).not.toContain("source-unknown-attribute");
  });

  it("assertRegisterValid throws with the offending codes", () => {
    const register = registerWith([baseRecord({ sourceTitle: "" })]);
    expect(() => assertRegisterValid(register)).toThrow(/register-empty|source-empty-field/);
    expect(hasBlockingIssues(validateRegister(register))).toBe(true);
  });
});

describe("validateBodiesAgainstRegister", () => {
  it("reports a value whose source is not in the register", () => {
    const issues = validateBodiesAgainstRegister(DEV_FIXTURE_BODIES, emptyRegister("other", FIXTURE_REGISTER_RETRIEVED_ON));
    expect(codes(issues)).toContain("value-without-register-entry");
    expect(codes(issues)).toContain("register-version-mismatch");
  });

  it("reports a value citing a locator or a rejected class", () => {
    const register = registerWith(
      [
        baseRecord({
          id: "fixture.alpha.radius",
          role: "locator",
          sourceClass: "third-party",
          organization: "other",
          organizationName: "An Index",
          exceptionJustification: "found it",
        }),
      ],
      { version: FIXTURE_REGISTER_VERSION },
    );
    const issues = validateBodiesAgainstRegister(DEV_FIXTURE_BODIES, register);
    expect(codes(issues)).toContain("value-references-missing-source");
  });

  it("reports a source registered for a different attribute or body", () => {
    const register = registerWith(
      [baseRecord({ id: "fixture.alpha.radius", attributeId: "polarRadius", bodyId: "somewhere-else" })],
      { version: FIXTURE_REGISTER_VERSION },
    );
    const issues = validateBodiesAgainstRegister(DEV_FIXTURE_BODIES, register);
    expect(codes(issues)).toContain("value-source-attribute-mismatch");
    expect(codes(issues)).toContain("value-source-body-mismatch");
  });
});

describe("deterministic serialization", () => {
  it("is identical regardless of authoring order", () => {
    const forward = registerWith([baseRecord({ id: "a" }), baseRecord({ id: "b", attributeId: "polarRadius" })]);
    const reverse = registerWith([baseRecord({ id: "b", attributeId: "polarRadius" }), baseRecord({ id: "a" })]);
    expect(serializeRegister(forward)).toBe(serializeRegister(reverse));
    expect(registerDigest(forward)).toBe(registerDigest(reverse));
  });

  it("changes when a value changes", () => {
    const original = registerWith([baseRecord()]);
    const changed = registerWith([baseRecord({ precisionNote: "Three significant figures." })]);
    expect(registerDigest(original)).not.toBe(registerDigest(changed));
  });

  it("pins a golden digest for the fixture register", () => {
    // A golden value: if this changes, register content or canonicalization changed,
    // and every goldened snapshot digest has to be revisited deliberately.
    expect(registerDigest(FIXTURE_SOURCE_REGISTER)).toBe("a29be4cf");
  });

  it("pins a golden serialization shape", () => {
    expect(serializeRegister(emptyRegister("v1", FIXTURE_REGISTER_RETRIEVED_ON))).toBe(
      `{"entries":[],"policyVersion":"${SOURCE_POLICY_VERSION}","retrievedOn":"${FIXTURE_REGISTER_RETRIEVED_ON}","version":"v1"}`,
    );
  });
});

describe("freshness", () => {
  const aged = registerWith([
    baseRecord({ id: "recent", retrievedOn: "2026-09-01" }),
    baseRecord({ id: "old", attributeId: "polarRadius", retrievedOn: "2019-01-01" }),
  ]);

  it("reports a register as current when it is fresh", () => {
    const report = assessRegisterFreshness(FIXTURE_SOURCE_REGISTER, FIXTURE_REGISTER_RETRIEVED_ON);
    expect(report.state).toBe("current");
    expect(report.entries.every((entry) => entry.ageInDays === 0)).toBe(true);
    expect(report.oldestAgeInDays).toBe(0);
    expect(report.thresholds).toEqual(DEFAULT_FRESHNESS_THRESHOLDS);
  });

  it("classifies aging and stale entries and reports the worst state", () => {
    const report = assessRegisterFreshness(aged, "2026-09-24");
    expect(report.state).toBe("stale");
    expect(report.entries.map((entry) => entry.state)).toEqual(["current", "stale"]);
    expect(report.oldestAgeInDays).toBeGreaterThan(2000);
  });

  it("classifies an entry between the thresholds as aging", () => {
    const report = assessRegisterFreshness(
      registerWith([baseRecord({ retrievedOn: "2024-01-01" })]),
      "2026-09-24",
    );
    expect(report.state).toBe("aging");
  });

  it("honours custom thresholds as data", () => {
    const report = assessRegisterFreshness(
      registerWith([baseRecord({ retrievedOn: "2026-09-20" })]),
      "2026-09-24",
      { agingDays: 1, staleDays: 2 },
    );
    expect(report.state).toBe("stale");
    expect(report.thresholds).toEqual({ agingDays: 1, staleDays: 2 });
  });

  it("reports an empty register as unknown rather than fresh", () => {
    const report = assessRegisterFreshness(emptyRegister("v1", FIXTURE_REGISTER_RETRIEVED_ON), "2026-09-24");
    expect(report.state).toBe("unknown");
    expect(report.oldestAgeInDays).toBeNull();
    expect(report.entries).toEqual([]);
  });

  it("reports unknown when the reference date is unusable", () => {
    const report = assessRegisterFreshness(aged, "whenever");
    expect(report.state).toBe("unknown");
    expect(report.entries.every((entry) => entry.state === "unknown")).toBe(true);
  });

  it("reports unknown for an entry with an unusable retrieval date", () => {
    const report = assessRegisterFreshness(
      registerWith([baseRecord({ retrievedOn: "sometime" })]),
      "2026-09-24",
    );
    expect(report.entries[0]?.state).toBe("unknown");
    expect(report.state).toBe("unknown");
  });

  it("reports a future-dated entry as current with a negative age", () => {
    const report = assessRegisterFreshness(
      registerWith([baseRecord({ retrievedOn: "2026-10-01" })]),
      "2026-09-24",
    );
    expect(report.entries[0]?.ageInDays).toBe(-7);
    expect(report.state).toBe("current");
  });
});
