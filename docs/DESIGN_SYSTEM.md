# Planetary Survey — Design System and Preproduction Handoff

Status: binding design source of truth for v1
Jira: GAME-362 (Epic), GAME-367 (PS-DESIGN)
Decision date: 2026-09-24
Supersedes: the PS-02 foundation tokens in `src/styles/tokens.css`

---

## 1. What this is, and where the Figma file is

GAME-367's first acceptance criterion asks for a **"Figma or equivalent
source-of-truth handoff with component/state inventory"**. There is no Figma file,
and `docs/STATUS.md` records that as an open constraint. This document, plus the two
typed modules it is generated from, is the *equivalent* — and it is worth being
explicit about what that equivalence does and does not buy.

| | A Figma file | This handoff |
|---|---|---|
| Component/state inventory | artboards and variants | `src/design/surfaces.ts`, one entry per surface and state |
| Design tokens | published library | `src/design/tokens.ts`, with a purpose note per token |
| Token delivery | manual sync | `src/styles/tokens.css`, generated, drift-checked |
| Contrast compliance | linter if configured | computed per declared pair, fails the build below minimum |
| Accessibility obligations | annotations and goodwill | required fields per surface; a missing one fails the build |
| Visual craft exploration | **the real strength of a canvas** | **not provided here** |
| Human visual sign-off | reviewable artifact | **not provided here** |

The last two rows are the honest cost. What a canvas is genuinely good at —
exploring visual treatments fast, and giving a human something to look at and
approve — is exactly what this replaces with prose and assertions. So the claim
this document makes is narrow and checkable: **the design contract is complete,
machine-verifiable, and versioned with the code.** It is not a claim that anything
has been visually approved. `docs/STATUS.md` keeps that distinction as an open
constraint, and PS-09/PS-14 own the visual and playtest evidence that would close
it.

The reason to prefer the typed form is that a canvas cannot fail a build. Every
rule in the paragraphs below is a field in `src/design/` with a check behind it, and
the check found a real defect on its first run (§3.2).

## 2. What owns what

| Concern | Owner | Everything else must defer to it |
|---|---|---|
| Visual constants | `src/design/tokens.ts` | `src/styles/tokens.css` is generated from it |
| Surfaces, states, obligations per surface | `src/design/surfaces.ts` | components implement what it declares |
| The 11-step learner path | `docs/UX_USER_FLOW.md` §2, mirrored by `src/ui/loopSteps.ts` | the inventory maps to those ids and may not invent steps |
| Accessibility obligations | `docs/ACCESSIBILITY.md` | each obligation maps to a required inventory field (§7) |
| Scientific values, units, precision | the domain layer (`src/domain/`) | the design system styles them and never restates them |
| What a learner is told about a simplification | `src/content/simplifications.ts` | the UI renders `learnerText` verbatim |
| Art direction and asset provenance | `docs/ASSET_PROVENANCE.md` | §8 here is the visual-language summary |

No document in this list may be redefined by a later story without reconciling it
and recording the change against GAME-362.

## 3. The token system

57 tokens in ten groups: colour, focus, typography, spacing, radius, elevation,
motion, layering, sizing, and non-colour encoding.

The workflow is one-directional:

```
src/design/tokens.ts   --npm run build:tokens-->   src/styles/tokens.css
        ^                                                  |
        |                                                  v
   the decision                                    consumed by components
                                                        |
        npm run check:tokens  (byte-compares the two; fails on drift)
        npm run check:design  (contrast, references, motion, breakpoints, surfaces)
```

### 3.1 Rules the token layer enforces

- **Every token states its purpose.** A constant whose reason is not written down
  becomes folklore, and folklore is what a later story silently changes.
- **Every token is namespaced `--ps-` and declared once.** No `--ps-*` property may
  be defined anywhere except the generated file.
- **Every `var(--ps-*)` reference resolves.** An orphan reference is a build
  failure, so a renamed token cannot survive as a silent fallback.
- **Colour is never required.** Required distinctions are carried by markers and
  words, from the `encoding` group plus text (A-9).
- **The renderer sits below every accessible surface.** `--ps-z-viewport` (10) is
  below the toolbar, the overlay, and any modal (20/30/40), so the 3D view cannot
  cover required content.

### 3.2 Contrast is measured, not asserted

Every pair this product ships is declared in `CONTRAST_REQUIREMENTS`, and
`npm run check:design` computes the real WCAG 2.1 ratio for each one. The current
set:

| Foreground | Background | Minimum | Measured | Applies to |
|---|---|---|---|---|
| `--ps-text` | `--ps-surface-0` | 4.5 | 16.98 | text |
| `--ps-text` | `--ps-surface-1` | 4.5 | 16.10 | text |
| `--ps-text` | `--ps-surface-2` | 4.5 | 14.85 | text |
| `--ps-text-muted` | `--ps-surface-1` | 4.5 | 8.60 | text |
| `--ps-text-subtle` | `--ps-surface-1` | 4.5 | 6.68 | text |
| `--ps-accent` | `--ps-surface-1` | 4.5 | 8.64 | text |
| `--ps-instrument` | `--ps-surface-1` | 4.5 | 11.96 | text |
| `--ps-evidence` | `--ps-surface-1` | 4.5 | 11.86 | text |
| `--ps-caution` | `--ps-surface-1` | 4.5 | 13.04 | text |
| `--ps-focus-ring` | `--ps-surface-1` | 3.0 | 13.04 | non-text |
| `--ps-focus-ring` | `--ps-surface-2` | 3.0 | 12.03 | non-text |
| `--ps-border-strong` | `--ps-surface-1` | 3.0 | 3.52 | non-text |
| `--ps-border-strong` | `--ps-surface-2` | 3.0 | 3.25 | non-text |

Two decisions are visible in that table.

**Units and provenance tags are held to the text minimum.** `--ps-text-muted`
carries units and `--ps-text-subtle` carries observation ids and source tags. Both
are required reading in a product whose whole premise is that a number travels with
its source, so neither is treated as decorative. `--ps-text-subtle` was also
lightened from the PS-02 value for exactly this reason.

**`--ps-border-strong` was corrected.** The first run of the check failed it: the
inherited PS-02 value `#3d4c5c` measured **2.14:1** against a panel, below the 3:1
non-text minimum that the token exists to meet. It is now `#5a6d80`, which measures
3.52:1 on a panel and 3.25:1 on a raised control. The defect was in the palette this
project inherited, and it was invisible until the ratio was computed; the token's
own purpose note records the change so a future reader does not "restore" the
darker value.

### 3.3 Typography

System font stacks only. No webfont is loaded, so there is no font request, no flash
of unstyled text, and no licence question (`docs/ASSET_PROVENANCE.md` §10).
Measurements and units use the monospace stack, because tabular alignment is what
makes a column of readings comparable. `--ps-measure` bounds prose at 68ch; the
commonest legibility failure in a data-dense tool is an over-long line, and the
design system refuses to leave that to judgement.

The scale's floor for learner-facing instructions is `1rem` (`--ps-text-base`).
`--ps-text-xs` is metadata only and states that in its purpose, so it cannot be
quietly promoted to carry a requirement.

### 3.4 Layering and elevation

Three surface steps and two shadow steps. Depth never carries meaning: layering is
for the four floating states (`viewport`, `toolbar`, `overlay`, `modal`), and
nothing in the product is important *because* it is on top. There is deliberately no
fourth surface step — beyond three, elevation stops reading as grouping and starts
reading as decoration.

## 4. Surfaces

Fourteen surfaces: one per step of the frozen loop, plus three global states that
can occur during any step. The machine-readable form is `src/design/surfaces.ts`;
every field below is required by `npm run check:design`.

| Surface | Loop step | States | Text/table equivalent | Uses 3D | Maturity |
|---|---|---|---|---|---|
| `workstation-load` | 1 Load | opening, online, limited, no 3D view | n/a | no | implemented |
| `briefing` | 2 Briefing | nothing loaded, brief accepted | n/a | no | implemented |
| `target-selection` | 3 Choose/approach target | no target, target set, no value for that property | target table | **yes** | implemented |
| `instrument-selection` | 4 Select instrument | offered, selected, cannot answer | n/a | no | implemented |
| `observe-measure` | 5 Observe/measure | ready, measured, no authoritative value | the reading itself | **yes** | implemented |
| `evidence-capture` | 6 Capture evidence | nothing to keep, captured, already captured | notebook table | no | implemented |
| `comparison` | 7 Compare worlds | not comparable, compared, proportional offered | comparison table | **yes** | implemented |
| `claim` | 8 Make a claim | drafting, nothing to cite yet, drafted | n/a | no | implemented |
| `cite-evidence` | 9 Cite evidence | none, one world, both worlds | n/a | no | implemented |
| `debrief` | 10 Debrief | supported, contradicted, not yet checkable | n/a | no | implemented |
| `revise-replay` | 11 Revise or replay | revise, replay, revision in place | n/a | no | implemented |
| `hints` | global | no hint requested, hints shown, all hints shown | n/a | no | implemented |
| `renderer-fallback` | global | limited, unavailable, context lost after capture | n/a | no (it *is* the alternative) | implemented |
| `reduced-motion` | global | following the system, reduced by choice, full motion | n/a | no | implemented |

Four rules are attached to the inventory rather than left to a reviewer:

1. **Every surface names at least two states and, for each, how the learner knows
   they are in it without relying on colour.** A surface with one state has no
   states; a state whose only signal is a hue is not designed (A-9).
2. **Every surface that shows visual data names its real text or table equivalent**
   (A-13). For the notebook and the comparison board the equivalent is structural:
   they *are* tables, and a chart added later must be a second view of the same
   rows rather than a replacement for them.
3. **Every surface that uses the 3D view names the semantic route to the same
   action** (A-14). This is the governing principle of
   `docs/ACCESSIBILITY.md` §1 expressed as data: choosing a target is a list
   selection, a measurement is a control that returns a value, and camera framing
   affects neither.
4. **Every interactive surface states how its controls meet the touch minimum**
   (A-3). `--ps-touch-min` is 44 px; `--ps-control-height` may be lower on a
   pointer device, because the hit area is grown rather than the minimum moved.

### 4.1 Where the inventory is deliberately honest

Six surfaces are marked `specified` or `partial`, and each names the story that owns
the work and what is missing — the renderer surfaces to PS-05, the instrument and
measurement surfaces to PS-06, the notebook and comparison to PS-07, the claim and
debrief to PS-08. Two of those gaps are not implementation gaps in the ordinary
sense:

- **`debrief` cannot be reached at all.** The domain models a `debrief` phase and
  nothing transitions into it, so a mission with a supported claim still cannot
  finish (open constraint 6, `docs/STATUS.md`).
- **`revise-replay` costs more than it should.** Revision currently re-enters the
  survey phase, so fixing an incomplete citation costs a redundant instrument
  reading even though the notebook already answers the question (constraint 7).

Both were found by writing the golden traces PS-04 required, both belong to PS-08,
and both are stated on the surface that owes the fix rather than buried in a
changelog. A design document that quietly omitted them would present the loop as
finished.

## 5. Responsive behaviour and touch

| Breakpoint | Minimum width | What changes |
|---|---|---|
| Phone | 360 px | Single column. The 3D viewport may be reduced or replaced; the evidence route must be complete with no horizontal scrolling of primary content. |
| Tablet | 768 px | Two columns: notebook and comparison beside the brief. Touch is primary, so every control uses the touch minimum. |
| Desktop | 1200 px | Full workstation: viewport, controls, notebook, and comparison visible together. Must still reflow at 200% zoom. |

The phone breakpoint is 360 px because `docs/UX_USER_FLOW.md` §7 requires the
semantic UI to work from there upward, and the check asserts the two agree rather
than trusting that they do. `npm run check:design` also asserts the breakpoints
ascend, because a breakpoint list with a gap in it is a layout nobody designed.

Reduced motion and 200% zoom are not breakpoints; they are passes over every
breakpoint, and `tests/e2e/accessibility.spec.ts` exercises both against the built
application.

## 6. Motion hierarchy

| Token | Duration | Used for |
|---|---|---|
| `--ps-motion-fast` | 120 ms | Feedback on a direct manipulation: press, toggle, row focus. |
| `--ps-motion-base` | 220 ms | Something appearing or changing in place. |
| `--ps-motion-slow` | 420 ms | Larger spatial change: a panel swapping, the notebook opening. |
| `--ps-motion-camera` | 640 ms | Camera and viewport transitions. |
| `--ps-ease` | curve | The single easing curve. A second curve would have to earn its place. |

One rule governs the whole table: **no transition is required for any state to be
reached.** Motion is feedback, never structure.

Under `prefers-reduced-motion: reduce` every *duration* is set to 1 ms — including
the camera step, because a rule the renderer can opt out of is not a rule. A 1 ms
transition is used rather than `none`: it still fires the transition events an
implementation may rely on and still avoids a flash of unstyled final state, while
removing every perceptible movement. The easing curve is deliberately *not*
overridden: shortening a curve is meaningless, which is exactly why motion is
expressed as a duration token that can be collapsed rather than as a literal.

## 7. Accessibility mapping

Every obligation in `docs/ACCESSIBILITY.md` §2 has a landing place in this
inventory. Nothing is satisfied by intention.

| Obligation | Where it is enforced |
|---|---|
| A-1 keyboard completion | `keyboard` per surface; the keyboard-only end-to-end path in `tests/e2e/smoke.spec.ts` |
| A-2 pointer support | native controls only; no custom pointer-only interactions |
| A-3 touch support | `touchTarget` per interactive surface; `--ps-touch-min` |
| A-4 semantic DOM controls | `semantics` per surface; axe over the built shell |
| A-5 screen-reader-readable evidence | A-13 equivalents plus the live region in `workstation-load` |
| A-6 visible focus | `--ps-focus-ring` with two declared contrast pairs; `tabindex` and skip-link rules |
| A-7 logical focus order | `keyboard` per surface, in loop order |
| A-8 reduced motion | `reduced-motion` surface, motion tokens, and the override block |
| A-9 non-colour-only information | `nonColorEncoding` per surface and `nonColorSignal` per state |
| A-10 audio alternatives | audio is off by default and carries nothing required; PS-10 owns the cue inventory |
| A-11 non-drag alternatives | every interaction is a control; no drag is required anywhere |
| A-12 200% zoom / reflow | breakpoint contract §5 plus the automated 200% check |
| A-13 accessible evidence tables | `textualEquivalent` on every visual surface |
| A-14 completion without precision 3D | `nonPrecisionAlternative` on every 3D surface |

Automated coverage is coverage, not sign-off. Screen-reader experience, low-vision
usability, physical-device touch, and target-age comprehension remain human evidence
owned by PS-07, PS-12, and PS-14.

## 8. Art direction: factual material versus original work

The line is drawn here and enforced by `docs/ASSET_PROVENANCE.md`:

**Factual material (agency-sourced, never re-drawn).** Planetary values come from
the register and are rendered as text by this design system. Any future imagery of a
real body is agency material with recorded provenance, and is *illustrative of a
sourced value and never the source of one*. Imagery is never re-coloured to look
better: a false-colour product map is not an illustration of a measurement.

**Original work (this project's own).** The workstation chrome, the panel and
control language, the notebook and comparison presentation, the instrument
affordances, the typography, and every token in §3. No agency logo, lockup, seal, or
insignia appears anywhere in this product, and the interface must not read as
officially sponsored or endorsed (`docs/ASSET_PROVENANCE.md` §3).

**Comparator boundary.** The frozen comparators (`docs/DECISIONS.md` D-15) are
quality references only. No comparator's visual identity is imitated, and no
comparator is a source of scientific values.

### 8.1 Visual language

The direction from GAME-367 is *cinematic but calm, legible, scientific, and
original*. As rules:

- **Data over chrome.** Hierarchy comes from size, weight, and space. No decorative
  glow, gradient, or texture behind text or numbers.
- **Dark neutral surfaces, one accent.** The palette is a near-black cool neutral
  ramp; colour is reserved for meaning (accent, instrument, evidence, caution) and
  never used for fill volume.
- **One idea per panel.** A panel that needs a caption to explain its own structure
  is two panels.
- **The quiet default, the loud exception.** A contradicted verdict or a contested
  value may draw attention; an ordinary successful measurement does not.
- **No motion as decoration.** Every animation must move something the learner is
  about to read or do.
- **Nothing here is sparse for sparseness's sake.** This is a dense-data tool for
  grades 6–8: the test is whether a table of six readings is legible at 360 px and
  at 200% zoom, not whether the screen looks calm on a large monitor.

## 9. Changing the design system

1. Edit `src/design/tokens.ts` or `src/design/surfaces.ts` — never
   `src/styles/tokens.css`, which is generated.
2. Run `npm run build:tokens`.
3. Run `npm run check:design`. Fix what it reports; a new contrast pair below its
   minimum is a redesign, not a threshold change. Raising a declared minimum to make
   a failing pair pass is the one change this document forbids.
4. Run `npm run verify` and the browser suites, then record anything that changed a
   contract in `docs/DECISIONS.md`.

## 10. What this handoff does not claim

- **No visual approval.** Nothing here has been through a human visual review, and
  no Figma file exists to compare against. PS-09 qualified the slice technically
  without closing this; human visual sign-off is PS-14's.
- **No production art.** No planetary mesh, texture, icon set, or illustration has
  been produced. PS-05 shipped generated placeholders in the asset manifest — the
  guided-mission slice deliberately runs on them — and PS-10 owns the production
  pipeline and the "no placeholders" criterion (D-34).
- **No renderer implementation.** The 3D surfaces are specified here, not built by
  this handoff. PS-05 built them against these tokens and this inventory; the
  renderer's real-browser evidence is `tests/e2e/smoke.spec.ts` and, for the slice,
  `tests/e2e/verticalSlice.spec.ts`.
- **No target-age validation.** The legibility and comprehension reasoning in §3 and
  §8 is reasoning, not evidence. A target-age playtest is PS-14's, and
  `docs/ACCEPTANCE_EVIDENCE_MATRIX.md` forbids automation from substituting for it.
- **No claim that a handoff with a canvas would not have been better for the parts a
  canvas is good at.** §1 states the trade rather than hiding it.
