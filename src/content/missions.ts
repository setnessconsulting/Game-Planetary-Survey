/**
 * The v1 mission set.
 *
 * One guided mission, two independent missions, and one seeded variant, per
 * docs/PRD.md §6. `validateV1Scope` counts them, so the scope is a checked
 * property of the catalogue rather than a note in a document.
 *
 * ## How these missions avoid becoming a fact quiz
 *
 * The anti-guessing property is not in this file — it is in the claim contract
 * (`src/domain/claims.ts`), which refuses a conclusion that does not cite
 * evidence. What this file adds is a **completion path**: `requiredObservations`
 * is the complete list of measurements a mission needs, and
 * `claimTarget.requiredEvidence` must name observation keys drawn from that list.
 * `validateMissionDefinition` fails the build if the evidence mapping drifts off
 * the completion path, and the domain reads the same field at runtime:
 * `requiredEvidenceGaps` (src/domain/debrief.ts) reports which required
 * observations a claim does not cite, and `CompletionSummary.targetMet` is false
 * while any remain (D-40). So "you cannot finish this without measuring" is
 * enforced, not intended — the build checks the declaration and the transition
 * checks the run.
 *
 * A learner *can* guess a correct answer here. They cannot *complete* on it: the
 * claim contract returns `insufficient-evidence` until both worlds' measurements
 * are cited. That distinction is the whole design.
 *
 * ## Why one mission asks about a proportion
 *
 * `independent-surface-roughness` uses `basis: "proportionOfRadius"`. Mars has the
 * larger relief (30 km against Venus's 13 km) *and* the larger proportion
 * (0.89% of its radius against Venus's 0.21%), so the raw comparison happens to
 * agree with the proportional one. The basis is pinned anyway, because the insight
 * MS-ESS1-3 LO-3 asks for is the proportional one, and because a claim is only
 * checked against the basis it was made under: a proportional claim without both
 * radii cited is `insufficient-evidence`.
 */

import type { MissionDefinition } from "@/domain/catalog";
import { EUROPA_ID, MARS_ID, MOON_ID, TITAN_ID, VENUS_ID } from "./bodies";

export const GUIDED_MISSION_ID = "survey-001-sizes";
export const RELIEF_MISSION_ID = "survey-002-surface-relief";
export const DISTANCE_MISSION_ID = "survey-003-orbital-distance";
export const VARIANT_MISSION_ID = "survey-001v-icy-worlds";

export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: GUIDED_MISSION_ID,
    kind: "guided",
    title: "Order the rocky worlds by size",
    brief:
      "Three worlds are waiting on the board: the Moon, Mars, and Venus. Measure each one's radius, then decide which of Mars and Venus is the larger world. You will not be able to submit a conclusion until you have measured them, so start with the instrument.",
    scaleProperty: "meanRadius",
    targetBodyIds: [MOON_ID, MARS_ID, VENUS_ID],
    seedBase: 1_026_001,
    variantOf: null,
    targetMinutes: 12,
    requiredObservations: [
      {
        bodyId: MOON_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure how wide the Moon is, so there is a third size to compare against.",
      },
      {
        bodyId: MARS_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure how wide Mars is. This is one half of the comparison you will claim.",
      },
      {
        bodyId: VENUS_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure how wide Venus is. This is the other half of the comparison.",
      },
    ],
    claimTarget: {
      attributeId: "meanRadius",
      basis: "magnitude",
      subject: VENUS_ID,
      relation: "largerThan",
      object: MARS_ID,
      assertion: "Venus is a larger world than Mars.",
      requiredEvidence: [
        "venus.meanRadius",
        "mars.meanRadius",
        "moon.meanRadius",
      ],
    },
    misconceptions: [
      {
        id: "misconception.famous-world-is-bigger",
        belief: "Mars must be bigger than Venus, because Mars is the planet we hear about most.",
        feedback:
          "How much a world is talked about has nothing to do with its size. Your own measurements settle it: Mars has a mean radius of 3,389.5 km and Venus 6,051.8 km, so Venus is about 1.8 times the radius of Mars.",
        refutedBy: ["mars.meanRadius", "venus.meanRadius"],
      },
      {
        id: "misconception.moon-is-planet-sized",
        belief: "The Moon is roughly the same size as Mars.",
        feedback:
          "Your measurements put the Moon at 1,737.4 km and Mars at 3,389.5 km. The Moon is about half of Mars across, and a world half as wide holds only about an eighth as much of it — 0.13 of Mars by volume.",
        refutedBy: ["moon.meanRadius", "mars.meanRadius"],
      },
      {
        id: "misconception.one-measurement-is-enough",
        belief: "Measuring one world is enough, because the other sizes are well known.",
        feedback:
          "The notebook shows which worlds you have actually measured. A comparison needs the same property from both worlds, so a claim that cites one world's radius has no second value to check it against.",
        refutedBy: ["moon.meanRadius", "mars.meanRadius", "venus.meanRadius"],
      },
    ],
    hints: [
      {
        order: 1,
        text: "Read the brief again. It asks which of two named worlds is larger — but the survey board lists three.",
      },
      {
        order: 2,
        text: "The radius sounder is the only instrument you need here. It reports one number per world, and you need it three times.",
      },
      {
        order: 3,
        text: "Before you submit, look at your notebook. A conclusion counts when every world it names has a measurement beside it.",
      },
    ],
    debriefFacts: [
      {
        id: "debrief.size-order",
        text: "Your three measurements, largest first: Venus 6,051.8 km, Mars 3,389.5 km, Moon 1,737.4 km.",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.radius-meaning",
        text: "A radius is the distance from a world's centre to its surface, so comparing radii compares how much room each world takes up in one direction.",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.size-is-not-distance",
        text: "Size and orbital distance are separate properties. Mars is the smaller of the two worlds you compared, and it orbits nearly twice as far from the Sun as Venus does.",
        basis: "sourced",
        sourceBasisIds: ["nssdca.orbital-radius.mars", "nssdca.orbital-radius.venus"],
      },
    ],
    scienceBoundaries: [
      {
        id: "boundary.size-only",
        statement:
          "This mission compares sizes only. It makes no claim about what these worlds are made of, how hot they are, or how much air they have.",
      },
      {
        id: "boundary.no-orbital-computation",
        statement:
          "Orbital distance appears once, in the debrief, as context. No part of this mission requires computing an orbit or a year length, and neither is graded.",
      },
      {
        id: "boundary.mean-radius-simplification",
        statement:
          "The sounder reports one mean radius per world. Real worlds are slightly flattened, and that shape is outside what this survey measures (see SIM-1).",
      },
    ],
  },

  {
    id: RELIEF_MISSION_ID,
    kind: "independent",
    title: "Which surface is rough for its size?",
    brief:
      "Two worlds look very different, but the question is narrower than it sounds: which of Mars and Venus has the rougher surface *for its own size*? Measure the surface relief of each world, and the radius of each world, then make your claim. A relief number on its own will not answer this.",
    scaleProperty: "surfaceRelief",
    targetBodyIds: [MARS_ID, VENUS_ID],
    seedBase: 1_026_002,
    variantOf: null,
    targetMinutes: 10,
    requiredObservations: [
      {
        bodyId: MARS_ID,
        attributeId: "surfaceRelief",
        instrumentId: "altimeter",
        purpose: "Measure how far Mars's surface rises and falls between its lowest and highest point.",
      },
      {
        bodyId: MARS_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure Mars's radius: the size you divide by to get a proportion.",
      },
      {
        bodyId: VENUS_ID,
        attributeId: "surfaceRelief",
        instrumentId: "altimeter",
        purpose: "Measure Venus's surface relief, on the same scale as Mars's.",
      },
      {
        bodyId: VENUS_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure Venus's radius, so the two worlds can be compared fairly.",
      },
    ],
    claimTarget: {
      attributeId: "surfaceRelief",
      basis: "proportionOfRadius",
      subject: MARS_ID,
      relation: "largerThan",
      object: VENUS_ID,
      assertion: "Mars's surface relief is a larger share of its own radius than Venus's relief is of Venus's.",
      requiredEvidence: [
        "mars.surfaceRelief",
        "mars.meanRadius",
        "venus.surfaceRelief",
        "venus.meanRadius",
      ],
    },
    misconceptions: [
      {
        id: "misconception.raw-relief-is-the-answer",
        belief:
          "Mars's relief is 30 km and Venus's is 13 km, so Mars's surface is a little more than twice as rugged.",
        feedback:
          "Both numbers are right, and they are not the answer the brief asked for. Divide each one by its own world's radius: 30 km across a 3,389.5 km radius is 0.89%, while 13 km across a 6,051.8 km radius is 0.21%. For their size, Mars's surface rises and falls more than four times as much as Venus's.",
        refutedBy: ["mars.surfaceRelief", "mars.meanRadius", "venus.surfaceRelief", "venus.meanRadius"],
      },
      {
        id: "misconception.relief-independent-of-size",
        belief: "How rugged a surface is has nothing to do with how big the world is.",
        feedback:
          "The same 13 km of relief is a modest dent on a world 6,051.8 km in radius and a much bigger feature on one 1,737.4 km in radius. Dividing by the radius is what makes two different worlds comparable at all.",
        refutedBy: ["mars.meanRadius", "venus.meanRadius"],
      },
      {
        id: "misconception.similar-relief-means-similar-surface",
        belief:
          "The Moon and Venus are both listed at 13 km of relief, so their surfaces are equally rough.",
        feedback:
          "Equal totals are not equal worlds. A 13 km range spans a much larger share of a 1,737.4 km radius than of a 6,051.8 km radius. The Moon's relief is also under review by the survey team and is not used in any mission yet — check the note in your notebook before you rely on it.",
        refutedBy: ["venus.surfaceRelief", "venus.meanRadius"],
      },
    ],
    hints: [
      {
        order: 1,
        text: "The brief asks about each world's own size. That is a hint about arithmetic, not about which world wins.",
      },
      {
        order: 2,
        text: "You need two instruments here: one reports how much the surface rises and falls, the other reports how wide the world is. Both worlds need both measurements.",
      },
      {
        order: 3,
        text: "If your notebook holds relief for a world but no radius for it, you have half of a comparison. Collect the missing half before submitting.",
      },
    ],
    debriefFacts: [
      {
        id: "debrief.relief-percentages",
        text: "Mars's relief covers 0.89% of its radius; Venus's covers 0.21%. For their size, Mars's surface is more than four times as rugged.",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.relief-meaning",
        text: "A relief range is a height difference between the lowest and highest point. It measures how far the surface rises and falls, not how bumpy it feels to cross (see SIM-3).",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.venus-size-context",
        text: "Venus is the larger of the two worlds you surveyed: a mean radius of 6,051.8 km against Mars's 3,389.5 km. Dividing by that larger radius is what makes its surface the smoother of the two for its size.",
        basis: "sourced",
        sourceBasisIds: ["jpl.mean-radius.venus", "jpl.mean-radius.mars"],
      },
    ],
    scienceBoundaries: [
      {
        id: "boundary.relief-is-a-range",
        statement:
          "This mission compares a single height range per world. It says nothing about how steep the surface is, how the height is distributed, or what made the surface that way.",
      },
      {
        id: "boundary.moon-relief-excluded",
        statement:
          "The Moon is not part of this comparison, because its published relief is in dispute between two agency products and is held out of scored content (SIM-5).",
      },
      {
        id: "boundary.no-temperature",
        statement:
          "Despite the difference between these worlds, no temperature measurement is required or graded here.",
      },
    ],
  },

  {
    id: DISTANCE_MISSION_ID,
    kind: "independent",
    title: "How much farther out is Mars?",
    brief:
      "Venus and Mars are neighbours from a distance, but their orbits are not neighbours. Measure how far each world orbits from the Sun, then claim which one travels the longer road. Only one instrument can answer this.",
    scaleProperty: "orbitalRadius",
    targetBodyIds: [VENUS_ID, MARS_ID],
    seedBase: 1_026_003,
    variantOf: null,
    targetMinutes: 9,
    requiredObservations: [
      {
        bodyId: VENUS_ID,
        attributeId: "orbitalRadius",
        instrumentId: "orbitalRangefinder",
        purpose: "Measure the average distance from the Sun to Venus.",
      },
      {
        bodyId: MARS_ID,
        attributeId: "orbitalRadius",
        instrumentId: "orbitalRangefinder",
        purpose: "Measure the average distance from the Sun to Mars.",
      },
    ],
    claimTarget: {
      attributeId: "orbitalRadius",
      basis: "magnitude",
      subject: MARS_ID,
      relation: "largerThan",
      object: VENUS_ID,
      assertion: "Mars orbits much farther from the Sun than Venus does.",
      requiredEvidence: ["mars.orbitalRadius", "venus.orbitalRadius"],
    },
    misconceptions: [
      {
        id: "misconception.size-predicts-distance",
        belief: "Venus is the bigger world, so it must orbit farther out than Mars.",
        feedback:
          "Your measurements point the other way: Mars orbits at about 228.0 million km and Venus at about 108.2 million km. Venus is the larger world (6,051.8 km mean radius against Mars's 3,389.5 km) and also the nearer one, so size does not set distance.",
        refutedBy: ["mars.orbitalRadius", "venus.orbitalRadius"],
      },
      {
        id: "misconception.distance-from-earth",
        belief: "Mars is farther from the Sun, so Mars is always farther away from us.",
        feedback:
          "The rangefinder measured distance from the Sun, not distance from the observer. Because both worlds orbit, the gap between them opens and closes over time; that changing distance is a different measurement from the one you took.",
        refutedBy: ["mars.orbitalRadius", "venus.orbitalRadius"],
      },
      {
        id: "misconception.one-rangefinder-reading-is-enough",
        belief: "One distance reading is enough, since both worlds orbit the same Sun.",
        feedback:
          "A comparison needs a measurement for each world. One number tells you where a world is; it cannot tell you which of two worlds is farther out.",
        refutedBy: ["venus.orbitalRadius", "mars.orbitalRadius"],
      },
    ],
    hints: [
      {
        order: 1,
        text: "Not every instrument can answer this question. Check what each one reports before you choose.",
      },
      {
        order: 2,
        text: "The rangefinder takes longer to settle than the shorter-range instruments. That cost is the point of choosing it deliberately.",
      },
      {
        order: 3,
        text: "Distance is measured from the Sun, not from where you are. If a reading seems to describe the gap to Earth, it is not the measurement this brief asked for.",
      },
    ],
    debriefFacts: [
      {
        id: "debrief.distance-numbers",
        text: "Your rangefinder put Venus at about 108.2 million km from the Sun and Mars at about 228.0 million km — Mars orbits a little more than twice as far out.",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.orbit-is-an-average",
        text: "The rangefinder reports an average. Real orbits are slightly oval, so the distance drifts over the course of a year (see SIM-2).",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.more-distant-worlds-take-longer",
        text: "A world that orbits farther from the Sun travels a longer path around it, so one full orbit takes it longer. The survey does not ask you to calculate how long.",
        basis: "sourced",
        sourceBasisIds: ["nssdca.orbital-radius.venus", "nssdca.orbital-radius.mars"],
      },
    ],
    scienceBoundaries: [
      {
        id: "boundary.no-kepler",
        statement:
          "This mission measures a distance. It does not require computing an orbital period, and no part of it depends on Kepler's laws.",
      },
      {
        id: "boundary.distance-is-not-size",
        statement:
          "Distance from the Sun says nothing about how big a world is. Size was measured in a different mission.",
      },
      {
        id: "boundary.observations-not-photographs",
        statement:
          "The rangefinder reports a distance; it does not draw the orbit. Nothing in the viewport is a measurement.",
      },
    ],
  },

  {
    id: VARIANT_MISSION_ID,
    kind: "independent",
    title: "Two icy worlds, one question",
    brief:
      "Titan and Europa are both icy moons, and they are not the same size. Measure the radius of each, then claim which is the larger world. Titan's haze is a separate measurement and does not count towards its size.",
    scaleProperty: "meanRadius",
    targetBodyIds: [TITAN_ID, EUROPA_ID],
    seedBase: 1_026_011,
    variantOf: GUIDED_MISSION_ID,
    targetMinutes: 8,
    requiredObservations: [
      {
        bodyId: TITAN_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure the size of Titan's solid body, not of its haze.",
      },
      {
        bodyId: EUROPA_ID,
        attributeId: "meanRadius",
        instrumentId: "radiusSounder",
        purpose: "Measure the size of Europa, so there are two worlds to compare.",
      },
    ],
    claimTarget: {
      attributeId: "meanRadius",
      basis: "magnitude",
      subject: TITAN_ID,
      relation: "largerThan",
      object: EUROPA_ID,
      assertion: "Titan is the larger of the two icy worlds.",
      requiredEvidence: ["titan.meanRadius", "europa.meanRadius"],
    },
    misconceptions: [
      {
        id: "misconception.haze-counts-towards-size",
        belief: "Titan looks much bigger than Europa in the viewport, so the haze around it must count as part of its size.",
        feedback:
          "The radius sounder reports the solid body: Titan 2,574.76 km and Europa 1,560.8 km. Titan's haze reaches far above its surface and is measured separately, so the picture is not the measurement (see SIM-7).",
        refutedBy: ["titan.meanRadius", "europa.meanRadius"],
      },
      {
        id: "misconception.nearer-means-larger",
        belief: "Europa orbits Jupiter, which is nearer to us than Saturn, so Europa must be the larger moon.",
        feedback:
          "Where a moon orbits does not change how wide it is. Your two readings put Titan at 2,574.8 km and Europa at 1,560.8 km, whatever their distance from the observer.",
        refutedBy: ["titan.meanRadius", "europa.meanRadius"],
      },
    ],
    hints: [
      {
        order: 1,
        text: "This is the same kind of measurement as the first survey, on different worlds. The brief still asks about the solid body.",
      },
      {
        order: 2,
        text: "One of these worlds carries a thick atmosphere. The radius sounder reports the surface below it, and the atmosphere depth is a separate reading.",
      },
    ],
    debriefFacts: [
      {
        id: "debrief.icy-size-order",
        text: "Titan's solid body is 2,574.76 km in mean radius and Europa's is 1,560.8 km, so Titan is about 1.65 times as wide.",
        basis: "measured",
        sourceBasisIds: [],
      },
      {
        id: "debrief.titan-atmosphere-context",
        text: "Titan is the only world in this survey with a measured atmosphere depth. The haze was detected at 600 km above the surface — a layer more than a fifth as deep as Titan's own radius — and it is reported as context rather than compared, because no other surveyed world has a published figure to compare it with (SIM-4).",
        basis: "sourced",
        sourceBasisIds: ["jpl.atmosphere-depth.titan", "jpl.mean-radius.titan"],
      },
    ],
    scienceBoundaries: [
      {
        id: "boundary.atmosphere-not-scored",
        statement:
          "Titan's atmosphere depth is reported as context. It is not part of the claim, not required for completion, and not compared against another world in v1.",
      },
      {
        id: "boundary.haze-is-not-the-body",
        statement:
          "The haze visible around Titan is illustrative and is never a source of a size. The radius measurement is the body's surface.",
      },
      {
        id: "boundary.no-ocean-claims",
        statement:
          "Europa's subsurface ocean is not measured or claimed by this survey. Neither instrument can see beneath a surface.",
      },
    ],
  },
];
