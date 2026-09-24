# Planetary Survey — Frozen Comparator Rubric

Status: binding PS-01 quality contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24
Freeze point: before production implementation

This rubric is written **before the game exists**. PS-14 must apply these same
dimensions to the exact immutable release candidate. A late review may add
findings; it may **not** silently redefine success to match what shipped.

"Make it as good as Kerbal Space Program" is not an acceptance criterion.
Every dimension below is written so a reviewer can observe it and record a
finding.

---

## 0. Comparator boundary (applies to everything below)

These products are **mechanics and quality references only**.

**Never** copy, trace, imitate, or closely paraphrase their:

- expressive design or art direction;
- layouts or information architecture;
- text, tone, or narrative;
- branding, logos, or iconography;
- UI treatments or interaction chrome;
- proprietary assets, data, or code.

They are not sources for scientific values either (`SCIENCE_MODEL.md` §5.1).
Observing them is legitimate research. Sitting close to them is plagiarism.

---

## 1. Universe Sandbox — science/data/system benchmark

Reference: https://universesandbox.com/

**Benchmark for:** conveying astronomical scale; quantitative clarity;
inspectable scientific properties; clear relationships between data and visible
results; scientific experimentation.

**Observe:**

1. Does the user gain an intuitive sense of how much larger/farther one object is
   than another?
2. Are an object's quantitative properties available on demand, not hidden?
3. When a value changes, is the visible result clearly connected to that value?
4. Can the user try something and see a scientifically sensible consequence?

**Planetary Survey minimum expectation:**

- scale relationships are at least as *comprehensible*, and **more explicitly
  numeric**, than the comparator's;
- every displayed property is source-traceable (the comparator does not owe this;
  we do);
- the learner can always answer "what number did I just measure, and in what
  unit?";
- scientific experimentation is bounded to the mission, but never opaque.

**Planetary Survey deliberately does not:**

- simulate the solar system as a sandbox;
- expose physics-modification tools;
- compete on simulation breadth.

**Do not copy:** layout, UI, control scheme, art direction, data presentation
style, or any asset.

---

## 2. Kerbal Space Program — mission-fantasy and agency benchmark

Reference: https://www.kerbalspaceprogram.com/

**Benchmark for:** mission fantasy; sense of agency; purposeful instruments;
exploration; planning → execution → scientific payoff.

**Observe:**

1. Does the user feel like they are operating a real mission?
2. Do the instruments have an understandable purpose, and does using one feel
   deliberate?
3. Does curiosity get rewarded with something worth finding?
4. Is there a clear arc from deciding, to doing, to learning something?

**Planetary Survey minimum expectation:**

- the junior-planetary-scientist role is legible within the first minute of the
  guided mission;
- instrument use feels purposeful — every instrument answers a question the
  learner holds;
- the measurement act has a moment of payoff that feels earned;
- the loop ends in a scientific conclusion the learner reached.

**Planetary Survey deliberately does not:**

- reproduce vehicle construction;
- reproduce orbital mechanics difficulty;
- use failure/punishment as a teaching pressure (no crash-and-retry loop);
- use a launch/explosion/catastrophe fantasy.

**Do not copy:** vehicles, part design, UI, physics feel, music, art, or narrative
framing.

---

## 3. SpaceEngine — visual-scale and navigation benchmark

Reference: https://spaceengine.org/

**Benchmark for:** celestial-body presentation; approach/orbit/inspection
experience; scale; visual spectacle; maintaining orientation during navigation.

**Observe:**

1. Does a body look convincing *as a body* — spherical, lit, textured, coherent?
2. Does the approach-to-inspection transition feel smooth and controlled?
3. Does the user retain orientation: which body, from where, at what distance?
4. Is the visual experience compelling without becoming the point?

**Planetary Survey minimum expectation:**

- body presentation is believable at the shipping quality bar (PBR materials,
  calibrated lighting/exposure, honest atmosphere treatment);
- the system → approach → orbit → inspection path is legible and never
  disorienting;
- orientation is continuously recoverable, including after a camera change or a
  renderer quality change;
- spectacle supports understanding and never replaces a measurement.

**Planetary Survey deliberately does not:**

- render true-scale interplanetary travel;
- require free-flight navigation skill;
- chase photorealism for its own sake;
- allow visual spectacle to fabricate evidence.

**Do not copy:** engine look, UI, controls, sky rendering approach, asset set, or
any texture.

---

## 4. NASA Eyes on the Solar System — scientific-interaction reference (not scored)

Reference: https://eyes.nasa.gov/apps/solar-system/

This is a **reference for scientific interaction**, not an entertainment
comparator and not a scoring target.

**Reference for:** credible planetary presentation; data/context integration;
browser-based 3D navigation; scientific tone.

**Use it to ask:**

1. How does it keep the scientific tone while still being navigable?
2. How does it present a body together with its contextual data?
3. How does it communicate time and orbit context without overwhelming?

**Constraints:**

- Do not copy its UI, layout, controls, icons, typography, or branding.
- Do not reproduce its visual identity or imply any relationship with NASA.
- Its scope is far larger than ours; scope parity is not a goal.

---

## 5. Release review dimensions

PS-14 records **separate findings for each dimension**. Do not collapse them into
one overall score. A strength in one dimension may not mask a release-blocking
weakness in another.

Each dimension lists **observable pass evidence**.

### DIM-1 — Science clarity

Pass evidence:

- every displayed value traces to a source register entry;
- units are present on every learner-facing number;
- the learner can distinguish a measurement from an inference;
- no false precision;
- no simplification is unlabelled;
- the mission's scale-property question is unambiguously stated and answered.

### DIM-2 — Sense of planetary scale

Pass evidence:

- the learner can state a correct relative-magnitude relationship between two
  bodies after the mission;
- comparative views are explicitly labelled non-literal where they are;
- the relationship is established from measured values, not from appearance;
- the learner does not leave with an inverted or wildly wrong sense of
  relative size/distance.

### DIM-3 — Visual presentation

Pass evidence:

- bodies are rendered credibly at the shipping bar (materials, lighting,
  exposure, atmosphere);
- no visible placeholder, broken mesh, untextured surface, or Z-fighting in the
  qualified flow;
- presentation is coherent across all mission states and viewports;
- quality tiers all look intentional, including `reduced`.

### DIM-4 — Camera and navigation

Pass evidence:

- system → approach → orbit → inspection is smooth and skippable;
- orientation is never lost, and recoverable in one action;
- no camera state traps the learner;
- camera skill is never required to obtain a required measurement;
- reduced-motion path reaches the same end states cleanly.

### DIM-5 — Mission fantasy

Pass evidence:

- a fresh learner can say what role they are playing;
- instrument use feels like operating real equipment;
- the brief → measurement → conclusion arc feels like a survey, not a quiz;
- no element breaks the fiction with worksheet or assessment furniture.

### DIM-6 — Agency

Pass evidence:

- target, instrument, evidence, comparison, and claim are genuine learner
  choices;
- different defensible paths exist and are accepted;
- the learner's choices visibly change the debrief;
- no auto-solve and no hint that performs a required choice.

### DIM-7 — Evidence interpretation

Pass evidence:

- the learner must inspect data to succeed;
- a correct claim with no cited evidence is rejected;
- a wrong claim with well-cited evidence receives instructive feedback rather
  than a bare "incorrect";
- comparison requires at least two bodies' real values;
- debrief findings are attributable to specific learner actions.

### DIM-8 — Onboarding

Pass evidence:

- the guided mission is completable by a first-time target-age learner with no
  external instruction;
- the first actionable control is discoverable quickly;
- hints guide attention without giving answers;
- no dead end exists at any state;
- vocabulary is explained in-context.

### DIM-9 — Accessibility

Pass evidence:

- the full loop is completable keyboard-only;
- touch and pointer paths work;
- every required measurement exists as semantic, screen-reader-readable data;
- 200% zoom/reflow and 360 px width pass;
- no color-only, hover-only, drag-only, motion-only, or audio-only requirement;
- visible focus throughout;
- reduced-motion equivalent is complete;
- **manual** screen-reader and low-vision findings are recorded.

### DIM-10 — Responsiveness and polish

Pass evidence:

- performance budgets met on the reference and lower-capability device classes;
- no jank, no stalled loading, no unresolved spinner;
- interaction feedback is immediate;
- audio (if used) supports without demanding attention, and mute is complete;
- the product feels finished rather than like a prototype.

---

## 6. Review evidence format

For each dimension and comparator, record:

- exact candidate SHA and release ID;
- reviewer;
- date;
- observed evidence (what they actually did and saw);
- material gap;
- severity;
- remediation issue/commit if applicable;
- accepted limitation **only** with explicit owner rationale.

## 7. Human-only judgements

The following may **not** be produced or signed off by automation:

- fun and engagement;
- clarity for a target-age learner;
- discoverability for a child;
- screen-reader experience;
- originality/plagiarism judgement;
- science-expert approval.

Automation may gather supporting evidence. It may not render the verdict.

## 8. Release gate

No dimension may be left unreviewed. Any unresolved P0/P1 finding, high-severity
science error, inaccessible required interaction, or provenance problem blocks
promotion (`RELEASE_CONTRACT.md`).

"Meets NGSS" is not sufficient evidence that this is a good game.
