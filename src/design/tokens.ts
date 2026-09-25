/**
 * Design tokens: the source of truth for every visual constant.
 *
 * This module is the machine-readable half of the PS-DESIGN handoff
 * (docs/DESIGN_SYSTEM.md, GAME-367). It is deliberately **dependency-free**: no
 * imports at all, so `scripts/build-tokens.mjs` and
 * `scripts/check-design-system.mjs` can load it directly with Node's TypeScript
 * support and use it as the authority, rather than re-parsing CSS or trusting a
 * document to stay in step.
 *
 * `src/styles/tokens.css` is GENERATED from this file. Never edit the CSS by hand:
 * `npm run build:tokens` rewrites it, and `npm run check:tokens` fails the build
 * when the committed CSS does not match. That direction matters — a value is
 * decided here, with its purpose written beside it, and the stylesheet is a build
 * artefact of that decision.
 *
 * Three rules shaped this file, and each one has a check behind it:
 *
 *  1. **Every token states its purpose.** A design constant whose reason is not
 *     written down becomes folklore, and folklore is what a later story silently
 *     changes. `purpose` is required, non-empty, and reviewed like code.
 *  2. **Text carries meaning in more than colour.** Colour tokens exist for
 *     hierarchy and emphasis; required distinctions are carried by the marker and
 *     text tokens in the `encoding` group (docs/ACCESSIBILITY.md A-9).
 *  3. **Contrast is a measured property, not a taste.** `CONTRAST_REQUIREMENTS`
 *     declares the pairs that ship, and the check computes WCAG ratios and fails
 *     the build below the declared minimum (docs/ACCESSIBILITY.md A-6).
 */

/** The four step-status markers. Ids match `LoopStepStatus` plus `blocked`. */
export type MarkerId = "done" | "active" | "pending" | "blocked";

export interface MarkerEncoding {
  readonly id: MarkerId;
  /** The glyph itself, without brackets or escaping. */
  readonly glyph: string;
  readonly purpose: string;
}

/**
 * The marker glyphs, defined once.
 *
 * Both consumers read from here: the emitted CSS custom properties, and
 * `src/ui/loopSteps.ts`, which renders the marker beside each step. Before this
 * existed the glyphs lived in two places and had already drifted — the stylesheet
 * declared a middle dot for a not-yet-reached step while the UI drew an empty
 * bracket. A required encoding duplicated across a stylesheet and a component is
 * exactly the kind of disagreement a design system exists to prevent.
 */
export const MARKER_ENCODINGS: readonly MarkerEncoding[] = [
  {
    id: "done",
    glyph: "\u2713",
    purpose:
      "Non-colour marker for a completed step. Required distinctions are carried by a marker plus a text label, never by hue alone (docs/ACCESSIBILITY.md A-9).",
  },
  {
    id: "active",
    glyph: "\u25B8",
    purpose: "Non-colour marker for the current step.",
  },
  {
    id: "pending",
    glyph: "\u00B7",
    purpose:
      "Non-colour marker for a step not yet reached. A dot rather than a blank, so a pending step reads as deliberately not-yet rather than as a rendering failure.",
  },
  {
    id: "blocked",
    glyph: "\u2715",
    purpose: "Non-colour marker for a step that cannot proceed, paired with the reason in text.",
  },
];

/** The glyph for one marker id. Throws rather than inventing a fallback glyph. */
export function markerGlyph(id: MarkerId): string {
  const found = MARKER_ENCODINGS.find((marker) => marker.id === id);
  if (!found) throw new Error(`No marker encoding ${id}`);
  return found.glyph;
}

/**
 * A glyph as a CSS string value: quoted, with the code point escaped.
 *
 * Padded to four hex digits because that is the conventional, unambiguous form —
 * `\B7` is legal but reads like a typo next to `\00B7`.
 */
function cssQuotedGlyph(glyph: string): string {
  const codePoint = glyph.codePointAt(0);
  if (codePoint === undefined) throw new Error("A marker encoding needs a glyph");
  return `"\\${codePoint.toString(16).toUpperCase().padStart(4, "0")}"`;
}

/** Which family a token belongs to. Used for grouping and for coverage checks. */
export type TokenGroup =
  | "color"
  | "focus"
  | "typography"
  | "spacing"
  | "radius"
  | "elevation"
  | "motion"
  | "layering"
  | "sizing"
  | "encoding";

export interface DesignToken {
  /** The custom property name, including the `--` prefix. */
  readonly name: string;
  /** Its CSS value, as it will be emitted. */
  readonly value: string;
  readonly group: TokenGroup;
  /** Why this token exists and what a designer may and may not use it for. */
  readonly purpose: string;
}

/**
 * The token list. Order is the emitted order, grouped by family, because a
 * generated stylesheet is easier to review when it reads like a specification.
 */
export const DESIGN_TOKENS: readonly DesignToken[] = [
  // ---------------------------------------------------------------- surfaces
  {
    name: "--ps-surface-0",
    value: "#070a0e",
    group: "color",
    purpose:
      "Deepest background: the page behind everything, and the letterbox around the survey viewport.",
  },
  {
    name: "--ps-surface-1",
    value: "#0d1218",
    group: "color",
    purpose: "Panel background. The default surface for text-bearing content.",
  },
  {
    name: "--ps-surface-2",
    value: "#141b23",
    group: "color",
    purpose: "Raised panel or control background: the first step of elevation.",
  },
  {
    name: "--ps-surface-3",
    value: "#1c252f",
    group: "color",
    purpose:
      "Highest panel step, for a surface sitting over an already-raised one. There is no fourth step on purpose: depth beyond three reads as decoration.",
  },
  {
    name: "--ps-border",
    value: "#2a3642",
    group: "color",
    purpose: "Default divider and container outline. Decorative: it may be low contrast.",
  },
  {
    name: "--ps-border-strong",
    value: "#5a6d80",
    group: "color",
    purpose:
      "Outline of an interactive or focusable container, where the boundary itself carries meaning. Lightened from the PS-02 foundation value #3d4c5c, which measured 2.14:1 against a panel and so failed the 3:1 non-text minimum it exists to meet.",
  },

  // ------------------------------------------------------------------- text
  {
    name: "--ps-text",
    value: "#e8eef5",
    group: "color",
    purpose: "Primary text and measured values. The highest-contrast text token.",
  },
  {
    name: "--ps-text-muted",
    value: "#a3b1c0",
    group: "color",
    purpose: "Secondary text: labels, captions, units, and contextual notes that accompany primary text.",
  },
  {
    name: "--ps-text-subtle",
    value: "#8b9cad",
    group: "color",
    purpose:
      "Lowest-emphasis text: inline metadata such as an observation id. Still meets the AA text minimum, because 'less important' is not a licence to be unreadable.",
  },

  // ---------------------------------------------------------- accents + state
  {
    name: "--ps-accent",
    value: "#6fb4ff",
    group: "color",
    purpose: "Primary interactive accent: links, selected targets, active instrument.",
  },
  {
    name: "--ps-accent-strong",
    value: "#9cccff",
    group: "color",
    purpose: "Hover/emphasis variant of the accent. Never the only signal of a state change.",
  },
  {
    name: "--ps-instrument",
    value: "#ffc46b",
    group: "color",
    purpose:
      "Instrument readings and instrument-selection affordances. Separates 'the probe measured this' from 'the survey says this'.",
  },
  {
    name: "--ps-evidence",
    value: "#7ee0b8",
    group: "color",
    purpose: "Captured evidence: notebook entries and citation affordances.",
  },
  {
    name: "--ps-caution",
    value: "#ffd166",
    group: "color",
    purpose:
      "Contested, unreviewed, or reduced-capability notices. Always paired with text: this is amber, not red, because nothing here is the learner's fault (docs/UX_USER_FLOW.md §6).",
  },

  // ------------------------------------------------------------------ focus
  {
    name: "--ps-focus-ring",
    value: "#ffd166",
    group: "focus",
    purpose:
      "Focus indicator colour. Must meet the 3:1 non-text minimum against every surface it can appear on.",
  },
  {
    name: "--ps-focus-width",
    value: "3px",
    group: "focus",
    purpose: "Focus indicator thickness. Never reduced to fit a layout (docs/ACCESSIBILITY.md §5).",
  },
  {
    name: "--ps-focus-offset",
    value: "2px",
    group: "focus",
    purpose: "Gap between the component and its focus indicator, so the ring is legible over a filled control.",
  },

  // ------------------------------------------------------------- typography
  {
    name: "--ps-font-body",
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    group: "typography",
    purpose:
      "Body and UI text. System faces on purpose: no webfont means no font request, no FOUT, and no licence question (docs/ASSET_PROVENANCE.md §10).",
  },
  {
    name: "--ps-font-mono",
    value: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace",
    group: "typography",
    purpose:
      "Measurement values, units, and observation ids. Tabular alignment is what makes a column of readings comparable at a glance.",
  },
  {
    name: "--ps-text-xs",
    value: "0.78rem",
    group: "typography",
    purpose: "Metadata only: ids, timestamps, source tags. Never a measured value or a required instruction.",
  },
  {
    name: "--ps-text-sm",
    value: "0.875rem",
    group: "typography",
    purpose: "Secondary labels, table headers, control text.",
  },
  {
    name: "--ps-text-base",
    value: "1rem",
    group: "typography",
    purpose: "Body copy and every learner-facing instruction. The floor for required reading.",
  },
  {
    name: "--ps-text-lg",
    value: "1.15rem",
    group: "typography",
    purpose: "Lead paragraph and brief text, where the learner reads a question for the first time.",
  },
  {
    name: "--ps-text-xl",
    value: "1.4rem",
    group: "typography",
    purpose:
      "Section headings: a panel's own heading, one step below the page title, so a learner can find a section without reading its body.",
  },
  {
    name: "--ps-text-2xl",
    value: "1.85rem",
    group: "typography",
    purpose: "The single page heading and the mission title. Beyond this, hierarchy is carried by weight and spacing instead of size.",
  },
  {
    name: "--ps-leading-tight",
    value: "1.25",
    group: "typography",
    purpose: "Headings and single-line values, where tight leading keeps a dense panel readable.",
  },
  {
    name: "--ps-leading-normal",
    value: "1.55",
    group: "typography",
    purpose: "Body text, deliberately loose. Dense scientific prose needs the extra leading more than a marketing page does.",
  },
  {
    name: "--ps-measure",
    value: "68ch",
    group: "typography",
    purpose:
      "Maximum line length for prose. Long lines are the commonest legibility failure in a data-dense tool, and this bounds them.",
  },

  // ---------------------------------------------------------------- spacing
  {
    name: "--ps-space-1",
    value: "0.25rem",
    group: "spacing",
    purpose: "Hairline separation: gap between a value and its unit.",
  },
  {
    name: "--ps-space-2",
    value: "0.5rem",
    group: "spacing",
    purpose: "Tight grouping: label to input, list row padding.",
  },
  {
    name: "--ps-space-3",
    value: "0.75rem",
    group: "spacing",
    purpose: "Default gap between related controls.",
  },
  {
    name: "--ps-space-4",
    value: "1rem",
    group: "spacing",
    purpose: "Panel padding and the standard gap between elements.",
  },
  {
    name: "--ps-space-5",
    value: "1.5rem",
    group: "spacing",
    purpose: "Separation between groups inside one panel.",
  },
  {
    name: "--ps-space-6",
    value: "2rem",
    group: "spacing",
    purpose: "Separation between panels, so a group of related controls reads as one object.",
  },
  {
    name: "--ps-space-7",
    value: "3rem",
    group: "spacing",
    purpose: "Separation between page-level sections.",
  },
  {
    name: "--ps-space-8",
    value: "4rem",
    group: "spacing",
    purpose:
      "Vertical rhythm at the top level, and the reserved area around a focused task. The largest step on purpose: past this, emptiness stops reading as grouping.",
  },

  // ------------------------------------------------------------------ shape
  {
    name: "--ps-radius-sm",
    value: "4px",
    group: "radius",
    purpose: "Inputs, chips, and inline controls.",
  },
  {
    name: "--ps-radius-md",
    value: "8px",
    group: "radius",
    purpose: "Panels, cards, and the notebook's own container: the default rounded corner.",
  },
  {
    name: "--ps-radius-lg",
    value: "14px",
    group: "radius",
    purpose: "The survey viewport frame and full-surface containers.",
  },
  {
    name: "--ps-shadow-1",
    value: "0 1px 2px rgb(0 0 0 / 45%)",
    group: "elevation",
    purpose: "Resting elevation for a raised control.",
  },
  {
    name: "--ps-shadow-2",
    value: "0 6px 18px rgb(0 0 0 / 45%)",
    group: "elevation",
    purpose:
      "Overlay elevation: a panel or popover floating over content. Depth never carries meaning on its own — see --ps-z-*.",
  },

  // ----------------------------------------------------------------- motion
  {
    name: "--ps-motion-fast",
    value: "120ms",
    group: "motion",
    purpose: "Feedback on a direct manipulation: press, toggle, row focus.",
  },
  {
    name: "--ps-motion-base",
    value: "220ms",
    group: "motion",
    purpose: "Panel and disclosure transitions: something appears or changes in place.",
  },
  {
    name: "--ps-motion-slow",
    value: "420ms",
    group: "motion",
    purpose: "Larger spatial change: a panel swapping, the notebook opening.",
  },
  {
    name: "--ps-motion-camera",
    value: "640ms",
    group: "motion",
    purpose:
      "Camera and viewport transitions. The longest step, and the first thing reduced motion removes, because it is the only motion that moves the whole frame.",
  },
  {
    name: "--ps-ease",
    value: "cubic-bezier(0.2, 0, 0.2, 1)",
    group: "motion",
    purpose: "The single easing curve. One curve keeps unrelated transitions feeling related; a second curve has to earn its place.",
  },

  // --------------------------------------------------------------- layering
  {
    name: "--ps-z-content",
    value: "0",
    group: "layering",
    purpose: "Document flow: everything in the reading order.",
  },
  {
    name: "--ps-z-viewport",
    value: "10",
    group: "layering",
    purpose:
      "The renderer canvas. Kept below every accessible surface so the 3D view can never cover required content.",
  },
  {
    name: "--ps-z-toolbar",
    value: "20",
    group: "layering",
    purpose: "Instrument and camera controls that float over the viewport.",
  },
  {
    name: "--ps-z-overlay",
    value: "30",
    group: "layering",
    purpose: "Loading, error, and fallback overlays. Above the viewport, below a modal.",
  },
  {
    name: "--ps-z-modal",
    value: "40",
    group: "layering",
    purpose: "Dialogs that take focus, such as a confirmation the learner must answer.",
  },

  // ----------------------------------------------------------------- sizing
  {
    name: "--ps-touch-min",
    value: "44px",
    group: "sizing",
    purpose:
      "Minimum hit area for any interactive control on a touch-capable viewport (docs/ACCESSIBILITY.md A-3). Enforced by the design-system check against the surface inventory.",
  },
  {
    name: "--ps-control-height",
    value: "40px",
    group: "sizing",
    purpose:
      "Default control height on pointer-capable viewports. Below --ps-touch-min on purpose: the hit area is grown to the minimum by padding rather than by making a dense toolbar tiring.",
  },

  // --------------------------------------------------------------- encoding
  ...MARKER_ENCODINGS.map((marker) => ({
    name: `--ps-marker-${marker.id}`,
    value: cssQuotedGlyph(marker.glyph),
    group: "encoding" as const,
    purpose: marker.purpose,
  })),
];

/**
 * Motion values under `prefers-reduced-motion: reduce`.
 *
 * Not "no motion": a 1 ms transition still fires the transition events an
 * implementation may rely on, and still prevents a flash of un-styled final state,
 * while removing every perceptible movement. The camera step is included even
 * though it is only used by the renderer, because a rule the renderer can opt out
 * of is not a rule (docs/ACCESSIBILITY.md A-8).
 */
export const REDUCED_MOTION_OVERRIDES: Readonly<Record<string, string>> = {
  "--ps-motion-fast": "1ms",
  "--ps-motion-base": "1ms",
  "--ps-motion-slow": "1ms",
  "--ps-motion-camera": "1ms",
};

/** The token group whose members must all be neutralised under reduced motion. */
export const MOTION_GROUP: TokenGroup = "motion";

export interface Breakpoint {
  readonly id: "phone" | "tablet" | "desktop";
  readonly minWidthPx: number;
  readonly label: string;
  readonly purpose: string;
}

/**
 * Layout breakpoints.
 *
 * Data, not custom properties: CSS cannot use a custom property inside a media
 * query, so emitting them would create a token that silently does nothing. The
 * checker asserts these are ascending and that the smallest matches the minimum
 * supported width, and the components use the same numbers in their queries.
 */
export const BREAKPOINTS: readonly Breakpoint[] = [
  {
    id: "phone",
    minWidthPx: 360,
    label: "Phone",
    purpose:
      "Narrowest supported layout. The evidence route must be complete here with no horizontal scrolling of primary content, and the 3D viewport may be reduced or replaced (docs/UX_USER_FLOW.md §7).",
  },
  {
    id: "tablet",
    minWidthPx: 768,
    label: "Tablet",
    purpose:
      "Two-column workstation: notebook and comparison beside the brief. Touch is the primary input, so every control uses the touch minimum.",
  },
  {
    id: "desktop",
    minWidthPx: 1200,
    label: "Desktop",
    purpose:
      "Full workstation layout: viewport, controls, notebook, and comparison visible together. Pointer and keyboard are primary; the layout must still reflow to 200% zoom.",
  },
];

/** Interactive hit-area minimum, in CSS pixels. Mirrors `--ps-touch-min`. */
export const TOUCH_TARGET_MIN_PX = 44;

export interface ContrastRequirement {
  readonly foreground: string;
  readonly background: string;
  /** WCAG 2.1 minimum: 4.5 for text, 3.0 for non-text UI and focus indicators. */
  readonly minimum: number;
  readonly appliesTo: "text" | "non-text";
  readonly note: string;
}

/**
 * The contrast pairs this product actually ships.
 *
 * A palette can pass a linter and fail a learner, so the requirement is stated per
 * *pair in use* rather than per colour: what matters is that this text sits on that
 * surface. `scripts/check-design-system.mjs` computes the real WCAG ratio for each
 * row and fails the build below the minimum.
 */
export const CONTRAST_REQUIREMENTS: readonly ContrastRequirement[] = [
  {
    foreground: "--ps-text",
    background: "--ps-surface-0",
    minimum: 4.5,
    appliesTo: "text",
    note: "Primary text on the deepest surface.",
  },
  {
    foreground: "--ps-text",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Primary text on a panel: body copy and measured values.",
  },
  {
    foreground: "--ps-text",
    background: "--ps-surface-2",
    minimum: 4.5,
    appliesTo: "text",
    note: "Text inside a raised control.",
  },
  {
    foreground: "--ps-text-muted",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Labels and units on a panel. Units are required reading, so they are held to the text minimum.",
  },
  {
    foreground: "--ps-text-subtle",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Metadata on a panel: observation ids, timestamps, source tags.",
  },
  {
    foreground: "--ps-accent",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Accent-coloured text, such as a selected target's name.",
  },
  {
    foreground: "--ps-instrument",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Instrument readings printed on a panel.",
  },
  {
    foreground: "--ps-evidence",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Captured-evidence text in the notebook.",
  },
  {
    foreground: "--ps-caution",
    background: "--ps-surface-1",
    minimum: 4.5,
    appliesTo: "text",
    note: "Contested/unreviewed notices, which a learner must be able to read.",
  },
  {
    foreground: "--ps-focus-ring",
    background: "--ps-surface-1",
    minimum: 3,
    appliesTo: "non-text",
    note: "Focus indicator on a panel.",
  },
  {
    foreground: "--ps-focus-ring",
    background: "--ps-surface-2",
    minimum: 3,
    appliesTo: "non-text",
    note: "Focus indicator on a raised control, which is the hardest case.",
  },
  {
    foreground: "--ps-border-strong",
    background: "--ps-surface-1",
    minimum: 3,
    appliesTo: "non-text",
    note: "Boundary of a focusable control on a panel, where the outline itself is the affordance.",
  },
  {
    foreground: "--ps-border-strong",
    background: "--ps-surface-2",
    minimum: 3,
    appliesTo: "non-text",
    note:
      "The same boundary on a raised surface, which is the worst case for this token and the one that sets its value.",
  },
];
