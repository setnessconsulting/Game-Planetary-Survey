/**
 * Claim scoring (GAME-372).
 *
 * The acceptance requirement is "partial credit can distinguish correct claim with
 * weak evidence from incorrect claim with useful evidence". These tests pin that
 * distinction and the exclusions that keep it from becoming a points system: no
 * numeric score, no timer, no streak.
 */

import { describe, expect, it } from "vitest";

import { createClaim, evaluateClaim, type Claim, type ClaimRelation } from "@/domain/claims";
import { captureEvidence, type EvidenceRecord } from "@/domain/evidence";
import { measure } from "@/domain/measurement";
import { scoreClaim } from "@/domain/scoring";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, FIXTURE_BETA } from "@/testing/devFixture";

const SEED = 42;

function capture(bodyId: string): EvidenceRecord {
  const outcome = measure(
    { instrumentId: "radiusSounder", bodyId, attributeId: "meanRadius", seed: SEED },
    DEV_FIXTURE_BODIES,
  );
  if (outcome.kind !== "measured") throw new Error("the fixture should measure");
  const result = captureEvidence([], outcome);
  if (result.kind !== "captured") throw new Error("the fixture should capture");
  return result.record;
}

// Fixture Beta (4,000 km) is the larger of the two fixtures.
const alpha = capture(FIXTURE_ALPHA);
const beta = capture(FIXTURE_BETA);
const records = [alpha, beta];

function claim(relation: ClaimRelation, cited: readonly string[]): Claim {
  return createClaim({
    attributeId: "meanRadius",
    subject: FIXTURE_BETA,
    relation,
    object: FIXTURE_ALPHA,
    citedEvidenceIds: cited,
  });
}

describe("partial credit distinguishes the two failure modes", () => {
  it("scores a fully cited, correct claim as supported", () => {
    const cited = claim("largerThan", [alpha.id, beta.id]);
    const score = scoreClaim(cited, records, evaluateClaim(cited, records));
    expect(score.level).toBe("supported");
    expect(score.citationRecommended).toBe(false);
    expect(score.credits).toContain("evidence-cited-for-both-worlds");
    expect(score.credits).toContain("relation-follows-from-the-values");
    expect(score.credits).toContain("units-and-significant-figures");
  });

  it("gives the right answer partial credit when it is not cited, and says so", () => {
    const uncited = claim("largerThan", [alpha.id]);
    const evaluation = evaluateClaim(uncited, records);
    // The anti-guessing rule is unchanged: it still does not count.
    expect(evaluation.verdict).toBe("insufficient-evidence");

    const score = scoreClaim(uncited, records, evaluation);
    expect(score.level).toBe("right-answer-uncited");
    expect(score.citationRecommended).toBe(true);
    expect(score.credits).toContain("relation-follows-from-the-values");
    expect(score.credits).not.toContain("evidence-cited-for-both-worlds");
  });

  it("distinguishes a wrong relation that was properly evidenced", () => {
    const wrong = claim("smallerThan", [alpha.id, beta.id]);
    const evaluation = evaluateClaim(wrong, records);
    expect(evaluation.verdict).toBe("contradicted");

    const score = scoreClaim(wrong, records, evaluation);
    expect(score.level).toBe("reasoning-mismatch");
    // The citation was not the problem, so no citation advice is given.
    expect(score.citationRecommended).toBe(false);
    expect(score.credits).toContain("evidence-cited-for-both-worlds");
    expect(score.credits).not.toContain("relation-follows-from-the-values");
  });

  it("does not reward a wrong relation merely because it is uncited", () => {
    const score = scoreClaim(claim("smallerThan", []), records);
    expect(score.level).toBe("reasoning-mismatch");
    expect(score.citationRecommended).toBe(true);
  });

  it("is uncheckable with an empty notebook", () => {
    const score = scoreClaim(claim("largerThan", []), []);
    expect(score.level).toBe("uncheckable");
    expect(score.citationRecommended).toBe(true);
    expect(score.credits).toEqual([]);
  });
});

describe("scoring is not a points system", () => {
  it("exposes only words, credits, and the four dimensions", () => {
    const score = scoreClaim(claim("largerThan", [alpha.id, beta.id]), records);
    expect(Object.keys(score).sort()).toEqual([
      "citationRecommended",
      "credits",
      "dimensions",
      "explanation",
      "level",
    ]);
    for (const credit of score.credits) expect(typeof credit).toBe("string");
  });

  it("has no numeric, timed, or streak-shaped field", () => {
    const score = scoreClaim(claim("largerThan", [alpha.id, beta.id]), records) as unknown as Record<
      string,
      unknown
    >;
    for (const forbidden of ["points", "score", "time", "duration", "streak", "rank", "multiplier"]) {
      expect(score[forbidden], forbidden).toBeUndefined();
    }
  });

  it("is deterministic and never reads the clock", () => {
    const first = scoreClaim(claim("largerThan", [alpha.id]), records);
    const second = scoreClaim(claim("largerThan", [alpha.id]), records);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
