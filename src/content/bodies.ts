/**
 * The v1 survey bodies.
 *
 * Five worlds, chosen for **contrast** and for **sourceability**, not for fame
 * (docs/PRD.md §7). Each one earns its place by contrasting with another on a
 * dimension the survey actually measures:
 *
 * ```text
 * Moon     small, extreme relief for its size      contrasts with Mars on relief proportion
 * Mars     1.8x Venus's orbit, largest relief      contrasts with Venus and with the Moon
 * Venus    nearly Earth-sized, smooth, inner orbit contrasts with Mars on size, relief, distance
 * Titan    large icy moon with a deep atmosphere   contrasts with Europa on size
 * Europa   small icy moon                          contrasts with Titan on size
 * ```
 *
 * Every number here is transcribed from an entry in `sourceRegister.ts`, and each
 * `sourceId` names that entry. `validateBodiesAgainstRegister` fails the build if
 * one does not resolve, which is what makes "a value with no register entry cannot
 * ship" mechanical rather than aspirational.
 *
 * A value is **absent** where no source states it. The Moon and Europa have no
 * `orbitalRadius` (they orbit Earth and Jupiter), Titan and Europa have no
 * `orbitalRadius` for the same reason, and only Titan has an `atmosphereDepth`.
 * The game reports those gaps rather than filling them: an absent value is
 * information, and an invented one is a defect.
 *
 * `significantDigits` is the precision the source supports, not the precision of
 * the digits we happened to type. It bounds what the game may display.
 */

import type { BodyRecord } from "@/domain/bodies";
import { SOURCE_REGISTER_VERSION } from "./sourceRegister";

export const MOON_ID = "moon";
export const MARS_ID = "mars";
export const VENUS_ID = "venus";
export const TITAN_ID = "titan";
export const EUROPA_ID = "europa";

/** Ids of every body in the v1 survey, in the order they are introduced. */
export const SURVEY_BODY_IDS = [MOON_ID, MARS_ID, VENUS_ID, TITAN_ID, EUROPA_ID] as const;

export const PLANETARY_BODIES: readonly BodyRecord[] = [
  {
    id: MOON_ID,
    displayName: "The Moon",
    summary:
      "Earth's only moon. It has no air to speak of, so nothing has been worn down by wind or rain.",
    attributes: {
      meanRadius: {
        value: { value: 1737.4, unit: "km" },
        sourceId: "jpl.mean-radius.moon",
        significantDigits: 5,
        reviewStatus: "unreviewed",
      },
      surfaceRelief: {
        value: { value: 13, unit: "km" },
        sourceId: "nssdca.surface-relief.moon",
        significantDigits: 2,
        // Contested on purpose, and left in the register rather than removed:
        // recording a disagreement is better than hiding one. See the register
        // entry's reviewNote for the two agency figures that conflict.
        reviewStatus: "contested",
      },
    },
    provenance: { registerVersion: SOURCE_REGISTER_VERSION, scienceReviewed: false },
  },
  {
    id: MARS_ID,
    displayName: "Mars",
    summary:
      "A cold desert world with a thin carbon-dioxide atmosphere, and the largest surface relief of any world in this survey.",
    attributes: {
      meanRadius: {
        value: { value: 3389.5, unit: "km" },
        sourceId: "jpl.mean-radius.mars",
        significantDigits: 5,
        reviewStatus: "unreviewed",
      },
      orbitalRadius: {
        value: { value: 227_956_000, unit: "km" },
        sourceId: "nssdca.orbital-radius.mars",
        significantDigits: 6,
        reviewStatus: "unreviewed",
      },
      surfaceRelief: {
        value: { value: 30, unit: "km" },
        sourceId: "nssdca.surface-relief.mars",
        significantDigits: 2,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: SOURCE_REGISTER_VERSION, scienceReviewed: false },
  },
  {
    id: VENUS_ID,
    displayName: "Venus",
    summary:
      "Almost the same size as Earth and wrapped in a crushing carbon-dioxide atmosphere, with the smoothest surface in this survey for a world its size.",
    attributes: {
      meanRadius: {
        value: { value: 6051.8, unit: "km" },
        sourceId: "jpl.mean-radius.venus",
        significantDigits: 5,
        reviewStatus: "unreviewed",
      },
      orbitalRadius: {
        value: { value: 108_210_000, unit: "km" },
        sourceId: "nssdca.orbital-radius.venus",
        significantDigits: 6,
        reviewStatus: "unreviewed",
      },
      surfaceRelief: {
        value: { value: 13, unit: "km" },
        sourceId: "nssdca.surface-relief.venus",
        significantDigits: 2,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: SOURCE_REGISTER_VERSION, scienceReviewed: false },
  },
  {
    id: TITAN_ID,
    displayName: "Titan",
    summary:
      "Saturn's largest moon, and the only moon known to have a dense atmosphere — a golden haze that reaches far above its surface.",
    attributes: {
      meanRadius: {
        value: { value: 2574.76, unit: "km" },
        sourceId: "jpl.mean-radius.titan",
        significantDigits: 6,
        reviewStatus: "unreviewed",
      },
      atmosphereDepth: {
        // A lower bound on the atmosphere's extent, not a measured top: the source
        // states where the atmosphere was detected. Never a scored comparison in
        // v1 — see the register entry's precisionNote.
        value: { value: 600, unit: "km" },
        sourceId: "jpl.atmosphere-depth.titan",
        significantDigits: 1,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: SOURCE_REGISTER_VERSION, scienceReviewed: false },
  },
  {
    id: EUROPA_ID,
    displayName: "Europa",
    summary:
      "A small moon of Jupiter covered in cracked ice, thought to hide a liquid-water ocean beneath its crust.",
    attributes: {
      meanRadius: {
        value: { value: 1560.8, unit: "km" },
        sourceId: "jpl.mean-radius.europa",
        significantDigits: 5,
        reviewStatus: "unreviewed",
      },
    },
    provenance: { registerVersion: SOURCE_REGISTER_VERSION, scienceReviewed: false },
  },
];
