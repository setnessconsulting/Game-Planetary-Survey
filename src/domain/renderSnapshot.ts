/**
 * The renderer-facing projection.
 *
 * `RenderSnapshot` is produced by a PURE DOMAIN FUNCTION so the renderer cannot
 * invent truth (docs/TECHNICAL_DESIGN.md §4.3b). It is one of the only three
 * channels between the layers, and it is deliberately starved of scientific
 * values.
 *
 * GUARANTEE: a `RenderSnapshot` contains no measurement, no attribute value, and
 * no learner-visible number other than presentation pacing and scale. The
 * renderer draws; the domain decides what is true. This guarantee is tested in
 * tests/domain/renderSnapshot.test.ts, including a check that no sourced value
 * leaks into the projection.
 */

import { ATTRIBUTES, type AttributeId } from "./attributes";
import type { BodyId, BodyRecord } from "./bodies";
import type { InstrumentId } from "./measurement";
import type { MissionPhase, MissionSnapshot } from "./mission";
import {
  applyPresentationDeclaration,
  findDeclaration,
  type PresentationScaleDeclaration,
} from "./presentation";

/**
 * How the camera/scene should frame things.
 *
 * `comparativeNonLiteral` is the system comparison view: deliberately NOT to
 * literal scale, because eyeballing an empty true-scale solar system teaches
 * less than a labelled comparison. The non-literality must be stated to the
 * learner (docs/RENDERING_QUALITY_STRATEGY.md §2, docs/SCIENCE_MODEL.md §7.1).
 */
export type ScaleMode = "comparativeNonLiteral" | "bodyRelative";

/**
 * Curated camera preset for the planetary navigation pipeline
 * (docs/RENDERING_QUALITY_STRATEGY.md §2). Presentation only — never a value.
 */
export type CameraMode = "systemComparison" | "approach" | "orbit" | "inspection";

export interface RenderPresentation {
  readonly mode: "reference" | "body" | "systemComparison";
  readonly scaleMode: ScaleMode;
  /**
   * Presentation-only scale factor. It scales the drawing, never a displayed
   * value: an authoritative value is rendered from `SourcedValue` text, not from
   * the mesh.
   */
  readonly scaleFactor: number;
  /** Always shown when the scale is not literal. */
  readonly scaleNotice: string;
  /** SIM id when a declaration licensed this view; otherwise null. */
  readonly declarationId: string | null;
  readonly cameraMode: CameraMode;
}

export interface RenderSnapshot {
  readonly bodyId: BodyId | null;
  readonly displayName: string | null;
  readonly presentation: RenderPresentation;
  readonly instrumentId: InstrumentId | null;
  readonly bodyAvailableAttributes: readonly AttributeId[];
  readonly observationActive: boolean;
  /** 0..1 approach animation progress. Presentation pacing only. */
  readonly approachProgress: number;
  /** Phase name, for choosing a view preset. Carries no scientific value. */
  readonly phase: MissionPhase;
}

const SYSTEM_COMPARISON_REPRESENTATION = "system-comparison";

const COMPARATIVE_FALLBACK_NOTICE =
  "This comparison view is not drawn to literal scale. The numbers in the notebook are the measurements.";

const REFERENCE_NOTICE =
  "Reference view: no mission body is loaded, so nothing here is a measurement.";

const BODY_RELATIVE_NOTICE =
  "Survey view: the world is drawn at a body-relative presentation scale. The numbers in the notebook are the measurements.";

/** Monotonic approach pacing per phase. Choreography, never information. */
const APPROACH_PROGRESS: Readonly<Record<MissionPhase, number>> = {
  unloaded: 0,
  briefing: 0,
  targetSelection: 0.15,
  instrumentSelection: 0.45,
  observing: 0.75,
  evidenceCapture: 0.85,
  comparison: 0.6,
  claimDrafting: 0.6,
  claimSubmitted: 0.8,
  debrief: 0.8,
  complete: 1,
};

/** Phases that use the non-literal system comparison view when a declaration exists. */
const SYSTEM_COMPARISON_PHASES: ReadonlySet<MissionPhase> = new Set([
  "briefing",
  "targetSelection",
  "comparison",
]);

function cameraModeFor(
  scaleMode: ScaleMode,
  approachProgress: number,
  phase: MissionPhase,
): CameraMode {
  if (scaleMode === "comparativeNonLiteral") {
    return "systemComparison";
  }
  if (phase === "observing" || phase === "evidenceCapture" || approachProgress >= 0.75) {
    return "inspection";
  }
  if (approachProgress >= 0.4) {
    return "orbit";
  }
  return "approach";
}

/**
 * Project the mission state into renderer-facing data.
 *
 * Pure and total: it never throws, and an unknown body id degrades to the honest
 * reference presentation rather than a fabricated body.
 *
 * Declarations are passed in rather than imported from content so the domain
 * stays a pure leaf (docs/TECHNICAL_DESIGN.md §2).
 */
export function projectRenderSnapshot(
  snapshot: MissionSnapshot,
  bodies: readonly BodyRecord[],
  declarations: readonly PresentationScaleDeclaration[] = [],
): RenderSnapshot {
  const approachProgress = APPROACH_PROGRESS[snapshot.phase];
  const body = snapshot.selectedBodyId
    ? bodies.find((candidate) => candidate.id === snapshot.selectedBodyId)
    : undefined;

  if (!body) {
    const useSystemComparison = SYSTEM_COMPARISON_PHASES.has(snapshot.phase);
    if (useSystemComparison) {
      const applied = applyPresentationDeclaration(
        findDeclaration(declarations, SYSTEM_COMPARISON_REPRESENTATION),
        { scaleFactor: 0.0001, scaleNotice: COMPARATIVE_FALLBACK_NOTICE },
      );
      return {
        bodyId: null,
        displayName: null,
        presentation: {
          mode: "systemComparison",
          scaleMode: "comparativeNonLiteral",
          scaleFactor: applied.scaleFactor,
          scaleNotice: applied.scaleNotice,
          declarationId: applied.declarationId,
          cameraMode: "systemComparison",
        },
        instrumentId: snapshot.selectedInstrumentId,
        bodyAvailableAttributes: [],
        observationActive: false,
        approachProgress,
        phase: snapshot.phase,
      };
    }

    return {
      bodyId: null,
      displayName: null,
      presentation: {
        mode: "reference",
        scaleMode: "bodyRelative",
        scaleFactor: 1,
        scaleNotice: REFERENCE_NOTICE,
        declarationId: null,
        cameraMode: "orbit",
      },
      instrumentId: snapshot.selectedInstrumentId,
      bodyAvailableAttributes: [],
      observationActive: false,
      approachProgress,
      phase: snapshot.phase,
    };
  }

  const useComparative =
    SYSTEM_COMPARISON_PHASES.has(snapshot.phase) && snapshot.phase === "comparison";
  if (useComparative) {
    const applied = applyPresentationDeclaration(
      findDeclaration(declarations, SYSTEM_COMPARISON_REPRESENTATION),
      { scaleFactor: 0.0001, scaleNotice: COMPARATIVE_FALLBACK_NOTICE },
    );
    return {
      bodyId: body.id,
      displayName: body.displayName,
      presentation: {
        mode: "systemComparison",
        scaleMode: "comparativeNonLiteral",
        scaleFactor: applied.scaleFactor,
        scaleNotice: applied.scaleNotice,
        declarationId: applied.declarationId,
        cameraMode: "systemComparison",
      },
      instrumentId: snapshot.selectedInstrumentId,
      bodyAvailableAttributes: availableAttributes(body),
      observationActive: false,
      approachProgress,
      phase: snapshot.phase,
    };
  }

  const scaleMode: ScaleMode = "bodyRelative";
  return {
    bodyId: body.id,
    displayName: body.displayName,
    presentation: {
      mode: "body",
      scaleMode,
      scaleFactor: 1,
      scaleNotice: BODY_RELATIVE_NOTICE,
      declarationId: null,
      cameraMode: cameraModeFor(scaleMode, approachProgress, snapshot.phase),
    },
    instrumentId: snapshot.selectedInstrumentId,
    // Attribute *ids* only: the renderer may show that an atmosphere measurement
    // is possible, but never the value behind it.
    bodyAvailableAttributes: availableAttributes(body),
    observationActive: snapshot.phase === "observing",
    approachProgress,
    phase: snapshot.phase,
  };
}

function availableAttributes(body: BodyRecord): readonly AttributeId[] {
  return (Object.keys(ATTRIBUTES) as AttributeId[]).filter(
    (attributeId) => body.attributes[attributeId] !== undefined,
  );
}

/**
 * Serialization used by tests and diagnostics to prove the projection carries no
 * scientific values.
 */
export function renderSnapshotKeys(snapshot: RenderSnapshot): readonly string[] {
  return Object.keys(snapshot).sort();
}
