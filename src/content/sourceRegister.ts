/**
 * The per-field source register: PS-04's authored entries.
 *
 * Every value the v1 survey can display is cited here, per field, to an agency
 * primary page or an agency-derived parameter table
 * (docs/SCIENCE_MODEL.md §5.1). `docs/SOURCE_REGISTER.md` is the operational
 * specification; `src/domain/sources.ts` and `src/domain/register.ts` are the
 * schema and the enforcement.
 *
 * ## The values, and why these sources
 *
 * All five `meanRadius` values come from one dataset — JPL Solar System Dynamics
 * physical-parameter tables — rather than from whichever page happened to state a
 * number. That matters because the size missions *compare* those five radii with
 * each other: mixing sources would make a comparison between two worlds partly a
 * comparison between two datasets. The JPL tables attribute their values to
 * Archinal et al. (2018), the IAU/IAG Working Group report on cartographic
 * coordinates and rotational elements.
 *
 * `orbitalRadius` and `surfaceRelief` come from NSSDCA's per-world fact sheets
 * (NASA Goddard), and for the same reason: `surfaceRelief` is compared between
 * bodies, so both bodies' values come from the same curator and the same stated
 * quantity ("Topographic range"). NSSDCA and JPL classify differently under the
 * policy — an agency page versus an agency-derived parameter table — and this
 * register records that difference rather than flattening it.
 *
 * ## What this register deliberately does not contain
 *
 * A value is absent when no source states it, and the game reports the gap
 * instead of filling it. So the Moon has no `orbitalRadius` (it orbits Earth, and
 * its heliocentric distance is not a single published figure), Titan and Europa
 * have no `orbitalRadius` (they orbit Saturn and Jupiter, not the Sun), and only
 * Titan has an `atmosphereDepth`, because that is the only world whose agency
 * sources state a boundary altitude at all.
 *
 * ## Review status, stated plainly
 *
 * `reviewStatus` is `unreviewed` on almost every entry, and `contested` on one.
 * That is an honest report of where this content stands: the values are
 * transcribed from agency sources and machine-checked for physical plausibility,
 * but **no independent science review has happened yet**. That review is a human
 * gate owned by GAME-368 and is not something automation may claim.
 * `docs/SCIENCE_REVIEW_PACKET.md` is the artefact a reviewer works from.
 */

import type { SourceRecord } from "@/domain/sources";
import { SOURCE_POLICY_VERSION } from "@/domain/sources";
import type { SourceRegister } from "@/domain/register";

/** Version of the register *content*. Recorded in the release manifest. */
export const SOURCE_REGISTER_VERSION = "ps-04.0.0";

/** The date these values were read from their sources. */
export const SOURCE_REGISTER_RETRIEVED_ON = "2026-09-24";

const JPL_PLANETS = "https://ssd.jpl.nasa.gov/planets/phys_par.html";
const JPL_SATELLITES = "https://ssd.jpl.nasa.gov/sats/phys_par.html";

const JPL_MEAN_RADIUS_PRECISION =
  "JPL Solar System Dynamics physical parameters: mean radius of a sphere of equivalent " +
  "volume. Attribution on the source tables: Archinal et al. (2018), IAU/IAG Working Group " +
  "on Cartographic Coordinates and Rotational Elements: 2015.";

const NSSDCA_TOPOGRAPHIC_RANGE_PRECISION =
  "NSSDCA fact sheet, row \"Topographic range (km)\". The fact sheet states the row but not " +
  "the datum or the sampling behind it, which is one reason relief values are compared only " +
  "between bodies sourced from the same curator.";

const ENTRIES: readonly SourceRecord[] = [
  // ---------------------------------------------------------------- mean radius
  {
    id: "jpl.mean-radius.moon",
    bodyId: "moon",
    attributeId: "meanRadius",
    role: "value-source",
    sourceClass: "agency-dataset",
    sourceTitle: "Planetary Satellite Physical Parameters",
    organization: "JPL",
    url: JPL_SATELLITES,
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${JPL_MEAN_RADIUS_PRECISION} Moon: 1737.4 ± 0.1 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "jpl.mean-radius.mars",
    bodyId: "mars",
    attributeId: "meanRadius",
    role: "value-source",
    sourceClass: "agency-dataset",
    sourceTitle: "Planetary Physical Parameters",
    organization: "JPL",
    url: JPL_PLANETS,
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${JPL_MEAN_RADIUS_PRECISION} Mars: 3389.50 ± 0.2 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "jpl.mean-radius.venus",
    bodyId: "venus",
    attributeId: "meanRadius",
    role: "value-source",
    sourceClass: "agency-dataset",
    sourceTitle: "Planetary Physical Parameters",
    organization: "JPL",
    url: JPL_PLANETS,
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${JPL_MEAN_RADIUS_PRECISION} Venus: 6051.8 ± 1.0 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "jpl.mean-radius.titan",
    bodyId: "titan",
    attributeId: "meanRadius",
    role: "value-source",
    sourceClass: "agency-dataset",
    sourceTitle: "Planetary Satellite Physical Parameters",
    organization: "JPL",
    url: JPL_SATELLITES,
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${JPL_MEAN_RADIUS_PRECISION} Titan: 2574.76 ± 0.02 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "jpl.mean-radius.europa",
    bodyId: "europa",
    attributeId: "meanRadius",
    role: "value-source",
    sourceClass: "agency-dataset",
    sourceTitle: "Planetary Satellite Physical Parameters",
    organization: "JPL",
    url: JPL_SATELLITES,
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${JPL_MEAN_RADIUS_PRECISION} Europa: 1560.80 ± 0.30 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },

  // ------------------------------------------------------------ orbital radius
  {
    id: "nssdca.orbital-radius.venus",
    bodyId: "venus",
    attributeId: "orbitalRadius",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "Venus Fact Sheet",
    organization: "NASA",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html",
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote:
      "NSSDCA fact sheet, \"Semimajor axis (106 km)\": 108.210. Stored as the mean distance " +
      "from the Sun. The sheet states no uncertainty for this row.",
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "nssdca.orbital-radius.mars",
    bodyId: "mars",
    attributeId: "orbitalRadius",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "Mars Fact Sheet",
    organization: "NASA",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote:
      "NSSDCA fact sheet, \"Semimajor axis (106 km)\": 227.956. Stored as the mean distance " +
      "from the Sun. The sheet states no uncertainty for this row.",
    reviewStatus: "unreviewed",
    reviewNote: "",
  },

  // ------------------------------------------------------------ surface relief
  {
    id: "nssdca.surface-relief.mars",
    bodyId: "mars",
    attributeId: "surfaceRelief",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "Mars Fact Sheet",
    organization: "NASA",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${NSSDCA_TOPOGRAPHIC_RANGE_PRECISION} Mars: 30 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "nssdca.surface-relief.venus",
    bodyId: "venus",
    attributeId: "surfaceRelief",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "Venus Fact Sheet",
    organization: "NASA",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html",
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${NSSDCA_TOPOGRAPHIC_RANGE_PRECISION} Venus: 13 km.`,
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
  {
    id: "nssdca.surface-relief.moon",
    bodyId: "moon",
    attributeId: "surfaceRelief",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "Moon Fact Sheet",
    organization: "NASA",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote: `${NSSDCA_TOPOGRAPHIC_RANGE_PRECISION} Moon: 13 km.`,
    reviewStatus: "contested",
    reviewNote:
      "Contested: two agency products do not agree, and the register cannot tell which is " +
      "right from its sources. NSSDCA states a 13 km topographic range for the Moon. LRO " +
      "altimetry does not fit inside that total: the LROC (LRO Camera, NASA/GSFC/ASU) team " +
      "states that the Moon's highest point is 10,786 m above the mean radius " +
      "(lroc.im-ldi.com/images/249) and that its lowest point is more than 9 km below the " +
      "mean radius (lroc.im-ldi.com/images/898), which is a range of about 20 km. Both " +
      "cannot be right; the difference is most likely a difference in datum or in whether " +
      "extremes or an averaged profile are sampled, but no source retrieved states its " +
      "definition, and NSSDCA does not date the row. Consequence, enforced by " +
      "validateMissionsAgainstRegister: no mission may require this value, because a mission " +
      "that scores 13 km versus 19.9 km would be grading a disputed number in the region " +
      "where the dispute changes the answer.",
  },

  // --------------------------------------------------------- atmosphere depth
  {
    id: "jpl.atmosphere-depth.titan",
    bodyId: "titan",
    attributeId: "atmosphereDepth",
    role: "value-source",
    sourceClass: "agency-primary",
    sourceTitle: "NASA's Cassini Sees Abrupt Turn in Titan's Atmosphere",
    organization: "JPL",
    url: "https://www.jpl.nasa.gov/news/nasas-cassini-sees-abrupt-turn-in-titans-atmosphere/",
    retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
    precisionNote:
      "JPL states that Cassini \"detected complex chemical production in the atmosphere at up " +
      "to 400 miles (600 kilometers) above the surface\". 600 km is an altitude at which the " +
      "atmosphere was detected, so it is a LOWER BOUND on how far the atmosphere extends, not " +
      "a measured top. Stored as the reported extent and treated as context: no mission may " +
      "require it, and no comparison of atmosphere depth exists in v1 because no other " +
      "surveyed world has a sourced boundary altitude.",
    reviewStatus: "unreviewed",
    reviewNote: "",
  },
];

export const SOURCE_REGISTER: SourceRegister = {
  version: SOURCE_REGISTER_VERSION,
  policyVersion: SOURCE_POLICY_VERSION,
  retrievedOn: SOURCE_REGISTER_RETRIEVED_ON,
  entries: ENTRIES,
};
