# Planetary Survey — Product Requirements and Game Vision

Status: binding PS-01 product contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24
Canonical repository: `setnessconsulting/Game-Planetary-Survey` (branch `main`)

This document freezes the product contract. Downstream stories (PS-02 … PS-16) may
refine *content and presentation* but may not silently redefine the learner, the
core loop, the scope boundary, or the non-goals recorded here.

---

## 1. Product statement

Planetary Survey is a browser-first planetary-science game for learners in
approximately **grades 6–8**.

The learner acts as a **junior planetary scientist** operating a survey probe and
its workstation. They receive a survey brief, choose a target world, select an
instrument, take a measurement, capture that measurement as evidence, compare
worlds, commit to a claim, and defend that claim by citing the evidence they
collected.

**Planetary Survey is not a planet-fact quiz.** No mission may be completed by
recalling or guessing a memorized fact. Completion requires producing,
inspecting, and interpreting measurement evidence.

## 2. Player fantasy

> *I am running a real planetary survey. I point real instruments at real worlds,
> and what I claim has to survive the data I collected.*

The fantasy has three ingredients, and all three are required for the game to
feel like itself:

1. **Instrumentation has purpose.** Every instrument exists to answer a question
   the learner actually has. Selecting an instrument is a scientific choice with
   a cost (time, power, resolution) rather than a menu click.
2. **Scale is felt, then measured.** The learner should *feel* that worlds differ
   enormously in size and separation, and then be able to *measure* that
   difference numerically and compare it.
3. **Claims are bounded by evidence.** A claim the learner cannot cite evidence
   for is not a completed claim. Debrief reasons about the evidence trail, not
   about whether a lucky guess matched an answer key.

The learner is a scientist with a job to do, not a student being tested.

## 3. Primary learner and context

| Attribute | Value |
|---|---|
| Target age / grade band | approximately grades 6–8 |
| Reading expectation | age-appropriate expository text; no vocabulary that is not defined in-context or in a glossary affordance |
| Prior knowledge assumed | none beyond everyday exposure to the idea of planets |
| Setting | classroom, library, after-school, or home |
| Facilitator | optional; the guided mission must not require a teacher to be present |
| Device assumption | see `PERFORMANCE_AND_DEVICE_BUDGETS.md` |

**Non-negotiable:** a learner must be able to complete the science objective
without precision 3D manipulation and without instructions from outside the
game. See `ACCESSIBILITY.md`.

## 4. Canonical gameplay loop

This is the authoritative loop. Every mission is an instance of it.

```text
Brief
  → choose / approach target
  → select instrument
  → observe / measure
  → capture evidence
  → compare worlds
  → make a claim
  → cite evidence
  → debrief / revise
```

Contractual properties of the loop:

- **Every arrow is a learner action.** No step may be completed automatically on
  the learner's behalf, including by a hint system.
- **Evidence capture is explicit.** Observation without capture does not advance
  the mission. The learner decides what is worth keeping.
- **Compare is a real step, not a screen.** At least two bodies must be brought
  into a shared comparison before a claim is accepted.
- **Claim and citation are separate.** A claim without at least one cited
  evidence record cannot be submitted.
- **Debrief teaches.** Debrief explains the relationship between the evidence
  collected and the claim quality. It is not a score screen.
- **Revise is first-class.** Revising after debrief is a designed path, not a
  failure state.

## 5. Session shape

| Mission type | Target duration | Notes |
|---|---:|---|
| Guided mission (first-run tutorial mission) | ~10–15 min | carries the full loop end to end |
| Independent mission | ~8–12 min | teaches by brief + evidence, not by voice-over |
| Replay / variant mission | ~6–10 min | seeded or data-variant re-run of a mission |

Durations are design targets, measured as a learner's first successful
completion. They are a *usability* target owned by PS-14 playtesting; PS-01 fixes
the intent so that mission authoring (PS-04, PS-11) can size content correctly.

Implications the architecture must respect:

- a mission is a bounded, resumable, serializable unit of state;
- mission content is data, not code (see `TECHNICAL_DESIGN.md`);
- a replay/variant run must not require re-downloading a different mission bundle
  where the difference is seed or parameter only.

## 6. First-release (v1) scope

v1 is a **deliberately bounded planetary survey**, not an open-universe
simulator. v1 must contain:

1. **One guided survey mission** that demonstrates the complete loop.
2. **At least two independently solvable comparison/survey missions.**
3. **At least one replayable seeded or data variant.**
4. **Multiple contrasting solar-system bodies**, sufficient to compare scale,
   surface/topography, atmosphere or layer structure, and orbital/distance
   context. "Contrasting" is the requirement, not "numerous" — see §7.
5. **An evidence notebook and comparison board** in which the learner explicitly
   connects observations to conclusions.

Exact first-release bodies, measurements, and claims are frozen in **PS-04**
(`GAME-368`) after source-based science review. PS-01 fixes only the selection
criteria.

### 6.1 What "complete" means for v1

v1 is complete when a fresh learner in the target band can sit down with no
external instruction, complete the guided mission, understand what they measured
and why it mattered, and voluntarily replay an independent mission. Everything
else is out of scope.

## 7. Target-body selection criteria

PS-04 selects the v1 body set. Selection must satisfy **all** of the following:

| # | Criterion |
|---|---|
| B-1 | **Contrast value.** Each body is chosen because it contrasts usefully with at least one other selected body on a dimension the learner will measure (size, layer structure, atmosphere, surface character, distance). |
| B-2 | **Sourceability.** Every measured value required by a mission has an authoritative published source, recorded per field. |
| B-3 | **Measurability in the fiction.** The required values are plausibly obtainable by the instruments the probe carries, and the fiction does not claim a measurement that no real mission could make. |
| B-4 | **Age-appropriate load.** The body's story does not require explaining a concept beyond the MS-ESS1-3/MS-ESS1-2 band. |
| B-5 | **Visual fidelity feasibility.** The body can be represented honestly at the shipping quality bar without fabricating detail that implies a measurement the game does not have. |
| B-6 | **Breadth is not the goal.** A small set of strongly contrasting worlds beats a large set of similar ones. If a body only adds a name, it is cut. |

Explicit non-criterion: real-mission popularity or "famousness". A body is not
selected because learners recognize it.

## 8. Scientific integrity rules that constrain product design

These are product-level rules, expanded technically in `SCIENCE_MODEL.md`.

- **Silence beats invention.** Where an authoritative value does not exist, the
  game must not display a number. It may say that the measurement is unavailable
  or outside the probe's capability.
- **Visuals never fabricate evidence.** A rendering effect may not imply a
  measurement. Presentation scale may be deliberately non-literal for
  usability — but any such distortion is explicit, documented, and must not alter
  the authoritative value shown to the learner.
- **Simplification is licensed, not silent.** Every simplification carries a
  source, a rationale, a model boundary, and a learner-facing explanation.
- **No false precision.** Displayed precision must be justified by the
  underlying source precision.

## 9. Identity, tone, and originality

- Tone: competent, curious, direct. The learner is trusted with real numbers.
- No gamified pressure patterns. No streaks, loot boxes, engagement timers,
  countdown clocks, or "come back tomorrow" mechanics.
- Failure language is investigative ("that claim outran the evidence"), never
  punitive.
- **Original identity.** Planetary Survey must not imitate NASA, JPL, USGS, or
  any comparator's branding, and must not appear to be officially sponsored or
  endorsed by any agency. Agency data is a credible *source*, not a co-brand.
- All expressive material — art direction, copy, layout, audio, narrative — is
  original or licensed. See `ASSET_PROVENANCE.md` and `BENCHMARK_RUBRIC.md`.

## 10. Non-goals for v1

v1 is explicitly **not**:

| Non-goal | Why recorded |
|---|---|
| a full solar-system sandbox | unbounded scope; dilutes the measure→claim loop |
| a Kerbal-style rocket/vehicle builder | construction is not the learning objective |
| a research-grade orbital-mechanics simulator | MS-ESS1-2 support is qualitative only |
| a Kepler's-law / orbital-period assessment | outside the frozen standard band |
| an open-world space game | no seamless planetary-surface traversal in v1 |
| an exoplanet or procedural-world generator | content must be source-backed per field |
| a memorization quiz | contradicts §1 |
| a multiplayer or social game | no remote service, no learner accounts |
| an account / progression / achievement platform | local-first; see `PRIVACY_AND_PERSISTENCE.md` |
| an AI tutor or runtime LLM feature | no runtime LLM calls; see `PRIVACY_AND_PERSISTENCE.md` |
| a LevelBest integration | explicitly excluded from GAME-362; see D-09 in `DECISIONS.md` |
| an adaptive-difficulty engine | risks hiding evidence from learners who need it |

## 11. Success criteria

Product success at PS-14 is judged on evidence, not assertion:

1. A new target-age learner begins and completes the guided mission unaided.
2. Independent missions cannot be completed by answer-key guessing — verified by
   checking that a claim without adequate cited evidence is rejected.
3. Session durations land inside the §5 targets.
4. The comparator rubric dimensions in `BENCHMARK_RUBRIC.md` each receive an
   independent finding against the exact candidate.
5. Science review finds no unresolved high-severity error.
6. Accessibility review confirms the §3 non-negotiable in practice.

Fun, clarity, and child discoverability are **human** findings. They may not be
produced by automation. See `ACCEPTANCE_EVIDENCE_MATRIX.md`.

## 12. Authority

| Concern | Authority |
|---|---|
| work scope, blockers, status | Jira (GAME-362 and children) |
| implementation truth | `setnessconsulting/Game-Planetary-Survey` |
| scientific values | the per-field source register (see `SCIENCE_MODEL.md`) |
| hosting / promotion | `setnessconsulting/games-site` |
| product/learning contract | this document |
