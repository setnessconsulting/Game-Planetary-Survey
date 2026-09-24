/**
 * The simplification register for v1.
 *
 * `docs/SCIENCE_MODEL.md` §7 permits simplification and requires each one to be
 * licensed with four things: a source basis, a rationale, a model boundary, and
 * the exact words the learner is told. `src/domain/simplification.ts` enforces
 * that.
 *
 * The entries below are mostly *not* visual, because the honest simplifications in
 * a survey game are mostly not visual. Three kinds recur:
 *
 *  - **Measurement simplifications.** The probe reports one mean radius, one mean
 *    orbital distance, one topographic range. Each collapses a real distribution
 *    into a single number, and a learner who is not told that will over-read it.
 *  - **Model-boundary simplifications.** Where a value is a lower bound, or where
 *    two agency products disagree, the boundary is stated rather than smoothed
 *    over.
 *  - **Coverage simplifications.** What this survey does not measure at all, so
 *    an absent value is not mistaken for a zero. `scope` records whether the
 *    consequence falls on the measurement (a blank instrument reading) or on a
 *    mission (a value held out of the scored path).
 *
 * `learnerText` is the sentence shown in-game. It is written for a learner in
 * grades 6–8: short, concrete, and without jargon that is not explained where it
 * appears.
 */

import type { SimplificationRecord } from "@/domain/simplification";

export const SIMPLIFICATION_REGISTER: readonly SimplificationRecord[] = [
  {
    id: "SIM-1",
    scope: "measurement",
    statement: "The probe reports one mean radius per world.",
    sourceBasisIds: [
      "jpl.mean-radius.moon",
      "jpl.mean-radius.mars",
      "jpl.mean-radius.venus",
      "jpl.mean-radius.titan",
      "jpl.mean-radius.europa",
    ],
    rationale:
      "A real world is not a sphere. Its radius differs from pole to equator, so a single " +
      "number is a summary rather than a measurement of every direction.",
    modelBoundary:
      "Shape, flattening, and any local variation in radius are ignored. Two worlds whose mean " +
      "radii match to the precision shown may still differ in shape, and Mars in particular is " +
      "measurably wider at its equator than at its poles.",
    learnerText:
      "Your radius sounder reports one average distance from the centre to the surface. Real worlds bulge slightly, so treat this as a single number that stands for the whole world.",
    reviewStatus: "unreviewed",
  },
  {
    id: "SIM-2",
    scope: "measurement",
    statement: "The probe reports one mean distance from the Sun per world.",
    sourceBasisIds: ["nssdca.orbital-radius.venus", "nssdca.orbital-radius.mars"],
    rationale:
      "Orbital distance changes continuously along an orbit. A survey needs one comparable " +
      "number per world to compare two worlds at all.",
    modelBoundary:
      "The real distance varies over one orbit: Venus's orbit is nearly circular, while Mars's " +
      "distance swings by roughly 40 million km between its closest and farthest points. No " +
      "orbital computation, and no reasoning about how long a year takes, is required or graded.",
    learnerText:
      "The rangefinder reports an average distance. Real orbits are slightly oval, so the true distance drifts a little over the course of a year.",
    reviewStatus: "unreviewed",
  },
  {
    id: "SIM-3",
    scope: "measurement",
    statement: "Surface relief is reported as a single topographic range per world.",
    sourceBasisIds: [
      "nssdca.surface-relief.mars",
      "nssdca.surface-relief.venus",
      "nssdca.surface-relief.moon",
    ],
    rationale:
      "Comparing surfaces needs one number that means the same thing on both worlds, and the " +
      "agency tables publish a range between the highest and lowest point.",
    modelBoundary:
      "A range is not a roughness and not a slope. It ignores how the height is distributed: a " +
      "world with one deep basin and one tall peak can share a range with a world whose whole " +
      "surface is gently crumpled. The source tables do not state the datum or the sampling " +
      "behind the range, so these values are compared only between bodies sourced from the same " +
      "curator.",
    learnerText:
      "Surface relief is the height difference between the lowest and highest point. It tells you how far the surface rises and falls, not how bumpy it feels.",
    reviewStatus: "unreviewed",
  },
  {
    id: "SIM-4",
    scope: "measurement",
    statement: "Titan's atmosphere is reported as extending 600 km above its surface.",
    sourceBasisIds: ["jpl.atmosphere-depth.titan"],
    rationale:
      "An atmosphere has no edge. It thins out gradually, so any single depth has to be tied to " +
      "something a measurement could detect.",
    modelBoundary:
      "600 km is where the source reports the atmosphere being *detected*, so it is a lower " +
      "bound, not a top. The atmosphere thins above that altitude rather than stopping. Titan is " +
      "the only world in this survey with a sourced boundary altitude, so v1 reports this value " +
      "as context and never compares it against another world.",
    learnerText:
      "Titan's haze was detected at 600 km above the surface. That is as high as the measurement looked, so the real haze reaches at least that far.",
    reviewStatus: "unreviewed",
  },
  {
    id: "SIM-5",
    scope: "mission",
    statement:
      "The Moon's surface relief is held out of the scored content and shown as under review.",
    sourceBasisIds: ["nssdca.surface-relief.moon"],
    rationale:
      "Two agency products disagree about the Moon's relief: NSSDCA publishes a 13 km range, " +
      "while LRO altimetry of the highest and lowest points implies roughly 20 km. The two " +
      "figures even disagree about whether the Moon is proportionally smoother than Mars, so a " +
      "mission built on either number would grade a dispute.",
    modelBoundary:
      "The value stays in the register as contested rather than being deleted, because " +
      "recording a disagreement is more honest than hiding it. It is excluded from every " +
      "mission's completion path until a science reviewer resolves which figure and which " +
      "definition the game should use.",
    learnerText:
      "This measurement is still under review by the survey team, so it is not used in any mission yet.",
    reviewStatus: "contested",
  },
  {
    id: "SIM-6",
    scope: "measurement",
    statement: "Only worlds with a sourced value can be measured or compared.",
    sourceBasisIds: ["jpl.mean-radius.moon", "jpl.mean-radius.europa"],
    rationale:
      "Some values the survey would like do not exist in any authoritative source: the Moon has " +
      "no published heliocentric distance to quote, and Titan and Europa orbit their planets " +
      "rather than the Sun.",
    modelBoundary:
      "A missing value is not a zero and not a small number. Instruments report that no " +
      "authoritative value exists, and a comparison that needs one cannot be made at all. " +
      "Nothing in the game substitutes an approximation.",
    learnerText:
      "If a world has no reliable published value for something, the probe tells you so. A blank is more useful than a guess.",
    reviewStatus: "unreviewed",
  },
  {
    id: "SIM-7",
    scope: "presentation",
    statement:
      "Worlds are drawn in a comparison view that is not to literal scale.",
    sourceBasisIds: ["jpl.mean-radius.moon", "jpl.mean-radius.venus"],
    rationale:
      "At literal relative scale across surveyed distances, the smallest world in this survey " +
      "would be a single pixel. A labelled comparison teaches the relationship better than an " +
      "unreadable literal view.",
    modelBoundary:
      "The drawing is compressed and is never a source of a value. Relative size and relative " +
      "separation are not to scale with each other, and no measurement is taken from the " +
      "picture. The numbers in the notebook are the measurements.",
    learnerText:
      "This comparison view is compressed so that small worlds stay visible. It is not drawn to literal scale — the numbers in your notebook are the measurements.",
    reviewStatus: "unreviewed",
  },
];
