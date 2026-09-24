# Planetary Survey — Accessibility Contract

Status: binding PS-01 accessibility contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

Accessibility is part of the architecture, not a polish task. It is decided here,
enforced by automated checks from PS-02, verified manually before release, and it
**outranks visual polish** wherever they conflict.

---

## 1. Governing principle

> **The 3D viewport may enhance understanding. It must never be the only way to
> obtain required scientific evidence.**

This is simultaneously an accessibility requirement and a science-integrity
requirement. A measurement that exists only as a rendered pixel is not fully
evidenced, because a learner who cannot perceive that pixel cannot access it.
See `SCIENCE_MODEL.md` §11.

Corollary: **a learner must be able to complete the science objective —
including capture, comparison, claim, and citation — without precision 3D
manipulation, and without the renderer loaded at all.**

## 2. Required end-state capabilities

| # | Capability | Requirement |
|---|---|---|
| A-1 | Keyboard completion path | every essential mission action is reachable and operable by keyboard alone |
| A-2 | Pointer support | full mouse/trackpad operation |
| A-3 | Touch support | full touch operation, including on phone-class viewports |
| A-4 | Semantic DOM controls | mission controls and evidence surfaces are real DOM elements with names, roles, and states |
| A-5 | Screen-reader-readable evidence | every required measurement, comparison, claim, and debrief fact is exposed to assistive technology |
| A-6 | Visible focus | focus is always visible, with sufficient contrast against its background |
| A-7 | Logical focus order | focus order follows the task order in `UX_USER_FLOW.md`, not DOM accident |
| A-8 | Reduced motion | a reduced-motion mode that reaches the same end states with no unnecessary interpolation |
| A-9 | Non-color-only information | no required distinction is carried by color alone |
| A-10 | Audio alternatives | every essential audio cue has a visual and, where it carries information, semantic text equivalent |
| A-11 | Non-drag alternatives | no essential action is drag-only |
| A-12 | 200% zoom / reflow | the semantic UI remains usable at 200% zoom and at narrow reflow widths |
| A-13 | Accessible evidence tables/text | comparison and measurement data exist as real tables/text, not chart-only or canvas-only |
| A-14 | Mission completion without precision 3D manipulation | proven, not assumed |

## 3. Where each capability is owed

| Step (`UX_USER_FLOW.md`) | Accessibility obligation |
|---|---|
| 1 Load | honest, announced loading and failure states; no unannounced state change |
| 2 Briefing | semantic headings; text-first; not audio-only |
| 3 Choose/approach target | semantic target list/table; keyboard operable; no hover-only |
| 4 Select instrument | each instrument's purpose and cost exposed as text |
| 5 Observe/measure | authoritative value available semantically; not pixel-only |
| 6 Capture evidence | notebook is a semantic structure; keyboard navigable |
| 7 Compare worlds | real data-table equivalent of any chart |
| 8 Make a claim | semantic form; no drag dependency |
| 9 Cite evidence | semantic selection; keyboard operable |
| 10 Debrief | semantic text; every finding attributable |
| 11 Revise/replay | semantic controls; variant announced |

## 4. Renderer-specific obligations

The 3D renderer is an enhancement surface, and therefore:

- the renderer must **announce** its state truthfully to the semantic layer
  (ready / degraded / unavailable), so the UI can present an honest alternative;
- interaction in the 3D view must have a semantic equivalent for every action
  that matters to the mission;
- a renderer failure after evidence was captured must **not** lose evidence —
  evidence lives in the domain layer;
- camera skill (framing, orientation, approach precision) may never gate a
  required measurement;
- the renderer must respect reduced-motion and quality-tier preferences;
- canvas/WebGL surfaces must not become keyboard focus traps, and must not
  capture keystrokes away from semantic controls.

## 5. What is explicitly not acceptable

- "The 3D view is required for the observation step."
- "The evidence is visible on the model."
- "The learner can see which is bigger by looking."
- "Screen-reader support is out of scope for a 3D game."
- "The chart is the comparison."
- Any essential information encoded only in color, only in hover, only in drag,
  only in motion, or only in audio.
- Any focus indicator removed for aesthetic reasons.

## 6. Automated vs manual evidence

| Evidence | Method | May automation sign it off? |
|---|---|---|
| Rule/landmark/name/role correctness | axe-core via `@axe-core/playwright` | part of coverage, not sign-off |
| Keyboard completion of the full loop | Playwright keyboard-only run | yes, as functional evidence |
| 200% zoom / reflow usability | Playwright viewport + browser zoom | yes, as functional evidence |
| Target sizes | automated measurement | yes, as functional evidence |
| Console cleanliness on a11y paths | automated | yes |
| **Screen-reader experience** | manual, real assistive technology | **no** |
| **Comprehension for target-age learners** | manual, target-age playtest | **no** |
| **Usability under reduced motion / low vision** | manual review | **no** |
| **Physical-device touch usability** | manual/representative device | **no** |

Automated checks may never be reported as accessibility sign-off. See
`ACCEPTANCE_EVIDENCE_MATRIX.md`.

## 7. Enforcement from PS-02

PS-02 must establish:

- `@axe-core/playwright` wired into the Playwright suite;
- at least one automated accessibility test over the built application shell;
- a keyboard-only smoke path;
- a 200% zoom / narrow-reflow check;
- an architecture check preventing `src/ui/` from importing Babylon render-loop
  APIs (protection against burying UI semantics inside the renderer).

PS-07 and PS-12 expand this into a full suite. PS-14 performs the manual review.

## 8. Conflicts and precedence

Where accessibility and another concern conflict:

1. Accessibility of a **required** scientific path outranks visual polish.
2. Accessibility of a required path outranks performance optimization
   (`PERFORMANCE_AND_DEVICE_BUDGETS.md` §10).
3. Accessibility may not be satisfied by removing scientific content; the
   content must be made available in another form.

Any deliberate non-conformance requires an explicit owner decision recorded in
Jira with rationale and a remediation story. There is no "minor" unrecorded
exception.
