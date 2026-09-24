# Planetary Survey — Science Review Packet (PS-04 content)

Status: **review not yet performed** — this document is the *request* for one
Jira: GAME-362 (Epic), GAME-368 (PS-04)
Prepared: 2026-09-24
Content under review: `src/content/` at register version `ps-04.0.0`

This is the artefact a science reviewer works from. It exists because PS-04's
acceptance criteria include **independent science review**, and
`ACCEPTANCE_EVIDENCE_MATRIX.md` states plainly that automation and AI review may
not fabricate science-expert approval. So nothing here claims that review has
happened. Everything here is the *prepared material* for it.

The values were transcribed from agency sources and machine-checked for physical
plausibility. They have not been checked by a human against those sources, and no
human has judged whether the simplifications are appropriate for grades 6–8. That
is what this packet asks for.

---

## 1. What is under review

`ps-04.0.0` ships:

- **5 worlds**: Moon, Mars, Venus, Titan, Europa (`src/content/bodies.ts`);
- **11 values**, each cited to a named source record (`src/content/sourceRegister.ts`);
- **4 missions** — one guided, two independent, one variant
  (`src/content/missions.ts`);
- **7 simplifications** with learner-facing text (`src/content/simplifications.ts`);
- **0 presentation distortions** — no renderer representation exists yet, so none
  is declared (`src/content/provenance.ts`).

Register digest `36114437`, facts digest `ab3b03a0`. Both are pinned in
`tests/content/register.test.ts`, so the reviewer can confirm that what they
reviewed is what a later build ships, or see that it changed.

---

## 2. The value inventory

Every shipped measurement, with the citation it resolves to. `src` is the register
record id; the `sourceId` on each value must equal it, and
`validateBodiesAgainstRegister` fails the build if it does not.

| World | Property | Value | Unit | Sig. figs | `src` | Class | Org | Status |
|---|---|---|---|---|---|---|---|---|
| Moon | mean radius | 1737.4 | km | 5 | `jpl.mean-radius.moon` | agency-dataset | JPL | unreviewed |
| Moon | surface relief | 13 | km | 2 | `nssdca.surface-relief.moon` | agency-primary | NASA | **contested** |
| Mars | mean radius | 3389.5 | km | 5 | `jpl.mean-radius.mars` | agency-dataset | JPL | unreviewed |
| Mars | orbital radius | 227 956 000 | km | 6 | `nssdca.orbital-radius.mars` | agency-primary | NASA | unreviewed |
| Mars | surface relief | 30 | km | 2 | `nssdca.surface-relief.mars` | agency-primary | NASA | unreviewed |
| Venus | mean radius | 6051.8 | km | 5 | `jpl.mean-radius.venus` | agency-dataset | JPL | unreviewed |
| Venus | orbital radius | 108 210 000 | km | 6 | `nssdca.orbital-radius.venus` | agency-primary | NASA | unreviewed |
| Venus | surface relief | 13 | km | 2 | `nssdca.surface-relief.venus` | agency-primary | NASA | unreviewed |
| Titan | mean radius | 2574.76 | km | 6 | `jpl.mean-radius.titan` | agency-dataset | JPL | unreviewed |
| Titan | atmosphere depth | 600 | km | 1 | `jpl.atmosphere-depth.titan` | agency-primary | JPL | unreviewed |
| Europa | mean radius | 1560.8 | km | 5 | `jpl.mean-radius.europa` | agency-dataset | JPL | unreviewed |

All retrieved 2026-09-24.

### 2.1 Fields that are deliberately absent

A value is absent when no source states it. The game reports the gap rather than
filling it, and `SIM-6` tells the learner that a blank is more useful than a guess.

| World | Property | Why it is absent |
|---|---|---|
| Moon | orbital radius | Orbits Earth; no single published heliocentric distance |
| Titan | orbital radius | Orbits Saturn, not the Sun |
| Europa | orbital radius | Orbits Jupiter, not the Sun |
| All but Titan | atmosphere depth | No surveyed world other than Titan has a sourced boundary altitude |
| All | surface temperature | Not measured in v1; no v1 mission requires it |

---

## 3. Review questions

Each question is answerable yes/no plus a note. A "no" is a content change, not a
defect report — the register is versioned precisely so this can happen cheaply.

### Q1 — Are the five mean radii correctly transcribed?

`docs/SOURCE_REGISTER.md` §3 records why all five come from the **same** dataset
(JPL Solar System Dynamics physical-parameter tables, attributed by the source to
Archinal et al. 2018) rather than from whichever page stated a number: the size
missions compare these five values with each other, so mixing datasets would make
a comparison between two worlds partly a comparison between two tables.

Check: each value against its JPL table; each `significantDigits` against the
uncertainty the table states.

### Q2 — Are relief and orbital distance correctly transcribed from NSSDCA?

Both properties come from NSSDCA fact sheets, and relief again comes from one
curator for both compared bodies. Check the "Topographic range (km)" and "Semimajor
axis (10⁶ km)" rows. Note that NSSDCA classifies as `agency-primary` while JPL's
tables classify as `agency-dataset`; the register records that difference rather
than flattening it.

### Q3 — Is the Moon's relief dispute resolved correctly?

This is the only `contested` entry, and the register deliberately keeps it rather
than deleting it.

- NSSDCA states a **13 km** topographic range for the Moon.
- LRO altimetry implies roughly **20 km**: the LROC team states the highest point
  is 10 786 m above the mean radius and the lowest is more than 9 km below it.
- The two figures disagree about more than the total: 13 km makes the Moon
  *proportionally smoother than Mars*, and ~20 km makes it *rougher*.

Both cannot be right. The likely cause is a difference in datum, or in whether
extremes or an averaged profile are sampled, but **no retrieved source states its
definition**, and NSSDCA does not date the row.

Decisions requested:

1. Which figure should the game use?
2. Which definition (datum, sampling) does that figure mean?
3. If neither can be pinned, should the property be removed from the product
   entirely rather than shipped as `contested`?

Current behaviour, enforced by `validateMissionsAgainstRegister`: 13 km ships in
the register and may be displayed with its review note, but **no mission may
require it**, because a mission that scores 13 km against 19.9 km would grade a
dispute as a fact.

### Q4 — Is Titan's 600 km atmosphere depth presented as what it is?

The source (JPL, on Cassini data) says the atmosphere was *detected* at up to
600 km. The register and the learner text both treat that as a **lower bound**, not
a top, and the value is context: no mission requires it, and v1 compares it with
nothing, because no other surveyed world has a sourced boundary altitude.

### Q5 — Is each quoted measurement stated at the precision its source supports?

`significantDigits` is the precision the source supports, not the precision
someone typed. `tests/content/missionArithmetic.test.ts` derives each radius the
learner text quotes from the shipped value and precision, so the text cannot drift
from the register. The reviewer should still confirm the *precision* judgement
itself: in particular that 6 significant figures is appropriate for Titan's radius
(2574.76 ± 0.02 km), where the source supports it but a reader may not need it.

### Q6 — Are the simplifications appropriate, and is the learner text accurate?

`SIM-1`…`SIM-7` in `src/content/simplifications.ts`. Each one carries a source
basis, a rationale, a stated model boundary, and the exact words the learner is
told. Two are worth particular attention:

- **SIM-3 (relief as a range).** A range is not a roughness. The source tables
  state the row but not the datum or sampling behind it.
- **SIM-5 (the Moon's relief held out).** This is the simplification that licenses
  the `contested` status above: the value stays in the register, and stays out of
  scored content, until Q3 is answered.

### Q7 — Are the sciences boundaries in each mission correct?

Each mission carries an explicit list of what it does **not** claim
(`scienceBoundaries`). The list is what keeps MS-ESS1-2 bounded and qualitative as
required. Check in particular that the orbital-context statements are context, not
requirements, and that no mission implies a claim about composition, temperature,
or habitability that it does not measure.

### Q8 — Is the proportion claim graded the way MS-ESS1-3 LO-3 intends?

`survey-002-surface-relief` requires `basis: "proportionOfRadius"` and requires
both worlds' radii as cited evidence. Mars's relief is larger in **both** the raw
and the proportional reading (0.89 % of its radius against Venus's 0.21 %), so a
learner can reach the right world for the wrong reason. The misconception
`misconception.raw-relief-is-the-answer` exists to address exactly that.

The question for the reviewer: is comparing relief as a share of radius the right
reading of LO-3 for this age band, or should the mission ask something else?

### Q9 — Is any shipped learner-facing number derived rather than cited?

This should be answerable "no". Every derived number in the missions (the 0.89 %
and 0.21 % proportions, the 1.8× and 1.65× size ratios, the 0.13 volume ratio,
Titan's >⅕ haze depth) is produced by a registered formula in
`src/domain/normalization.ts`, and `tests/content/missionArithmetic.test.ts`
recomputes each one and requires the authored sentence to contain the domain's own
output. If a number is found that no formula produces, that is a defect rather
than a review note.

---

## 4. What a reviewer does not need to re-check

These are already enforced mechanically, and a failure would be a build failure
rather than a finding:

- **Provenance completeness.** Every displayed value resolves to a `value-source`
  record; a value with no entry fails `validateBodiesAgainstRegister`.
- **Role separation.** A `locator` record can never resolve a displayed value, so
  a secondary source cannot be cited as the origin of a measurement.
- **Physical plausibility.** `validateBody` rejects swapped semi-axes, a mean
  radius outside the polar..equatorial range, an atmosphere deeper than its body,
  a relief wider than the diameter, an orbital radius inside its own body, and
  sub-absolute-zero temperatures.
- **Scope.** `validateCatalog` enforces one guided mission, at least two
  independent missions, and at least one variant.
- **Determinism.** The same content produces byte-identical facts on any device,
  with any renderer, at any quality tier, for any seed.
- **Learner-arithmetic consistency.** Every derived number quoted in learner text
  is recomputed from shipped values by test.

---

## 5. How to record the outcome

For each value, set `reviewStatus` to `reviewed` (or `contested`) and write the
`reviewNote` stating what was checked and against what. Then set
`provenance.scienceReviewed: true` on the body once **all** of that body's values
are reviewed — `tests/content/register.test.ts` requires that a reviewed body has
no unreviewed values, so the two cannot disagree.

Bump `SOURCE_REGISTER_VERSION` afterwards. The release manifest records it, so a
candidate always names the exact set of citations and reviews its values came from,
and the register digest tells a reviewer whether the content they approved is the
content in the build.

`catalogueIsScienceReviewed()` in `src/content/index.ts` reports whether all of
this is done, and it is what PS-11 and PS-14 read.

---

## 6. What this packet does not claim

- **No science review has occurred.** Every `reviewStatus` is `unreviewed` except
  the one `contested` entry.
- **No educator or target-age review has occurred.** Readability judgements in the
  learner text are reasoning, not evidence.
- **This packet is AI-prepared.** It is supporting material for a human reviewer,
  and `ACCEPTANCE_EVIDENCE_MATRIX.md` treats it as such.
- **The freshness thresholds are defaults.** Two and five years
  (`SOURCE_REGISTER.md` §7.3) are reasoned, carried as data, and unsigned as a
  policy decision.
