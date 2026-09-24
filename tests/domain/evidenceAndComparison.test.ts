import { describe, expect, it } from "vitest";

import { captureEvidence, distinctBodyIds, evidenceForAttribute, type EvidenceRecord } from "@/domain/evidence";
import { comparableAttributes, compareByAttribute, compareEvidence } from "@/domain/comparison";
import { measure } from "@/domain/measurement";
import { quantity } from "@/domain/quantities";
import {
  DEV_FIXTURE_BODIES,
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
} from "@/testing/devFixture";

function measureInto(
  records: readonly EvidenceRecord[],
  bodyId: string,
  attributeId: Parameters<typeof measure>[0]["attributeId"],
  instrumentId: Parameters<typeof measure>[0]["instrumentId"],
): readonly EvidenceRecord[] {
  const outcome = measure({ instrumentId, bodyId, attributeId, seed: 11 }, DEV_FIXTURE_BODIES);
  const result = captureEvidence(records, outcome);
  return result.records;
}

function alphaBetaRadius(): readonly EvidenceRecord[] {
  let records: readonly EvidenceRecord[] = [];
  records = measureInto(records, FIXTURE_ALPHA, "meanRadius", "radiusSounder");
  records = measureInto(records, FIXTURE_BETA, "meanRadius", "radiusSounder");
  return records;
}

describe("captureEvidence", () => {
  it("appends an immutable record with provenance and order", () => {
    const records = measureInto([], FIXTURE_ALPHA, "meanRadius", "radiusSounder");
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record?.bodyId).toBe(FIXTURE_ALPHA);
    expect(record?.attributeId).toBe("meanRadius");
    expect(record?.sourceId).toBe("fixture.alpha.radius");
    expect(record?.order).toBe(0);
  });

  it("does not mutate the previous array", () => {
    const first = measureInto([], FIXTURE_ALPHA, "meanRadius", "radiusSounder");
    const second = measureInto(first, FIXTURE_BETA, "meanRadius", "radiusSounder");
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
  });

  it("rejects an unavailable measurement, because there is nothing to keep", () => {
    const outcome = measure(
      { instrumentId: "atmosphereSounder", bodyId: FIXTURE_GAMMA, attributeId: "atmosphereDepth", seed: 1 },
      DEV_FIXTURE_BODIES,
    );
    const result = captureEvidence([], outcome);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") return;
    expect(result.rejection.kind).toBe("not-measured");
  });

  it("rejects a duplicate observation so a notebook cannot be padded", () => {
    const first = measureInto([], FIXTURE_ALPHA, "meanRadius", "radiusSounder");
    const second = measureInto(first, FIXTURE_ALPHA, "meanRadius", "radiusSounder");
    expect(second).toHaveLength(1);
  });

  it("reports distinct bodies and per-attribute evidence", () => {
    const records = alphaBetaRadius();
    expect([...distinctBodyIds(records)].sort()).toEqual([FIXTURE_ALPHA, FIXTURE_BETA]);
    expect(evidenceForAttribute(records, "meanRadius")).toHaveLength(2);
    expect(evidenceForAttribute(records, "orbitalRadius")).toHaveLength(0);
  });
});

describe("comparison", () => {
  it("refuses a comparison of fewer than two worlds", () => {
    const records = measureInto([], FIXTURE_ALPHA, "meanRadius", "radiusSounder");
    const result = compareByAttribute(records, "meanRadius");
    expect(result.kind).toBe("insufficient");
    if (result.kind !== "insufficient") return;
    expect(result.explanation).toContain("at least 2 worlds");
  });

  it("orders bodies from largest to smallest and reports a ratio", () => {
    const result = compareByAttribute(alphaBetaRadius(), "meanRadius");
    expect(result.kind).toBe("finding");
    if (result.kind !== "finding") return;
    expect(result.finding.ordering).toEqual([FIXTURE_BETA, FIXTURE_ALPHA]);
    expect(result.finding.ratio).toBe(4);
    expect(result.finding.unit).toBe("km");
    expect(result.finding.proportional).toBe(false);
  });

  it("normalizes mixed units before comparing", () => {
    // Two records for the same attribute expressed in different units must not
    // produce a nonsense ordering.
    const records: readonly EvidenceRecord[] = [
      {
        id: "one",
        bodyId: FIXTURE_ALPHA,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        reading: quantity(1000, "km"),
        sourceId: "a",
        significantDigits: 2,
        order: 0,
      },
      {
        id: "two",
        bodyId: FIXTURE_BETA,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        reading: quantity(500000, "m"),
        sourceId: "b",
        significantDigits: 2,
        order: 1,
      },
    ];
    const result = compareByAttribute(records, "meanRadius");
    if (result.kind !== "finding") throw new Error("expected a finding");
    // 500,000 m is 500 km, which is smaller than 1,000 km.
    expect(result.finding.ordering).toEqual([FIXTURE_ALPHA, FIXTURE_BETA]);
    expect(result.finding.unit).toBe("km");
    expect(result.finding.ratio).toBe(2);
  });

  it("lists only attributes that are actually comparable", () => {
    let records = alphaBetaRadius();
    records = measureInto(records, FIXTURE_GAMMA, "meanRadius", "radiusSounder");
    expect(comparableAttributes(records)).toEqual(["meanRadius"]);
    expect(compareEvidence(records)).toHaveLength(1);
    expect(compareEvidence(alphaBetaRadius()).map((finding) => finding.attributeId)).toEqual([
      "meanRadius",
    ]);
  });

  it("marks a proportion-of-radius attribute as proportional", () => {
    let records: readonly EvidenceRecord[] = [];
    records = measureInto(records, FIXTURE_ALPHA, "atmosphereDepth", "atmosphereSounder");
    records = measureInto(records, FIXTURE_BETA, "atmosphereDepth", "atmosphereSounder");
    // Fixture Beta has no atmosphere value, so this cannot be compared yet.
    expect(compareByAttribute(records, "atmosphereDepth").kind).toBe("insufficient");
  });
});
