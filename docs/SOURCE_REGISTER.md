# Planetary Survey — Source Register, Units, and Data Determinism

Status: binding PS-03 implementation contract, populated by PS-04
Jira: GAME-362 (Epic), GAME-366 (PS-03), GAME-368 (PS-04)
Decision date: 2026-09-24 (PS-03), extended 2026-09-24 (PS-04, §1.1)

`SCIENCE_MODEL.md` §5 is the science authority for provenance. This document is its
operational specification: what a register record *is*, how a value resolves to
one, how units and derived values work, how determinism is proven, and what an
author must do in PS-04 to add a value.

Where this document and an implementation disagree, this document plus
`SCIENCE_MODEL.md` win.

---

## 1. Scope of PS-03

PS-03 builds the **source-of-truth layer**. It ships:

| Delivered | Module |
|---|---|
| typed source-register schema and source policy | `src/domain/sources.ts` |
| register container: indexing, field resolution, validation, freshness | `src/domain/register.ts` |
| canonical SI base units and learner-facing conversions | `src/domain/quantities.ts` |
| formula-identified, unit-typed derived values | `src/domain/normalization.ts` |
| explicit scale/distortion metadata for rendered representations | `src/domain/presentation.ts` |
| impossible/contradictory value validation | `src/domain/validation.ts` |
| canonical serialization and stable digests | `src/domain/canonical.ts` |
| mission/body catalog schema and deterministic data snapshots | `src/domain/catalog.ts` |
| the authored register and presentation declarations | `src/content/provenance.ts` |
| a sourced golden fixture register | `src/testing/sourcedFixture.ts` |

PS-03 does **not** author canonical planetary values. `src/content/` remained empty
of bodies and missions when PS-03 shipped: the register was versioned and empty, and
the gate below made that state enforced rather than assumed.

---

## 1.1 What PS-04 added (register version `ps-04.0.0`)

PS-04 (`GAME-368`) executed the procedure in §9 and shipped the first register
content. The layer above is unchanged; this document's contract now has a
population:

| Delivered | Where |
|---|---|
| 11 `value-source` records covering every displayed value | `src/content/sourceRegister.ts` |
| 5 bodies with sourced, absent-where-unknown values | `src/content/bodies.ts` |
| 4 missions with completion paths and claim targets | `src/content/missions.ts` |
| 7 licensed simplifications with learner text | `src/content/simplifications.ts` |
| learner-text arithmetic checked against the domain's own derivations | `tests/content/missionArithmetic.test.ts` |
| the request for independent science review | `SCIENCE_REVIEW_PACKET.md` |

Two rules acquired content this time and are worth naming, because both are
enforced rather than documented:

- **Sourced is not reviewed.** Every entry is `unreviewed` except one `contested`
  record, and every body carries `scienceReviewed: false`.
  `catalogueIsScienceReviewed()` reports the difference, and the shell displays it
  instead of collapsing the two states into one "ready" flag.
- **A contested value ships, but cannot be scored.** The Moon's surface relief is
  kept in the register with both conflicting agency figures recorded in its
  `reviewNote`, and `validateMissionsAgainstRegister` fails the build if any
  mission requires it.

The release manifest records content version `ps-04.0.0`, and
`docs/DECISIONS.md` D-28…D-30 records the decisions this population forced.

---

## 2. Register records

One record describes one field of one body. A record is one of two **roles**, and
the distinction is load-bearing:

| Role | Meaning |
|---|---|
| `value-source` | the authority a displayed number comes from |
| `locator` | the route by which an author *found* that authority |

A locator can never resolve a value. This is the mechanism that stops an
infographic, a wiki, or a comparator from being cited as a measurement.

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | stable id that a `SourcedValue.sourceId` points at |
| `bodyId`, `attributeId` | yes | which field of which body |
| `role` | yes | `value-source` or `locator` |
| `sourceClass` | yes | see §3 |
| `sourceTitle` | yes | human-readable title |
| `organization` | yes | `NASA`, `JPL`, `USGS`, `ESA`, or `other` |
| `organizationName` | only for `other` | attribution for an exception |
| `url` | one of `url`/`datasetIdentifier` | absolute https URL |
| `datasetIdentifier` | one of `url`/`datasetIdentifier` | stable dataset/table id |
| `retrievedOn` | yes | ISO `YYYY-MM-DD` date the value was read |
| `precisionNote` | yes | the precision the source actually supports |
| `appliesToEpoch` | when epoch-dependent | e.g. `J2000` |
| `reviewStatus` | yes | `unreviewed` / `reviewed` / `contested` |
| `reviewNote` | once reviewed or contested | reviewer rationale |
| `exceptionJustification` | for `third-party` | why the exception was needed |

`ESA` is listed as a named organization because an agency that is not one of the
three preferred authorities still has to be *named* rather than hidden behind
`other`. Being nameable is not the same as being preferred.

---

## 3. Source policy

Preference order, most preferred first (`SOURCE_CLASS_PREFERENCE`):

1. `agency-primary` — NASA/JPL mission and planetary-science pages, NASA
   planetary fact resources, USGS Astrogeology (including gazetteer/nomenclature
   and cartography products).
2. `peer-reviewed` — literature or authoritative mission science papers, where an
   agency page does not state the needed value directly.
3. `agency-dataset` — agency-derived reference datasets and published planetary
   constants/parameter tables.
4. `third-party` — **never acceptable as a value source.** Recorded only as a
   locator, and only with a justification that names what it led to.

`VALUE_SOURCE_CLASSES` is derived from that list rather than written a second
time, so "preferred" and "permitted" cannot drift apart.

When a field has more than one permitted `value-source`, the most preferred class
resolves it. More than one *permitted* authority for the same displayed number is
an error (`register-duplicate-field-entry`), not redundancy: two authorities for
one number is ambiguity about what the game is teaching.

### 3.1 Adding a third-party exception

1. Record it with `role: "locator"`, `sourceClass: "third-party"`, an
   `exceptionJustification` naming the primary source it led to, and
   `organization: "other"` with an `organizationName`.
2. Add the primary source it led to as a separate `value-source` record.
3. The locator is never cited by a `SourcedValue`. If it is,
   `value-references-missing-source` blocks the build.

There is no path by which a third-party source originates a displayed value. The
policy has no write-in exception, by design.

---

## 4. Units: two canonical levels

The unit registry (`UNITS`) is the only place a conversion factor exists. Each
unit declares its `kind` (`length`, `temperature`, `dimensionless`), whether it is
the kind's SI base unit, and both directions of its conversion to that base.

Two levels of "canonical" exist, and they are different questions:

| Level | Question it answers | Where it lives |
|---|---|---|
| **attribute canonical unit** | in what unit is this attribute *stored and displayed*? | `ATTRIBUTES[id].canonicalUnit` (`km`, `K`) |
| **SI base unit** | what does this quantity equal, comparably? | `UNITS[u].siBase` (`m`, `K`, `ratio`) |

Rules:

- stored values are validated against the attribute's canonical unit; a
  non-canonical unit is a **warning**, because it is convertible rather than wrong;
- a unit of the wrong **kind** is an **error**;
- every comparison and every derived value is computed in the SI base unit, so a
  ratio cannot depend on the units an author happened to type;
- changing the displayed unit changes text only. It never changes a stored value
  (`SCIENCE_MODEL.md` §6).

Dimensionless results carry `ratio` as their unit. A proportion is a unit-typed
value, never a bare number: `formatQuantity` and `describeDerivedValue` are the
only places display text is produced, and both take their precision from the
caller.

---

## 5. Derived values

A derived value answers the MS-ESS1-3 question "how much of" rather than "how
much". Every derived value carries:

- the `formulaId` that produced it and the plain-language `definition`;
- its own `unit`;
- its inputs **with the source ids they came from**;
- an `id` derived from the formula and its inputs, so the same comparison always
  has the same identity.

Available formulas (`DERIVED_FORMULAS`):

| Formula | Meaning |
|---|---|
| `proportion` | first magnitude divided by second magnitude, of the same kind |
| `relativeScale` | one world's magnitude divided by another world's magnitude |

Two properties are contractual:

- **Never a substitute.** A derived value is added alongside the measurement it
  derives from. The measurement remains the evidence a claim must cite.
- **Never a guess.** When an input is missing, zero, non-finite, or of a different
  kind, the derivation returns `null` and the game reports the gap
  (`SCIENCE_MODEL.md` §8). There is no default value and no fallback magnitude.

---

## 6. Presentation scale and distortion

A representation that is not drawn to literal scale must declare, as data
(`PresentationScaleDeclaration`):

| Field | Requirement |
|---|---|
| `id` | `SIM-<n>`, matching `SCIENCE_MODEL.md` §7.1 |
| `representationId` | which view it governs |
| `kind` | `literal`, `uniformScale`, `nonLinearCompression`, `layerThicknessExaggeration`, `representativeSurface` |
| `ratio` | drawn : literal; must be `1` for `literal`, must not be `1` otherwise |
| `sourceBasisIds` | the register entries it illustrates |
| `rationale` | why the simplification exists |
| `modelBoundary` | where the model stops being valid |
| `learnerText` | the exact words shown to the learner |

`applyPresentationDeclaration` is the only supported way to turn a declaration into
renderer-facing data, and its output type carries a scale factor, a notice, and the
declaration id — no scientific value. A declaration can change what a world *looks*
like; it cannot change what it *is* (`SCIENCE_MODEL.md` §8).

An empty `PRESENTATION_DECLARATIONS` list is honest: there are no renderer
representations yet (PS-05). A distorted view cannot be added without disclosing
itself.

---

## 7. Determinism

### 7.1 Canonical serialization

`canonicalJson` sorts object keys recursively; `serializeRegister` additionally
sorts entries by id. Two registers with the same content serialize identically
regardless of authoring order. `digestOf` reduces any canonically serializable
value to a short stable token used as a golden value and as a cache/derivation
identity. A non-finite number, a function, or a class instance is rejected rather
than silently digested, because a digest that does not cover its input is worse
than no digest.

### 7.2 Mission data snapshots

`buildMissionDataSnapshot` produces the *data* a mission is built from — distinct
from `MissionSnapshot`, which is the learner's runtime state. A snapshot:

- sorts bodies and missions by id and attributes by attribute id;
- states every value in its attribute's canonical unit;
- records the register version **and** register digest it was derived from;
- carries a `factsDigest` over the facts only.

The seed is recorded (a variant run must be identifiable) and is **excluded from
`factsDigest`**, because a seed selects which variant and which observation
identity a learner sees and never perturbs a value (`measurement.ts`). Same
content plus same seed therefore yields byte-identical output, on any device, with
or without a renderer.

### 7.3 Freshness

Freshness is a function of the dates recorded in the register, not of the clock:
`assessRegisterFreshness(register, asOf)` takes the reference date as an argument.
A build can therefore state "this register is current as of its own retrieval
date" without the answer changing between two runs of the same commit.

Default thresholds: `agingDays: 730`, `staleDays: 1825`. They are passed as data,
so a stricter policy is a one-line change. Values that move with an epoch carry
`appliesToEpoch` on the record, because a date cannot express that.

Calendar arithmetic is done with a proleptic-Gregorian day-number conversion rather
than the platform's date parser: the host time zone must not be able to change a
result, and `new Date("2026-02-30")` silently becoming March would let a typo'd
retrieval date pass validation.

---

## 8. Validation

Every issue carries a stable `code`, a `subject`, and a severity. **Errors block;
warnings advise.** Turning every advisory into a blocker trains authors to
suppress the check, so severity is a deliberate choice.

| Check | Function | Examples |
|---|---|---|
| one record | `validateSourceRecord` | blank field, malformed date, missing locator, unsafe URL, unattributed exception, third-party as a value source, missing review rationale |
| the register | `validateRegister` | duplicate source id, duplicate authority for one field, unknown attribute, entry retrieved after the register, empty version, policy-version mismatch |
| values vs the register | `validateBodiesAgainstRegister` | value with no entry, entry that is a locator, source registered for another field or body, register-version mismatch |
| physical plausibility | `validateBody`, `validateSourcedValue` | non-finite value, negative length, below absolute zero, precision out of range, wrong unit kind, polar > equatorial, mean radius outside the axes, atmosphere deeper than the body, relief beyond the diameter, orbital radius inside the body |
| catalog | `validateCatalog`, `validateMissionDefinition` | duplicate ids, unknown target, fewer than two targets, non-scale-property mission, seed out of range, target duration outside the PRD window |
| presentation | `validatePresentationDeclarations` | duplicate SIM id, distortion labelled literal, literal labelled distorted, missing model boundary, missing learner text, missing source basis |

Two cross-field cases deliberately produce a **warning**: an atmosphere depth with
no radius to compare against. It is not wrong, but the proportion cannot be checked
and must not be displayed as if it had been.

The blocking form of the register gate is `assertRegisterValid`, used by build and
test call sites that should fail loudly.

---

## 9. Adding a value (the procedure PS-04 followed)

1. Find the value in a preferred-class source (§3).
2. Add a `value-source` record for `(bodyId, attributeId)` to
   `src/content/sourceRegister.ts`, with `retrievedOn` and `precisionNote`
   reflecting what the source actually states.
3. Add the value to the body in `src/content/bodies.ts` with that record's `id` as
   its `sourceId`, stored in the attribute's canonical unit, with
   `significantDigits` no greater than the source supports.
4. Add the derived forms the mission needs via `src/domain/normalization.ts`; do
   not compute a ratio inline. If a size is quoted to the learner that no
   registered formula produces, add the formula — see D-28.
5. If a view of the value is distorted, add a `PresentationScaleDeclaration`.
6. Add a test asserting the quoted value is the domain's own derivation
   (`tests/content/missionArithmetic.test.ts`), so learner-facing arithmetic is
   checked rather than proofread.
7. Run `npm run verify`. `validateBodiesAgainstRegister` fails the build on any
   uncited value, and `validateBody` fails it on any impossible one.
8. Record the science review in `reviewStatus`/`reviewNote`, set
   `provenance.scienceReviewed`, and bump `SOURCE_REGISTER_VERSION` — the release
   manifest records it, so a candidate names the exact set of citations its values
   came from. Until step 8 happens, the entry stays `unreviewed` and the build says
   so (`SCIENCE_REVIEW_PACKET.md`).

---

## 10. What this document does not claim

- **No independent science review has occurred.** PS-04 prepared the material for
  one (`SCIENCE_REVIEW_PACKET.md`); it did not substitute for it, because
  `ACCEPTANCE_EVIDENCE_MATRIX.md` forbids automation from claiming it.
- **No planetary value is a measurement made by this project.** Every value is a
  transcription, and the transcription is what the review checks.
- **No renderer representation exists**, so no distortion is declared yet. That is
  PS-05.
- **The golden digests in `tests/` are not a claim about the solar system.** The
  fixture digests prove determinism; the shipped-content digests
  (`tests/content/register.test.ts`) prove that the content a reviewer reads is the
  content a build ships.
