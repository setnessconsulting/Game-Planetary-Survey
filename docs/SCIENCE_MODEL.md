# Planetary Survey — Science and Curriculum Model

Status: binding PS-01 science contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

This document is the science authority for Planetary Survey. It defines what the
game teaches, what data is allowed to be true, how simplifications are licensed,
and what evidence the learner must handle. Where this document and any other
artifact disagree about a scientific value, this document plus the per-field
source register win.

---

## 1. Primary standard

**NGSS MS-ESS1-3 — Analyze and interpret data to determine scale properties of
objects in the solar system.**

This is the reason the game exists. Every v1 mission must require the learner to
analyze and interpret *data* to determine a *scale property*.

A mission that does not require data interpretation to establish a scale property
is not an MS-ESS1-3 mission and does not belong in v1.

### 1.1 What MS-ESS1-3 implies for design

| Standard demand | Design consequence |
|---|---|
| "Analyze … data" | the learner must handle actual values, not descriptions of values |
| "interpret" | the learner must draw a conclusion the data supports, not read one off |
| "scale properties" | comparative magnitude — size, distance, layer/atmosphere extent, proportion — is the core target |
| "objects in the solar system" | bodies must be real solar-system objects with sourced values |

### 1.2 Scale properties the game may target

- radius / diameter;
- relative size between bodies;
- distance / orbital-radius context;
- atmosphere or interior **layer depth** as a proportion of body radius;
- surface/topographic relief as a proportion of body size;
- temperature where it supports a scale or layered-structure comparison;
- composition **only** where a source justifies a comparative claim.

## 2. Secondary standard — bounded support

**MS-ESS1-2** is supported **only** qualitatively, as orbital/gravity context.

Allowed:

- describing that more distant bodies take longer to orbit;
- describing that gravity sets what a body holds onto (qualitatively);
- using orbital-radius context to explain why two bodies are different places.

**Explicitly excluded in v1** (these are standard-overreach, not difficulty
dial):

- computing orbital periods;
- applying or requiring Kepler's laws;
- deriving mass from orbital mechanics;
- n-body or perturbation reasoning;
- any assessment item that grades orbital computation.

v1 must never *require* MS-ESS1-2 reasoning to complete a mission. It may offer it
as context.

## 3. Learning objectives

Each objective is written so that PS-04 can author a mission against it and PS-12
can test it.

| ID | Learner can… | Standard | Measurable evidence |
|---|---|---|---|
| LO-1 | read a scaled property (radius/diameter) from instrument output and state it with correct units | MS-ESS1-3 | recorded measurement in notebook, unit-correct |
| LO-2 | compare two or more bodies by a quantitative scale property and state which is larger/farther/deeper | MS-ESS1-3 | comparison board entry with values from both bodies |
| LO-3 | interpret a proportion (e.g. atmosphere depth relative to radius) rather than a raw number | MS-ESS1-3 | claim citing a ratio or proportionality |
| LO-4 | choose an instrument because it answers a specific question | MS-ESS1-3 | instrument selection trace with a stated intent |
| LO-5 | distinguish a measurement from an inference | MS-ESS1-3 | claim/citation separation enforced by the claim contract |
| LO-6 | support a claim by citing specific collected evidence | MS-ESS1-3 | claim submission rejected when uncited |
| LO-7 | revise a claim in light of evidence they had not previously used | MS-ESS1-3 | revision trace referencing newly cited evidence |
| LO-8 | describe, qualitatively, that distance and gravity shape where a body is and what it keeps | MS-ESS1-2 (qualitative) | contextual explanation in debrief, never required for completion |

LO-1 through LO-7 are required. LO-8 is supported but never load-bearing.

## 4. The learning loop, in science terms

The product loop (PRD §4) maps onto the standard like this:

```text
Brief                 → states the survey question (a scale-property question)
choose/approach target → chooses the body whose property is in question
select instrument     → chooses the measurement that can answer it
observe/measure       → produces data (LO-1, LO-4)
capture evidence      → commits data to the notebook as evidence
compare worlds        → analyzes data across bodies (LO-2, LO-3)
make a claim          → interprets data into a scale-property statement
cite evidence         → binds interpretation to data (LO-5, LO-6)
debrief/revise        → re-interprets (LO-7)
```

**Success must require inspecting and interpreting evidence.** A claim that
happens to be correct but cites no admissible evidence fails the claim contract.
This is a deliberate anti-guessing property and PS-12 must test it.

## 5. Science data authority

### 5.1 Accepted source classes

In descending preference:

1. **Primary agency science authorities** — NASA/JPL mission and planetary
   science pages, NASA planetary fact resources, USGS Astrogeology (including
   gazetteer/nomenclature and planetary cartography products).
2. **Peer-reviewed literature or authoritative mission science papers**, where an
   agency page does not state the needed value directly.
3. **Agency-derived reference datasets** (e.g. published planetary constants and
   parameter tables) for physical constants and bulk parameters.

Anything else — a wiki, a blog, an educational site, an infographic, a museum
poster, a comparator game — is **not** an acceptable source for a displayed
value. It may be used only to *find* the primary source.

### 5.2 Per-field source register (required)

PS-03 builds it; PS-04 populates it; PS-08 and PS-12 consume it. The schema, the
source policy, and the validation that enforces this table are specified in
[`SOURCE_REGISTER.md`](SOURCE_REGISTER.md); the entries themselves live in
`src/content/provenance.ts`. Every displayed scientific value must be traceable to
a register entry with at least:

| Field | Meaning |
|---|---|
| `attributeId` | typed identifier of the measured attribute (e.g. `meanRadius`) |
| `bodyId` | which body |
| `value` | canonical numeric value |
| `unit` | canonical unit (see §6) |
| `precisionNote` | the precision actually supported by the source |
| `sourceClass` | one of the classes in §5.1 |
| `sourceTitle` | human-readable title |
| `sourceOrganization` | NASA / JPL / USGS / other |
| `sourceUrl` | stable URL or dataset identifier |
| `retrievedOn` | ISO date the value was read |
| `appliesToEpoch` | where the value is epoch/orbit dependent |
| `reviewStatus` | `unreviewed` / `reviewed` / `contested` |
| `reviewNote` | reviewer rationale |

A value with no register entry **cannot ship**. There is no "obvious" value that
gets a pass.

### 5.3 Provenance boundary

- Measured/displayed values are source-traceable or absent.
- Rendered imagery is *illustrative of* a value, never a source of it.
- Cache/precompute artifacts (if any) must record the source register version
  they were derived from.

### 5.4 Branding boundary

NASA, JPL, USGS, and agency marks are **not** part of the Planetary Survey
identity. The game must not imply agency sponsorship or endorsement. Agency
attribution is a citation line, not a co-brand. See `ASSET_PROVENANCE.md`.

## 6. Units, values, and precision

The domain layer is the single owner of units and normalization
(`TECHNICAL_DESIGN.md` §3).

- **Canonical storage units** are SI: metres, kelvin, seconds, kilograms, and
  derived SI. Temperature displays in K or °C per authored content guidance.
- **Normalized/comparative values** (ratios, percentages, log-scaled
  comparisons) are computed in the domain layer as explicit, named,
  unit-annotated quantities — never inline in a component or shader.
- **All numeric values crossing into UI carry their unit**, as a typed value
  object. A bare `number` may not cross the domain boundary.
- **Displayed precision is derived from the source**, not chosen for looks. Where
  the source is rounded, the display is rounded to no more than that precision.
- **Rounding for display never changes the stored value.** Comparisons use the
  stored value.

## 7. Simplification policy

Simplification is expected and must be licensed. Every simplification requires
**all four** of:

| Element | Requirement |
|---|---|
| **Source** | the authoritative basis being simplified |
| **Rationale** | why simplification is necessary (performance, comprehension, or scope) |
| **Model boundary** | the exact point at which the model stops being valid, and what is deliberately ignored |
| **Learner-facing explanation** | where the learner is told, in age-appropriate language, that this is a model |

### 7.1 Simplification register (required format)

PS-04/PS-05 record each simplification:

```text
SIM-<n>
  statement:      what the game shows or asserts
  sourceBasis:    source(s) and field id(s) it derives from
  rationale:      why it is simplified
  modelBoundary:  what is ignored / where validity ends
  learnerText:    the exact in-game explanation shown to the learner
  reviewStatus:   unreviewed | reviewed | contested
```

### 7.2 Pre-classified simplification classes

| Class | Example | Permitted? |
|---|---|---|
| Presentation scale distortion | bodies not drawn to true relative separation | Yes, but must be explicit and must never alter the displayed authoritative value |
| Layer simplification | interior drawn as N discrete layers | Yes, with model boundary and learner text |
| Atmospheric modelling | atmosphere shown as a scattering shell rather than a physical model | Yes, if the learner is told the depth value is the authoritative one |
| Surface depiction | representative surface, not a specific time/place | Yes, if labelled as representative |
| Orbital path simplification | circular/orientation-fixed orbit | Yes, with learner text; must not be used to grade anything |
| Invented measurements | any number the source does not support | **No** |
| Invented bodies or features | fictional objects presented as real | **No** |

## 8. Visual-effect integrity rule

A rendering effect may never manufacture scientific evidence.

Concretely, for the renderer (see `RENDERING_QUALITY_STRATEGY.md`):

- A quality tier may change how convincingly a world is drawn. It may not change
  any authoritative value.
- Atmosphere, terrain relief, and tinting must be traceable to the sourced
  attribute they are illustrating, or be presented as a neutral placeholder.
- If a body's atmosphere depth is unknown, the game must not draw a
  plausible-looking shell that implies a measurement.
- Post-processing must not make two measurably different bodies look
  measurably identical, or vice versa.

## 9. Prohibited science behaviours

The following are release-blocking if found:

1. Displaying a sourced-looking value with no register entry.
2. Requiring a memorized fact to complete a mission.
3. Accepting a correct claim with no cited evidence.
4. Requiring MS-ESS1-2 computation or Kepler's laws.
5. Grading on false precision.
6. Presenting an illustration as data.
7. Presenting a real body with an invented value.
8. Implying agency endorsement.
9. A quality tier or renderer backend changing a learner-visible scientific
   value, measurement, evidence record, or claim outcome.

## 10. Reviews and gates

| Gate | Owner | Requirement |
|---|---|---|
| source register exists and is populated | PS-03 / PS-04 | every displayed value has an entry |
| mission science review | PS-04 | independent review of bodies, measurements, claims, explanations |
| simplification register review | PS-04 | each entry reviewed with learner text |
| anti-guessing property | PS-12 | automated proof that uncited claims fail |
| final science-content review | PS-11 | no unresolved high-severity finding |
| human science sign-off | PS-14 | human judgement; may not be produced by automation |

"No unresolved high-severity science finding" is a precondition for production
promotion. See `RELEASE_CONTRACT.md`.

## 11. Accessibility of science (contractual)

Science integrity and accessibility are the same requirement viewed twice. A
measurement that exists only as a rendered pixel is not fully sourced, because a
learner who cannot perceive that pixel cannot access the evidence.

Therefore: **every required measurement must exist as semantic, screen-reader-
readable, non-color-dependent data as well as (optionally) a visual.** See
`ACCESSIBILITY.md`.
