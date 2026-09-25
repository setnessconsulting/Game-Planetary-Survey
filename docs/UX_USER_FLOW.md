# Planetary Survey — UX and User Flow Contract

Status: binding PS-01 UX contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

This document freezes the first-user path and the mission state model. Figma
(`PS-DESIGN`, GAME-367) becomes the production visual/interaction design
authority once a real file/version is linked; **it may refine this flow but may
not change its steps, its ordering, or its accessibility guarantees** without
reconciling this document.

---

## 1. Design intentions

1. **The learner is a scientist, not a student being tested.** The interface is a
   survey workstation, not a worksheet.
2. **Instrumentation has purpose.** Each instrument exists to answer a question the
   learner actually has.
3. **Scale is felt, then measured.** Sensation creates curiosity; numbers settle
   the answer.
4. **Evidence is the currency.** Progress is measured in evidence collected and
   cited, not in screens passed.
5. **No dead ends.** Every state offers a next action or a recovery path.
6. **The 3D view enhances; it never gates.** Every required piece of evidence has
   a semantic route.

## 2. The required first-user path

This is the authoritative 11-step path. It must be completable by a first-time
learner in the target band **with no external instruction**.

### Step 1 — Load

- The application shell becomes interactive before the 3D renderer loads
  (`PERFORMANCE_AND_DEVICE_BUDGETS.md` §3.1).
- While the renderer or mission assets load, the learner sees a **real, bounded**
  progress indication with a human-legible status, not a bare spinner.
- If the renderer is unavailable, the learner sees an honest, accessible
  explanation with the reason and a next step — never a blank viewport.
- **Accessible route:** everything in steps 2, 3, 5, 6, 7, 8, 9, 10 is reachable
  from the shell without renderer initialization.

### Step 2 — Briefing

- States the survey question in plain, age-appropriate language, and states why
  it is worth answering.
- Names the scale property in play (size, distance, layer depth, relief…).
- Introduces the probe/workstation and what the learner's role is.
- **No lesson wall.** The learner can act without reading a long document; depth
  is available on demand.
- **Accessible route:** fully semantic text; heading structure; the brief is not
  audio-only and not image-only.

### Step 3 — Choose / approach target

- The learner picks a target body, or accepts an assigned one, and sees the
  approach as a meaningful act.
- The system comparison view is available here and is **explicitly labelled as a
  non-literal comparative view**; authoritative numbers accompany it.
- **Never** require precision 3D manipulation to select a target.
- **Accessible route:** target selection is a semantic control (list/table of
  bodies with their available measurements), keyboard operable, with no
  hover-only or drag-only requirement.

### Step 4 — Select instrument

- Instruments are presented with what each measures and what it costs
  (time/power/resolution), so the choice is scientific.
- The learner's intent ("I want to know how deep the atmosphere is") should be
  expressible and honored.
- Cannot be bypassed into an auto-selection that removes the choice.
- **Accessible route:** instrument selection is a semantic control; every
  instrument's purpose and cost are exposed as text, not icon-only or
  color-only.

### Step 5 — Observe / measure

- The probe performs the measurement; the act has a sense of occasion without
  being a decorative delay the learner cannot skip.
- The **authoritative value comes from the domain layer**, never from the
  renderer (`TECHNICAL_DESIGN.md` §4.4).
- The value is shown with its unit and at the precision the source supports.
- **Accessible route:** the measurement value is announced/available in semantic
  text as soon as it exists. The 3D visualization is an accompaniment, not the
  carrier.

### Step 6 — Capture evidence

- **Explicit learner action.** Observation without capture does not advance the
  mission.
- The learner decides what is worth keeping; the notebook records it immutably
  with its provenance (which instrument, which body, what value, what unit).
- The notebook is immediately readable and re-readable.
- **Accessible route:** the notebook is a semantic, screen-reader-readable
  structure (list/table), keyboard navigable, and readable at 200% zoom.

### Step 7 — Compare worlds

- At least **two** bodies must be brought into a shared comparison before a claim
  can be submitted.
- Comparison exposes the same authoritative values side by side, plus the derived
  comparative quantity (ratio, proportion, ordering).
- Derived comparisons are computed in the domain layer, with units.
- **Accessible route:** a real data table equivalent, not a chart-only view.
  Non-color-only encoding for any grouping or emphasis.

### Step 8 — Make a claim

- The learner states a scale-property claim about the bodies in their comparison.
- Claim entry is structured enough to be evaluable but not a fill-in-the-blank
  answer key.
- **A claim with no cited evidence cannot be submitted** — this is the
  anti-guessing rule (`SCIENCE_MODEL.md` §4).
- **Accessible route:** claim entry is a semantic form; it does not depend on the
  3D view and does not require dragging.

### Step 9 — Cite evidence

- The learner binds their claim to specific evidence records they captured.
- The UI shows what is cited and what is available but uncited, without
  pre-selecting the "correct" evidence.
- **Accessible route:** citation is a semantic selection over the notebook
  contents; keyboard operable; not drag-only.

### Step 10 — Receive debrief

- Debrief explains the relationship between the collected evidence and the claim
  quality.
- It reports **separate dimensions**, never one opaque correctness score
  (evidence adequacy, reasoning/causal consistency, scale reasoning,
  precision/units care).
- Every debrief statement must be traceable to something the learner did or did
  not collect.
- If the claim outran its evidence, the language is investigative, not punitive.
- **Accessible route:** debrief is semantic text, screen-reader readable, and
  does not rely on the 3D view.

### Step 11 — Revise or replay

- **Revise** is a designed first-class path: return to measurement, collect the
  evidence that was missing, and resubmit.
- **Replay** offers a genuine reasoning opportunity — a new seed or variant that
  changes the data, not a repeated quiz.
- Neither path is framed as failure.
- **Accessible route:** both actions are semantic controls; replay/variant is
  announced as such.

## 3. Mission state model

Pure TypeScript transitions over a discriminated union. No general
state-machine library by default (`TECHNOLOGY_DECISIONS.md` §4).

```text
briefing
  -> targetSelection
  -> approach
  -> instrumentSelection
  -> observing
  -> evidenceCapture
  -> comparison
  -> claimDrafting
  -> citing
  -> claimSubmitted
  -> debrief
  -> (revising -> instrumentSelection | observing | comparison)
  -> complete
```

Contractual properties:

- **Every transition is explicitly testable and replay-safe.**
- **Every state is serializable.**
- **No state is unreachable and no state is a dead end.** Every state has at
  least one legal forward action and, where a learner can get stuck, a recovery
  action.
- Renderer `RenderEvent`s may *request* a transition but the domain decides
  legality (`TECHNICAL_DESIGN.md` §4.3).
- Reduced motion, renderer failure, quality tier, and backend selection do not
  alter reachable states.

## 4. Onboarding, hints, and recovery

- **Onboarding is embedded.** The guided mission teaches the loop by having the
  learner perform it, not by explaining it first.
- **Hints guide attention; they do not give answers.** A hint may point at an
  unexamined measurement or an uncited claim. A hint may not select the
  instrument, choose the body, or state the claim.
- **Hint cost is explicit and non-punitive.** Using a hint never blocks progress
  and never removes learned content.
- **Recovery exists for:** no measurement taken yet, comparison with fewer than two
  bodies, uncited claim, renderer unavailable, asset load failure, and
  accidental navigation away.
- **No dead end, ever.** If the only legal action would fail, the UI explains why
  and offers the corrective step.

## 5. Information architecture

Four persistent surfaces, all reachable without the 3D view:

1. **Brief / objective** — what am I being asked to determine?
2. **Survey view** — the 3D instrument view (enhancement surface).
3. **Evidence notebook** — what have I measured and captured?
4. **Comparison + claim** — what do the values say, and what do I claim?

Navigation between them is semantic and keyboard-accessible. The 3D surface is
never the only route to any of the others.

## 6. Copy and tone rules

- Define scientific vocabulary in-context the first time it appears, or provide a
  glossary affordance.
- Numbers always carry units in learner-facing text.
- Distinguish measurement from inference in the wording, not only in layout.
- Never blame the learner. Never use "wrong", "failed", or red-only error
  signalling.
- No time pressure, no streak, no scarcity, no engagement hooks
  (`PRD.md` §9).

## 7. Responsive behaviour

- The semantic UI must work from 360 px width upward
  (`ACCESSIBILITY.md`).
- The 3D viewport may be reduced or replaced at small widths — but the evidence
  path must remain complete.
- No horizontal scrolling of primary content at 320–360 px.
- 200% zoom/reflow must keep the semantic UI usable.

## 8. Open design work owned by others

| Concern | Owner |
|---|---|
| wireframes, visual system, workstation/HUD design | PS-DESIGN (GAME-367) — delivered in-repo as [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md); no Figma file is linked (see `STATUS.md` constraint 3) |
| instrument interaction detail and measurement presentation | PS-06 |
| notebook/comparison/chart design and data equivalents | PS-07 |
| mission state machine, scoring, debrief, hints implementation | PS-08 |
| guided-mission vertical-slice UX qualification | PS-09 |
| motion/audio polish | PS-10 — delivered (`ART_DIRECTION.md`, D-41…D-44); audio is muted by default, every cue has a non-audio equivalent, and the camera transition reads `--ps-motion-camera` |
| independence, variants, balance | PS-11 |
| comparator and target-age playtest findings | PS-14 |

None of those owners may redefine the 11 steps, the state model's guarantees, or
the accessibility routes above without reconciling this document.
