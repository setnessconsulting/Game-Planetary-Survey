/**
 * The surface inventory: every screen, panel, and state the product owes, written
 * down as data.
 *
 * This is the other half of the PS-DESIGN handoff (docs/DESIGN_SYSTEM.md,
 * GAME-367). A Figma file would not have been more authoritative than this, for the
 * reason that matters here: a canvas cannot fail a build. Every rule the design
 * contract states — a required distinction carries a non-colour encoding, a surface
 * that shows visual data names its text or table equivalent, a surface that uses
 * the 3D view names its non-precision alternative, every interactive control meets
 * the touch minimum — is a field below, checked by
 * `scripts/check-design-system.mjs` and asserted in `tests/design/`.
 *
 * Three things this file is deliberately not:
 *
 *  - **not a picture.** Layout intent is prose. A mockup that is not rendered by the
 *    shipping code drifts from it silently; a sentence about a layout that a test
 *    can cross-check does not.
 *  - **not a second spec for the science.** Where a surface presents evidence, it
 *    says which domain type it reads. The values, units, and precision come from
 *    the domain layer, and PS-05 onward must not restate them here.
 *  - **not finished.** `maturity` records how far each surface has been taken.
 *    Anything marked `specified` is designed and not built, and no surface in this
 *    file may be described as visually approved — the reference file that would
 *    justify that does not exist (docs/STATUS.md, open constraint 3).
 */

import type { TokenGroup } from "./tokens";

/** How far a surface has been taken. Nothing here claims visual approval. */
export type SurfaceMaturity =
  /** Specified and implemented in the shipping code. */
  | "implemented"
  /** Designed here; implementation belongs to a named later story. */
  | "specified"
  /** Partly implemented; the gap is named in `knownGap`. */
  | "partial";

export interface SurfaceStateSpec {
  readonly id: string;
  readonly label: string;
  /** What the learner observes, and what they can do, in this state. */
  readonly description: string;
  /** How the learner knows they are in this state without relying on colour. */
  readonly nonColorSignal: string;
}

export interface SurfaceSpec {
  readonly id: string;
  /** `loop-step` surfaces serve one step; `global-state` surfaces can occur in any step. */
  readonly kind: "loop-step" | "global-state";
  /** For `loop-step` surfaces only: the id in `src/ui/loopSteps.ts`. */
  readonly loopStep: string | null;
  readonly name: string;
  readonly purpose: string;
  /** Landmarks, roles, and the accessible-name pattern the surface must expose. */
  readonly semantics: readonly string[];
  /** At least two: a surface with one state has no states. */
  readonly states: readonly SurfaceStateSpec[];
  /** How required distinctions are carried without hue (docs/ACCESSIBILITY.md A-9). */
  readonly nonColorEncoding: string;
  /** True when the surface renders data that has a visual form. */
  readonly showsVisualData: boolean;
  /** Required when `showsVisualData`: the real text/table equivalent (A-13). */
  readonly textualEquivalent: string | null;
  /** True when the surface depends on the 3D view. */
  readonly usesThreeDView: boolean;
  /** Required when `usesThreeDView`: the semantic route to the same action (A-14). */
  readonly nonPrecisionAlternative: string | null;
  readonly interactive: boolean;
  /** Required when `interactive`: how the control meets the touch minimum (A-3). */
  readonly touchTarget: string | null;
  readonly keyboard: string;
  /** Motion tokens this surface may use. Empty means it does not animate. */
  readonly motionTokens: readonly string[];
  readonly maturity: SurfaceMaturity;
  /** Set only when `maturity` is `partial`: exactly what is missing, and its owner. */
  readonly knownGap: string | null;
}

export const SURFACES: readonly SurfaceSpec[] = [
  {
    id: "workstation-load",
    kind: "loop-step",
    loopStep: "load",
    name: "Workstation load",
    purpose:
      "Bring the probe online and report capability honestly, so a learner never faces an unannounced state change or a blank screen they cannot interpret.",
    semantics: [
      "One `main` landmark owning the whole shell.",
      "A polite live region carrying every state change as text, announced once.",
      "The heading is the page's single `h1`; a skip link precedes it carrying an explicit tabindex so it is in the sequential focus order on every engine.",
    ],
    states: [
      {
        id: "loading",
        label: "Opening",
        description:
          "The shell is up, the renderer is still starting, and the briefing and notebook are already usable.",
        nonColorSignal: "The live region says the workstation is opening, and the viewport shows the word for its own state.",
      },
      {
        id: "ready",
        label: "Online",
        description:
          "A backend is in use and named. The viewport reports which one, and whether it is the backend that was requested.",
        nonColorSignal: "The backend name is printed as text beside a 'requested' label, so 'in use' and 'requested' cannot be confused.",
      },
      {
        id: "degraded",
        label: "Limited view",
        description:
          "A backend is in use but the requested one was unavailable. Capability-driven options are unavailable rather than silently weaker.",
        nonColorSignal: "The live region states the fallback in words; the highest quality tier is visibly absent from the selector rather than greyed out unexplained.",
      },
      {
        id: "unavailable",
        label: "No 3D view",
        description:
          "No backend could start. The overlay explains it, and the whole evidence route stays present and usable.",
        nonColorSignal: "The overlay carries the sentence explaining it, not an icon alone.",
      },
    ],
    nonColorEncoding:
      "State is a word in the viewport and a sentence in the live region. No state is distinguished by the canvas's appearance.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget:
      "Quality, motion, and audio controls are 40 px tall with padded hit areas reaching the 44 px minimum.",
    keyboard:
      "The skip link is the first tab stop on every engine. Every control here is a real button, select, or labelled checkbox.",
    motionTokens: [],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "briefing",
    kind: "loop-step",
    loopStep: "briefing",
    name: "Briefing",
    purpose:
      "State the survey question, what the learner is being asked to determine, and what this mission explicitly does not claim — before any instrument is chosen.",
    semantics: [
      "A `section` labelled by its own `h2`, reachable without the renderer.",
      "The science boundaries render as a labelled list, not a footnote: `mission.scienceBoundaries` is content, and each boundary states what is not claimed.",
    ],
    states: [
      {
        id: "no-mission",
        label: "Nothing loaded",
        description:
          "Explains what state the build is in: content authored and sourced, science review outstanding, and no mission loadable yet.",
        nonColorSignal: "Prose, in the panel, naming the outstanding review.",
      },
      {
        id: "briefed",
        label: "Brief accepted",
        description:
          "The question, the target worlds, the claim the learner will be asked to make, and the boundaries are all readable as text.",
        nonColorSignal: "The live region confirms the brief was accepted and the loop's brief step reads as done.",
      },
    ],
    nonColorEncoding:
      "Mission state is carried by the loop checklist's marker and its 'Status:' text label, never by a highlight colour.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: false,
    touchTarget: null,
    keyboard: "Read-only text; no focus stop of its own beyond the heading.",
    motionTokens: [],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "target-selection",
    kind: "loop-step",
    loopStep: "chooseTarget",
    name: "Target selection",
    purpose:
      "Let the learner choose which world to survey from the catalogue, with each world's identity and what is known about it available as text.",
    semantics: [
      "A `radiogroup` or list of real buttons, one per target world, each with an accessible name that includes the world's display name.",
      "A companion table of the selected world's available properties, as a real `table`, so selection is never the only way to learn what a world offers.",
    ],
    states: [
      {
        id: "unchosen",
        label: "No target",
        description: "Every world is offered; the brief says why more than one appears.",
        nonColorSignal: "The live region says no target is chosen.",
      },
      {
        id: "chosen",
        label: "Target set",
        description:
          "The chosen world is named in the live region and in the panel, and the properties it has a sourced value for are listed.",
        nonColorSignal: "The chosen row carries a text marker plus the world name; a distinct hue is never the signal.",
      },
      {
        id: "property-unavailable",
        label: "No value for that property",
        description:
          "Where a world has no sourced value for a property — the Moon has no orbital radius — the panel says so, in words, rather than showing a blank or a zero.",
        nonColorSignal: "The literal phrase that no published value exists, plus the reason the instrument cannot report one.",
      },
    ],
    nonColorEncoding:
      "Selection is a marker character plus the world's name in the live region, not a background tint.",
    showsVisualData: true,
    textualEquivalent:
      "The target table: world, mean radius with unit, and the sourced properties available. The 3D view of the system is an illustration of the same table and is never the only way to read it.",
    usesThreeDView: true,
    nonPrecisionAlternative:
      "Choosing a target is a list selection. Approach framing, orbit, and camera precision change what the view shows and affect nothing about which world is selected or what can be measured.",
    interactive: true,
    touchTarget: "Each target row is at least --ps-touch-min tall, including at phone width.",
    keyboard:
      "Tab reaches each target; space or enter selects. Focus order follows the table's reading order, not the viewport's.",
    motionTokens: ["--ps-motion-fast", "--ps-motion-base"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "instrument-selection",
    kind: "loop-step",
    loopStep: "selectInstrument",
    name: "Instrument selection",
    purpose:
      "Make choosing an instrument a scientific decision: each instrument states what it measures, what it costs, and what it cannot answer.",
    semantics: [
      "One selectable control per instrument, each with an accessible name of the instrument label and a description carrying its purpose.",
      "The measurement it returns is described in the instrument's own words, from `src/domain/measurement.ts`, so the copy cannot drift from what the domain does.",
    ],
    states: [
      {
        id: "available",
        label: "Instrument offered",
        description: "Purpose, cost, and the property it reports are readable before selection.",
        nonColorSignal: "Each option's purpose is text on the option itself.",
      },
      {
        id: "selected",
        label: "Instrument selected",
        description:
          "The live region confirms the selection and restates the instrument's purpose.",
        nonColorSignal: "Confirmation is a sentence; the selected option also carries a text marker.",
      },
      {
        id: "cannot-answer",
        label: "Wrong instrument for the question",
        description:
          "An instrument that cannot measure the mission's property is not offered for it, and if the learner tries anyway the refusal explains why rather than failing silently.",
        nonColorSignal: "The refusal reason is learner-facing text, from the domain's own rejection message.",
      },
    ],
    nonColorEncoding: "Selection is a text marker plus the confirmation sentence.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "Instrument options are at least --ps-touch-min tall.",
    keyboard: "Arrow keys move within the group; space or enter selects. Focus returns to the group after a measurement.",
    motionTokens: ["--ps-motion-fast"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "observe-measure",
    kind: "loop-step",
    loopStep: "observe",
    name: "Observe and measure",
    purpose:
      "Run the instrument and report the measurement — value, unit, precision, and source — as text a learner can read, copy, and reason about.",
    semantics: [
      "The reading is text with the unit beside the value, exposed in the live region when it arrives.",
      "The renderer's role is announced separately: the viewport reports its own state and is `aria-hidden`, so it never becomes a parallel, incoherent source of the same reading.",
    ],
    states: [
      {
        id: "idle",
        label: "Ready",
        description: "The instrument is selected and a measurement can be taken.",
        nonColorSignal: "The loop's observe step reads as active with its own note.",
      },
      {
        id: "measured",
        label: "Measured",
        description:
          "Value, unit, source, and precision are on screen as text; the evidence notebook is one action away.",
        nonColorSignal: "The live region announces the measurement; the value carries its unit in the same string.",
      },
      {
        id: "unavailable",
        label: "No authoritative value",
        description:
          "The instrument reports that no published value exists for this world and property. The gap is information; nothing is substituted.",
        nonColorSignal: "The instrument's own explanation is shown, and the loop step stays active rather than appearing complete.",
      },
    ],
    nonColorEncoding:
      "A reading is a number, a unit, and a source tag. None of those is a colour, and a colour never changes a reading's meaning.",
    showsVisualData: true,
    textualEquivalent:
      "The reading itself is the equivalent: value, unit, significant figures, and source id as text. Any instrument animation is illustrative, and the number is available before, during, and after it.",
    usesThreeDView: true,
    nonPrecisionAlternative:
      "The measurement is a control that returns a value. Camera framing, model orientation, and renderer quality change nothing about the reading, and the reading is available with no renderer at all.",
    interactive: true,
    touchTarget: "The measure control is at least --ps-touch-min tall, and is never drag-only (A-11).",
    keyboard: "Enter runs the selected instrument. The reading is announced through the live region, not read from the canvas.",
    motionTokens: ["--ps-motion-fast", "--ps-motion-base", "--ps-motion-camera"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "evidence-capture",
    kind: "loop-step",
    loopStep: "captureEvidence",
    name: "Evidence capture",
    purpose:
      "Make keeping evidence an explicit learner choice, and show what the notebook now holds.",
    semantics: [
      "A real button whose accessible name states the action, not the outcome.",
      "The notebook is a `table` with column headers — body, property, reading, source, order — so a reading's provenance is a column rather than a tooltip.",
    ],
    states: [
      {
        id: "nothing-measured",
        label: "Nothing to keep",
        description:
          "Capture before a measurement is refused with a reason that says so, rather than silently doing nothing.",
        nonColorSignal: "The refusal sentence appears in the live region.",
      },
      {
        id: "captured",
        label: "Captured",
        description: "The record appears in the notebook with its reading, unit, source, and capture order.",
        nonColorSignal: "The live region confirms the capture and the notebook row count changes in text.",
      },
      {
        id: "already-captured",
        label: "Already in the notebook",
        description:
          "A duplicate observation is refused, so the notebook cannot be padded with repeats of one reading to satisfy a citation requirement.",
        nonColorSignal: "The refusal names the existing record.",
      },
    ],
    nonColorEncoding: "A captured record is a row with a source tag; the confirmation is a sentence.",
    showsVisualData: true,
    textualEquivalent:
      "The notebook table is the data. It is not a rendering of a chart: it is the structure that any chart added later must be equivalent to.",
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "The capture control and every notebook row's controls are at least --ps-touch-min tall.",
    keyboard: "Capture is a button. The notebook is a navigable table with headers, not a focus trap.",
    motionTokens: ["--ps-motion-fast"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "comparison",
    kind: "loop-step",
    loopStep: "compare",
    name: "Compare worlds",
    purpose:
      "Put two or more worlds' values side by side, on the same property and in the same unit, so the comparison is a reading rather than an impression.",
    semantics: [
      "A `table` with a caption naming the property compared, one row per world, and a column for the difference.",
      "The comparison is requested by a control; it is never inferred from what happens to be visible.",
    ],
    states: [
      {
        id: "insufficient",
        label: "Not comparable yet",
        description:
          "Fewer than two worlds hold the property, and the surface says how many more are needed and why.",
        nonColorSignal: "The refusal is a sentence from the domain, which counts the records it has.",
      },
      {
        id: "comparable",
        label: "Compared",
        description:
          "Rows in a stable order with the property, each value with its unit, and the ranked finding stated in words.",
        nonColorSignal: "Ranking is a row order plus a text statement, not a bar length or a colour.",
      },
      {
        id: "proportional",
        label: "Proportional reading offered",
        description:
          "Where a property is a proportion of body radius, the proportional figure is offered beside the raw one, with the formula that produced it named.",
        nonColorSignal: "The proportion is a percentage with its basis in words ('of the body's mean radius').",
      },
    ],
    nonColorEncoding:
      "Order and words carry the finding. A chart added in PS-07 must be equivalent to this table, not a replacement for it.",
    showsVisualData: true,
    textualEquivalent:
      "The comparison table above. Any chart in PS-07 is a second view of the same rows, and the table is the one that ships first.",
    usesThreeDView: true,
    nonPrecisionAlternative:
      "A comparison view places two worlds at a non-literal relative scale. The table is the measurement: the drawn compression is presentation metadata and never a value, and no measurement is taken from it.",
    interactive: true,
    touchTarget: "The compare control and the table's own controls are at least --ps-touch-min tall.",
    keyboard: "Comparison is requested from a control; the table is navigable with headers announced.",
    motionTokens: ["--ps-motion-base", "--ps-motion-slow", "--ps-motion-camera"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "claim",
    kind: "loop-step",
    loopStep: "makeClaim",
    name: "Make a claim",
    purpose:
      "Let the learner state a relation between two worlds' measured values, with the comparison basis explicit, in a form that can be checked rather than appraised.",
    semantics: [
      "A real `form` with labelled selects or radio groups — property, relation, first world, second world, basis — so the claim is composed from named parts, not typed as prose.",
      "No drag or canvas interaction is required (A-11).",
    ],
    states: [
      {
        id: "drafting",
        label: "Drafting",
        description: "The claim's parts are chosen and the draft restates them as one sentence.",
        nonColorSignal: "The draft sentence is rendered as text as the parts change.",
      },
      {
        id: "uncitable",
        label: "Nothing to cite yet",
        description:
          "A claim cannot be drafted before the notebook holds a comparable pair; the domain refuses it and the refusal says why.",
        nonColorSignal: "The refusal sentence names what is missing.",
      },
      {
        id: "drafted",
        label: "Drafted",
        description: "The claim exists with a deterministic identity, ready for citations.",
        nonColorSignal: "The live region confirms the draft and the loop step reads as active.",
      },
    ],
    nonColorEncoding: "Claim state is text; the composed claim sentence is the visible artefact.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "Every field and the submit control are at least --ps-touch-min tall.",
    keyboard: "Standard form semantics: tab between fields, arrow keys within a group, enter submits when valid.",
    motionTokens: [],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "cite-evidence",
    kind: "loop-step",
    loopStep: "citeEvidence",
    name: "Cite evidence",
    purpose:
      "Attach the notebook observations that support the claim, and make the consequence of an incomplete citation visible before submission.",
    semantics: [
      "A `group` of checkboxes, one per notebook record, labelled by the record's body and property.",
      "The submission control's accessible name states that it submits the claim with the cited observations.",
    ],
    states: [
      {
        id: "uncited",
        label: "Cited: none",
        description:
          "A claim with no citation can be submitted, and will be refused with an explanation rather than being blocked silently. Being right is not the same as being supported.",
        nonColorSignal: "The count of cited observations is text, and the refusal is a sentence.",
      },
      {
        id: "partial",
        label: "Cited: one world",
        description:
          "The verdict names the missing world, so the learner can fix the citation rather than re-measure.",
        nonColorSignal: "The evaluation's citation problem is a sentence naming the world.",
      },
      {
        id: "complete",
        label: "Cited: both worlds",
        description: "The claim can be evaluated, and the verdict is supported or contradicted on the cited values.",
        nonColorSignal: "The verdict is a word: supported, contradicted, or insufficient evidence.",
      },
    ],
    nonColorEncoding:
      "The verdict is a word with an explanation. Success is never a green tick and nothing else, and a 'contradicted' verdict is never signalled in red alone.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "Each citation checkbox row is a full-width label at least --ps-touch-min tall.",
    keyboard: "Checkboxes are individually focusable and space toggles them; the submit button follows them in focus order.",
    motionTokens: ["--ps-motion-fast"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "debrief",
    kind: "loop-step",
    loopStep: "debrief",
    name: "Debrief",
    purpose:
      "Explain how the evidence backed the claim, attribute every stated fact, and distinguish what the learner measured from what the source says.",
    semantics: [
      "An `h2`-labelled section, with the verdict first and the reasoning beneath it.",
      "Every debrief fact states whether it was measured or sourced; a sourced fact names the register entry behind it.",
    ],
    states: [
      {
        id: "supported",
        label: "Supported",
        description: "The claim follows from the cited values, and the debrief says which values and how.",
        nonColorSignal: "The word 'supported' plus the sentence that says why.",
      },
      {
        id: "contradicted",
        label: "Contradicted",
        description:
          "The cited values point the other way. The debrief shows the values rather than asserting a correction.",
        nonColorSignal: "The word 'contradicted', the two values, and the explanation. Never blame.",
      },
      {
        id: "insufficient",
        label: "Not yet checkable",
        description:
          "The citation was incomplete. The debrief names what is missing and offers revision rather than a restart.",
        nonColorSignal: "The word 'insufficient evidence' and the named missing observation.",
      },
    ],
    nonColorEncoding: "The verdict is a word; each finding is a sentence with its values in it.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: false,
    touchTarget: null,
    keyboard: "Read-only; the revise control that follows it is keyboard reachable.",
    motionTokens: ["--ps-motion-base"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "revise-replay",
    kind: "loop-step",
    loopStep: "reviseOrReplay",
    name: "Revise or replay",
    purpose:
      "Offer the two honest recoveries: collect what was missing and revise the same claim, or replay a variant as a fresh run.",
    semantics: [
      "Two distinct controls whose accessible names say which is which — revise the claim, or replay a variant.",
      "A replay announces that it is a variant, and its seed, so two runs are never confused.",
    ],
    states: [
      {
        id: "revise",
        label: "Revise available",
        description:
          "Returning to the survey keeps the notebook. Nothing captured is discarded, and the revised claim is re-evaluated against the same evidence.",
        nonColorSignal: "The button's label states what is preserved.",
      },
      {
        id: "replay",
        label: "Replay available",
        description: "A variant run starts from the same content with a different seed and says so.",
        nonColorSignal: "The variant's identity is announced in text.",
      },
      {
        id: "revision-in-place",
        label: "Revision keeps the notebook",
        description:
          "Revising reopens the claim in place: the notebook and the drafted claim are kept, the previous verdict is cleared, and the learner can re-cite and resubmit without taking another reading.",
        nonColorSignal: "The control's label states what is preserved before it is used.",
      },
    ],
    nonColorEncoding: "Both actions are labelled buttons; neither is distinguished by colour.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "Both controls are at least --ps-touch-min tall.",
    keyboard: "Standard button semantics; focus moves to the survey's first control after a revision.",
    motionTokens: ["--ps-motion-base", "--ps-motion-slow"],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "hints",
    kind: "global-state",
    loopStep: null,
    name: "Progressive hints",
    purpose:
      "Offer authored, evidence-oriented hints one at a time, in any step of the loop, without ever making the learner's scientific choice for them (docs/UX_USER_FLOW.md §4).",
    semantics: [
      "A `section` labelled by its own `h2`, containing a real button whose accessible name states the action.",
      "Each revealed hint is an item in an ordered list, so its place in the sequence is text; the revealed and remaining counts are announced politely.",
    ],
    states: [
      {
        id: "unused",
        label: "No hint requested",
        description:
          "The control is offered and says what a hint does — points at what to look at next — before it is used.",
        nonColorSignal: "The count reads '0 of N hints shown' as text.",
      },
      {
        id: "revealed",
        label: "Hints shown",
        description:
          "Each requested hint appears in authored order, added to the list rather than replacing the last one.",
        nonColorSignal: "The count of shown and remaining hints is a sentence, and the new hint is announced.",
      },
      {
        id: "exhausted",
        label: "All hints shown",
        description:
          "Every authored hint has been revealed; the control is disabled and the surface says there are no more for this mission rather than going silent.",
        nonColorSignal: "The count says so in words, not by the control alone appearing inert.",
      },
    ],
    nonColorEncoding:
      "Hint state is a count in words plus an ordered list; the exhausted state is stated in text, not implied by a disabled control.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "The request control is at least --ps-touch-min tall.",
    keyboard:
      "A real button; each requested hint is announced through the live region and is not required to be read from anywhere else.",
    motionTokens: [],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "renderer-fallback",
    kind: "global-state",
    loopStep: null,
    name: "Renderer unavailable or failed",
    purpose:
      "Keep the whole scientific route intact when the 3D view cannot run, and say so in words rather than showing an empty frame. This surface *is* the non-precision alternative: it is the reason the renderer can be treated as an enhancement, because every step's evidence route has to exist without it.",
    semantics: [
      "The overlay is text, associated with the viewport, and not an alert: it is a state, not an error the learner caused.",
      "The canvas is `aria-hidden` and outside the tab order, so a screen reader never depends on it (A-4).",
    ],
    states: [
      {
        id: "degraded",
        label: "Limited",
        description: "A fallback backend runs, named, with the capabilities it lacks made unavailable rather than faked.",
        nonColorSignal: "The backend in use and the backend requested are both printed.",
      },
      {
        id: "unavailable",
        label: "Unavailable",
        description:
          "No backend. The overlay states that the 3D view cannot start and that the evidence route is unaffected, and it is true: BRIEFING, notebook, comparison, claim, and debrief all remain.",
        nonColorSignal: "The sentence itself, plus the loop checklist staying fully present.",
      },
      {
        id: "lost",
        label: "Context lost after evidence was captured",
        description:
          "A renderer failure after capture must not lose evidence: the notebook lives in the domain layer, and the surface says the evidence is safe.",
        nonColorSignal: "The notebook's row count and contents are unchanged and visible.",
      },
    ],
    nonColorEncoding: "State is a sentence in the overlay and in the live region.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: false,
    touchTarget: null,
    keyboard: "The overlay is not focusable and does not trap focus; it must not sit between the skip link and the controls.",
    motionTokens: [],
    maturity: "implemented",
    knownGap: null,
  },

  {
    id: "reduced-motion",
    kind: "global-state",
    loopStep: null,
    name: "Reduced motion",
    purpose:
      "Reach every same end state with no perceptible interpolation, without removing any route or any piece of evidence.",
    semantics: [
      "A preference control with a visible checked state, alongside the operating-system preference rather than instead of it.",
      "The state is announced; nothing essential is conveyed by the absence of motion.",
    ],
    states: [
      {
        id: "system",
        label: "Following the system",
        description: "`prefers-reduced-motion: reduce` sets every motion token to 1 ms.",
        nonColorSignal: "The control's checked state, and the token values themselves are the evidence.",
      },
      {
        id: "requested",
        label: "Reduced by choice",
        description:
          "The learner has asked for less motion in-product. The same tokens are neutralised and every route stays available.",
        nonColorSignal: "The checkbox is checked and named; no content is hidden to achieve it.",
      },
      {
        id: "full",
        label: "Full motion",
        description: "Motion tokens carry their normal values. No transition is required for any state to be reached.",
        nonColorSignal: "Nothing depends on motion, so there is nothing to signal.",
      },
    ],
    nonColorEncoding: "The preference is a labelled checkbox with a checked state.",
    showsVisualData: false,
    textualEquivalent: null,
    usesThreeDView: false,
    nonPrecisionAlternative: null,
    interactive: true,
    touchTarget: "The preference control's row is at least --ps-touch-min tall.",
    keyboard: "A labelled checkbox; space toggles it.",
    motionTokens: [],
    maturity: "implemented",
    knownGap: null,
  },
];

/** A token group a surface's `motionTokens` entry must belong to. */
export const MOTION_TOKEN_GROUP: TokenGroup = "motion";
