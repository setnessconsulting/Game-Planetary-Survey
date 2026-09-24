import { describe, expect, it } from "vitest";

import { createClaim, describeClaimRelation, evaluateClaim } from "@/domain/claims";
import { captureEvidence, type EvidenceRecord } from "@/domain/evidence";
import { measure } from "@/domain/measurement";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, FIXTURE_BETA } from "@/testing/devFixture";

function radiusEvidence(): readonly EvidenceRecord[] {
  let records: readonly EvidenceRecord[] = [];
  for (const bodyId of [FIXTURE_ALPHA, FIXTURE_BETA]) {
    const outcome = measure(
      { instrumentId: "radiusSounder", bodyId, attributeId: "meanRadius", seed: 4 },
      DEV_FIXTURE_BODIES,
    );
    records = captureEvidence(records, outcome).records;
  }
  return records;
}

const records = radiusEvidence();
const alphaRadius = records.find((record) => record.bodyId === FIXTURE_ALPHA)?.id ?? "";
const betaRadius = records.find((record) => record.bodyId === FIXTURE_BETA)?.id ?? "";

describe("createClaim", () => {
  it("gives the same claim content the same id and different content a different id", () => {
    const draft = {
      attributeId: "meanRadius" as const,
      subject: FIXTURE_BETA,
      relation: "largerThan" as const,
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [alphaRadius, betaRadius],
    };
    expect(createClaim(draft).id).toBe(createClaim(draft).id);
    expect(createClaim(draft).id).not.toBe(
      createClaim({ ...draft, relation: "smallerThan" }).id,
    );
  });

  it("is insensitive to citation order, so the same citation set is one claim", () => {
    const base = {
      attributeId: "meanRadius" as const,
      subject: FIXTURE_BETA,
      relation: "largerThan" as const,
      object: FIXTURE_ALPHA,
    };
    const one = createClaim({ ...base, citedEvidenceIds: [alphaRadius, betaRadius] });
    const two = createClaim({ ...base, citedEvidenceIds: [betaRadius, alphaRadius] });
    expect(one.id).toBe(two.id);
  });
});

describe("evaluateClaim — the anti-guessing rule", () => {
  it("does NOT mark a correct claim as supported when nothing is cited", () => {
    // Factually correct, utterly unsupported. This must never be "supported".
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [],
    });
    const evaluation = evaluateClaim(claim, records);
    expect(evaluation.verdict).toBe("insufficient-evidence");
    expect(evaluation.dimensions.citationCoverage).toBe(false);
    expect(evaluation.explanation).toContain("Being right is not the same as being supported");
  });

  it("does NOT mark a correct claim as supported when only one world is cited", () => {
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [betaRadius],
    });
    const evaluation = evaluateClaim(claim, records);
    expect(evaluation.verdict).toBe("insufficient-evidence");
    // Fixture Beta is the subject and is cited; Fixture Alpha (the object) is not.
    expect(evaluation.citationProblems.some((problem) => problem.includes("second world"))).toBe(
      true,
    );
  });

  it("flags citations that are not in the notebook", () => {
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [alphaRadius, betaRadius, "not-a-real-observation"],
    });
    const evaluation = evaluateClaim(claim, records);
    expect(evaluation.citationProblems.some((problem) => problem.includes("not in the notebook"))).toBe(true);
  });
});

describe("evaluateClaim — verdicts with adequate citation", () => {
  it("supports a claim the cited evidence agrees with", () => {
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [alphaRadius, betaRadius],
    });
    const evaluation = evaluateClaim(claim, records);
    expect(evaluation.verdict).toBe("supported");
    expect(evaluation.dimensions.evidenceAdequacy).toBe(true);
    expect(evaluation.dimensions.unitAndPrecisionCare).toBe(true);
    expect(evaluation.dimensions.reasoningConsistency).toBe(true);
    expect(evaluation.comparedValues).toHaveLength(2);
  });

  it("contradicts a claim the cited evidence contradicts, and says so helpfully", () => {
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_ALPHA,
      relation: "largerThan",
      object: FIXTURE_BETA,
      citedEvidenceIds: [alphaRadius, betaRadius],
    });
    const evaluation = evaluateClaim(claim, records);
    expect(evaluation.verdict).toBe("contradicted");
    expect(evaluation.explanation).toContain("revise the claim");
  });

  it("treats a near-equal pair as 'about the same' within tolerance", () => {
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_ALPHA,
      relation: "sameAs",
      object: FIXTURE_BETA,
      citedEvidenceIds: [alphaRadius, betaRadius],
    });
    // 1,000 km vs 4,000 km is far outside tolerance, so this is contradicted.
    expect(evaluateClaim(claim, records).verdict).toBe("contradicted");
  });

  it("is pure: evaluating the same claim twice gives the same result", () => {
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [alphaRadius, betaRadius],
    });
    expect(JSON.stringify(evaluateClaim(claim, records))).toBe(
      JSON.stringify(evaluateClaim(claim, records)),
    );
  });
});

describe("describeClaimRelation", () => {
  it("describes every relation in learner-facing language", () => {
    expect(describeClaimRelation("largerThan")).toBe("is larger than");
    expect(describeClaimRelation("smallerThan")).toBe("is smaller than");
    expect(describeClaimRelation("sameAs")).toBe("is about the same as");
  });
});
