/**
 * Shipped learner text, checked against the domain's own derivations (GAME-368).
 *
 * The missions quote derived numbers to the learner — "0.89%", "about 1.8 times",
 * "0.13 of Mars by volume". Those are the most dangerous numbers in the product:
 * they are not transcriptions from a source table, so a citation cannot catch them
 * being wrong, and a learner cannot tell a plausible error from a correct figure.
 *
 * So this file does not re-type the expected numbers. It recomputes each one
 * through `src/domain/normalization.ts` and requires the authored sentence to
 * contain the string the domain produces. If someone edits a measurement and
 * forgets the sentence that reasons about it, or mistypes the arithmetic in a
 * feedback line, this fails.
 *
 * What it deliberately does not check: prose. Anything the domain cannot derive is
 * asserted only where a claim is checkable (a relation, a bound), and the
 * reasoning behind a threshold is written down rather than hidden in a magic
 * number.
 */

import { describe, expect, it } from "vitest";

import { MISSIONS, PLANETARY_BODIES } from "@/content";
import { EUROPA_ID, MARS_ID, MOON_ID, TITAN_ID, VENUS_ID } from "@/content/bodies";
import { DISTANCE_MISSION_ID, GUIDED_MISSION_ID, RELIEF_MISSION_ID, VARIANT_MISSION_ID } from "@/content/missions";
import {
  proportionOfBodyRadius,
  relativeBodyScale,
  relativeBodyVolume,
} from "@/domain/normalization";
import { decimalPlacesFor, formatNumber, roundSignificant } from "@/domain/quantities";

function body(id: string) {
  const found = PLANETARY_BODIES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No shipped body ${id}`);
  return found;
}

function mission(id: string) {
  const found = MISSIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No shipped mission ${id}`);
  return found;
}

/** All learner-facing text in a mission, as one searchable string. */
function learnerText(missionId: string): string {
  const definition = mission(missionId);
  return [
    definition.title,
    definition.brief,
    definition.claimTarget.assertion,
    ...definition.hints.map((hint) => hint.text),
    ...definition.misconceptions.flatMap((item) => [item.belief, item.feedback]),
    ...definition.debriefFacts.map((fact) => fact.text),
    ...definition.scienceBoundaries.map((boundary) => boundary.statement),
  ].join("\n");
}

/** How the domain narrates a ratio at a given precision. */
function ratioText(value: number, significantDigits: number): string {
  const rounded = roundSignificant(value, significantDigits);
  return formatNumber(rounded, decimalPlacesFor(rounded, significantDigits));
}

/** How the domain narrates a percentage at a given precision. */
function percentText(value: number, significantDigits: number): string {
  return ratioText(value * 100, significantDigits);
}

describe("derived numbers in shipped learner text", () => {
  it("quotes relief as a proportion of each world's own radius, correctly", () => {
    const marsRelief = proportionOfBodyRadius(body(MARS_ID), "surfaceRelief");
    const venusRelief = proportionOfBodyRadius(body(VENUS_ID), "surfaceRelief");
    expect(marsRelief).not.toBeNull();
    expect(venusRelief).not.toBeNull();

    const text = learnerText(RELIEF_MISSION_ID);
    // The mission's whole point is the LO-3 proportional reading, so both
    // percentages in the feedback must be the domain's, at the precision the
    // source supports (two significant figures for a 2-digit relief figure).
    expect(text).toContain(`${percentText(marsRelief!.value.value, 2)}%`);
    expect(text).toContain(`${percentText(venusRelief!.value.value, 2)}%`);

    // "more than four times as much" is a claim about the ratio of those two
    // proportions, so it is checked as a bound rather than as a string.
    const ratio = marsRelief!.value.value / venusRelief!.value.value;
    expect(ratio).toBeGreaterThan(4);
    expect(text).toContain("four times");
  });

  it("keeps the raw relief comparison available without letting it be the answer", () => {
    // Mars's relief is larger in absolute terms too, which is why the proportional
    // basis has to be pinned: a learner could reach the right world for the wrong
    // reason, and the feedback says so explicitly.
    const mars = body(MARS_ID).attributes.surfaceRelief!.value.value;
    const venus = body(VENUS_ID).attributes.surfaceRelief!.value.value;
    expect(mars).toBeGreaterThan(venus);
    expect(learnerText(RELIEF_MISSION_ID)).toContain("not the answer the brief asked for");
  });

  it("quotes relative size between two worlds, correctly", () => {
    const venusOverMars = relativeBodyScale(body(VENUS_ID), body(MARS_ID), "meanRadius");
    expect(venusOverMars).not.toBeNull();
    expect(learnerText(GUIDED_MISSION_ID)).toContain(
      `${ratioText(venusOverMars!.value.value, 2)} times the radius`,
    );

    const titanOverEuropa = relativeBodyScale(body(TITAN_ID), body(EUROPA_ID), "meanRadius");
    expect(titanOverEuropa).not.toBeNull();
    expect(learnerText(VARIANT_MISSION_ID)).toContain(
      `${ratioText(titanOverEuropa!.value.value, 3)} times as wide`,
    );
  });

  it("quotes the Moon's relative volume, which only a registered formula may produce", () => {
    // Volume is the one quoted number that is not a proportion of radius or a
    // ratio of the same attribute, so it needed its own formula (D-26). If this
    // ever reads as unregistered, the claim in the feedback has no derivation.
    const moonVolume = relativeBodyVolume(body(MOON_ID), body(MARS_ID));
    expect(moonVolume).not.toBeNull();
    expect(moonVolume!.formulaId).toBe("relativeVolume");
    expect(learnerText(GUIDED_MISSION_ID)).toContain(
      `${ratioText(moonVolume!.value.value, 2)} of Mars by volume`,
    );
  });

  it("never quotes a volume ratio as if it were a measurement", () => {
    const moonVolume = relativeBodyVolume(body(MOON_ID), body(MARS_ID))!;
    // A volume ratio is a model result: it is only true while both worlds are
    // treated as spheres, so it may not travel without its derivation and it
    // never replaces the radii it came from.
    expect(moonVolume.definition).toContain("spheres");
    expect(moonVolume.inputs.map((entry) => entry.sourceId)).toEqual([
      "jpl.mean-radius.moon",
      "jpl.mean-radius.mars",
    ]);
  });

  it("quotes Titan's atmosphere as a share of Titan, and as a lower bound", () => {
    const haze = proportionOfBodyRadius(body(TITAN_ID), "atmosphereDepth")!;
    expect(haze.value.value).toBeGreaterThan(0.2);
    const text = learnerText(VARIANT_MISSION_ID);
    expect(text).toContain("more than a fifth as deep as Titan's own radius");
    // 600 km is where the haze was *detected*. A statement of that depth that read
    // like a measured top would be the register's own precision note contradicted
    // by the product.
    expect(text).toContain("detected at 600 km");
    expect(text).toContain("reported as context");
  });

  it("quotes orbital distance as the mean, and gets the comparison the right way round", () => {
    const mars = body(MARS_ID).attributes.orbitalRadius!.value.value;
    const venus = body(VENUS_ID).attributes.orbitalRadius!.value.value;
    expect(mars).toBeGreaterThan(venus);

    const ratio = mars / venus;
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(2.2);
    // "nearly twice" is the whole of the comparison the text makes; the mission
    // must not imply an exact factor it did not derive.
    expect(learnerText(GUIDED_MISSION_ID)).toContain("nearly twice as far");
  });

  it("repeats each agency value exactly as the register states it", () => {
    // The learner text restates authoritative values, so a re-transcription slip
    // (a rounded radius, a transposed digit) is a bug a citation cannot catch.
    // The quotes are derived from the shipped bodies rather than typed here, so
    // this fails on a wrong sentence and not on a reformatted one.
    const allText = MISSIONS.map((definition) => learnerText(definition.id)).join("\n");
    for (const id of [MOON_ID, MARS_ID, VENUS_ID, TITAN_ID, EUROPA_ID]) {
      const sourced = body(id).attributes.meanRadius!;
      const rounded = roundSignificant(sourced.value.value, sourced.significantDigits);
      const expected = `${formatNumber(
        rounded,
        decimalPlacesFor(rounded, sourced.significantDigits),
      )} km`;
      expect(allText, `${id} radius`).toContain(expected);
    }
  });
});

describe("mission arithmetic claims that are checkable as relations", () => {
  it("makes every claim's named worlds the ones the mission actually measures", () => {
    for (const definition of MISSIONS) {
      const measured = new Set(
        definition.requiredObservations
          .filter((observation) => observation.attributeId === definition.claimTarget.attributeId)
          .map((observation) => observation.bodyId),
      );
      expect(measured.has(definition.claimTarget.subject), definition.id).toBe(true);
      expect(measured.has(definition.claimTarget.object), definition.id).toBe(true);
    }
  });

  it("sends every claim in the direction the shipped values support", () => {
    // A mission that asserts the wrong world is larger is the single most damaging
    // content bug possible: it would grade a correct measurement as wrong.
    for (const definition of MISSIONS) {
      const { attributeId, subject, relation, object } = definition.claimTarget;
      const subjectValue = body(subject).attributes[attributeId];
      const objectValue = body(object).attributes[attributeId];
      expect(subjectValue, `${definition.id}: ${subject}.${attributeId}`).toBeDefined();
      expect(objectValue, `${definition.id}: ${object}.${attributeId}`).toBeDefined();

      let subjectNumber = subjectValue!.value.value;
      let objectNumber = objectValue!.value.value;
      if (definition.claimTarget.basis === "proportionOfRadius") {
        subjectNumber = proportionOfBodyRadius(body(subject), attributeId)!.value.value;
        objectNumber = proportionOfBodyRadius(body(object), attributeId)!.value.value;
      }

      if (relation === "largerThan") {
        expect(subjectNumber, definition.id).toBeGreaterThan(objectNumber);
      } else if (relation === "smallerThan") {
        expect(subjectNumber, definition.id).toBeLessThan(objectNumber);
      }
    }
  });

  it("keeps every mission's identity and kind distinct", () => {
    expect(new Set(MISSIONS.map((definition) => definition.id)).size).toBe(MISSIONS.length);
    const guided = MISSIONS.filter((definition) => definition.kind === "guided");
    expect(guided).toHaveLength(1);
    expect(guided[0]!.id).toBe(GUIDED_MISSION_ID);
    expect(MISSIONS.find((definition) => definition.id === DISTANCE_MISSION_ID)?.kind).toBe(
      "independent",
    );
    expect(MISSIONS.find((definition) => definition.id === VARIANT_MISSION_ID)?.variantOf).toBe(
      GUIDED_MISSION_ID,
    );
  });
});
