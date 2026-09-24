import { describe, expect, it } from "vitest";

import { ATTRIBUTE_IDS, ATTRIBUTES } from "@/domain/attributes";
import { INSTRUMENTS, instrumentDefinition, measure } from "@/domain/measurement";
import {
  DEV_FIXTURE_BODIES,
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
} from "@/testing/devFixture";

const bodies = DEV_FIXTURE_BODIES;

function measureFixture(attributeId: Parameters<typeof measure>[0]["attributeId"], bodyId = FIXTURE_ALPHA, seed = 1) {
  const instrument = INSTRUMENTS.find((candidate) => candidate.measures.includes(attributeId));
  if (!instrument) throw new Error(`No instrument claims ${attributeId}`);
  return measure({ instrumentId: instrument.id, bodyId, attributeId, seed }, bodies);
}

describe("instrument registry", () => {
  it("gives every instrument a purpose and an honest limitation", () => {
    for (const instrument of INSTRUMENTS) {
      expect(instrument.purpose.length).toBeGreaterThan(10);
      expect(instrument.limitation.length).toBeGreaterThan(10);
      expect(instrument.measures.length).toBeGreaterThan(0);
      expect(instrument.costTicks).toBeGreaterThan(0);
    }
  });

  it("covers every attribute with at least one instrument", () => {
    const covered = new Set(INSTRUMENTS.flatMap((instrument) => [...instrument.measures]));
    for (const attributeId of ATTRIBUTE_IDS) {
      expect(covered.has(attributeId), `${attributeId} has no instrument`).toBe(true);
    }
  });

  it("resolves a definition by id and rejects an unknown id", () => {
    expect(instrumentDefinition("radiusSounder")?.label).toBe("Radius sounder");
    expect(instrumentDefinition("not-an-instrument" as never)).toBeUndefined();
  });
});

describe("measure", () => {
  it("returns the sourced value exactly, at the source's precision", () => {
    const outcome = measureFixture("meanRadius");
    expect(outcome.kind).toBe("measured");
    if (outcome.kind !== "measured") return;
    expect(outcome.reading.value).toBe(1000);
    expect(outcome.reading.unit).toBe("km");
    expect(outcome.significantDigits).toBe(2);
    expect(outcome.sourceId).toBe("fixture.alpha.radius");
  });

  it("NEVER lets a seed perturb a scientific value", () => {
    // This is the core integrity guarantee: a seed selects an observation's
    // identity, never its value. Noise here would be fabricated evidence.
    const readings = new Set<number>();
    const ids = new Set<string>();
    for (let seed = 0; seed < 25; seed += 1) {
      const outcome = measureFixture("meanRadius", FIXTURE_ALPHA, seed);
      if (outcome.kind !== "measured") throw new Error("expected a measurement");
      readings.add(outcome.reading.value);
      ids.add(outcome.observationId);
    }
    expect(readings.size).toBe(1);
    expect(ids.size).toBe(25);
  });

  it("gives an observation a stable identity for the same request", () => {
    const first = measureFixture("meanRadius", FIXTURE_ALPHA, 5);
    const second = measureFixture("meanRadius", FIXTURE_ALPHA, 5);
    if (first.kind !== "measured" || second.kind !== "measured") throw new Error("expected measurements");
    expect(first.observationId).toBe(second.observationId);
  });

  it("explains an unknown body instead of inventing a value", () => {
    const outcome = measure(
      { instrumentId: "radiusSounder", bodyId: "no-such-world", attributeId: "meanRadius", seed: 3 },
      bodies,
    );
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind !== "unavailable") return;
    expect(outcome.reason).toBe("unknown-body");
    expect(outcome.explanation.length).toBeGreaterThan(10);
  });

  it("refuses a measurement the selected instrument cannot make", () => {
    const outcome = measure(
      { instrumentId: "radiusSounder", bodyId: FIXTURE_ALPHA, attributeId: "orbitalRadius", seed: 3 },
      bodies,
    );
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind !== "unavailable") return;
    expect(outcome.reason).toBe("instrument-cannot-measure");
  });

  it("reports a missing source value as a gap rather than a guess", () => {
    // Fixture Gamma has a radius but deliberately no atmosphere reading.
    const outcome = measureFixture("atmosphereDepth", FIXTURE_GAMMA);
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind !== "unavailable") return;
    expect(outcome.reason).toBe("no-sourced-value");
    expect(outcome.explanation).toContain("instead of a guess");
  });

  it("measures every attribute a body actually has a value for", () => {
    for (const attributeId of ATTRIBUTE_IDS) {
      const bodyHasIt =
        DEV_FIXTURE_BODIES.find((body) => body.id === FIXTURE_BETA)?.attributes[attributeId] !==
        undefined;
      const outcome = measureFixture(attributeId, FIXTURE_BETA);
      if (bodyHasIt) {
        expect(outcome.kind, `${attributeId} should be measurable`).toBe("measured");
      } else {
        expect(outcome.kind, `${attributeId} should be an honest gap`).toBe("unavailable");
      }
    }
  });

  it("records review status so an unreviewed value is visible as such", () => {
    const outcome = measureFixture("meanRadius");
    if (outcome.kind !== "measured") throw new Error("expected a measurement");
    expect(outcome.reviewStatus).toBe("unreviewed");
  });

  it("never returns a value without a unit", () => {
    for (const attributeId of ATTRIBUTE_IDS) {
      const outcome = measureFixture(attributeId, FIXTURE_ALPHA);
      if (outcome.kind === "measured") {
        expect(outcome.reading.unit).toBe(ATTRIBUTES[attributeId].canonicalUnit);
      }
    }
  });
});
