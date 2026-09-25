/**
 * The application shell.
 *
 * React owns: briefing, mission controls, the evidence notebook, the comparison
 * surface, accessible semantics, results/debrief, and application navigation.
 * Babylon owns the scene, camera, and frame loop. The only channel between them is
 * typed snapshots, intents, and events (docs/TECHNICAL_DESIGN.md §4).
 *
 * PS-06 wires instrument selection, measurement, and evidence capture on the
 * PS-05 shell. Independent science review remains outstanding and is disclosed,
 * not upgraded into "reviewed".
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  QUALITY_PROFILE_IDS,
  qualityProfile,
  resolveQualityProfile,
  type QualityProfileId,
} from "@/assets/qualityProfiles";
import { createAudioService, type AudioService } from "@/audio";
import {
  MISSIONS,
  PLANETARY_BODIES,
  PRESENTATION_DECLARATIONS,
  GUIDED_MISSION_ID,
  DISTANCE_MISSION_ID,
  RELIEF_MISSION_ID,
  VARIANT_MISSION_ID,
  catalogueIsPopulated,
  catalogueIsScienceReviewed,
  findMission,
} from "@/content";
import { projectRenderSnapshot } from "@/domain/renderSnapshot";
import {
  offeredAttributesFor,
  offeredInstrumentsFor,
  type InstrumentId,
} from "@/domain/measurement";
import type { AttributeId } from "@/domain/attributes";
import {
  createBrowserProbe,
  detectCapabilities,
  webgpuIsConfirmed,
  type CapabilityReport,
  type RendererBackend,
} from "@/platform/capabilities";

import {
  observeVisibility,
  prefersReducedMotion,
  readDeviceSignals,
  type DeviceSignals,
} from "@/platform/environment";
import type { RendererEvent } from "@/renderer";

import { BriefingPanel } from "./BriefingPanel";
import { EvidenceNotebook } from "./EvidenceNotebook";
import { InstrumentSelection } from "./InstrumentSelection";
import { LoopChecklist } from "./LoopChecklist";
import { ObserveMeasure } from "./ObserveMeasure";
import { RendererViewport } from "./RendererViewport";
import { StatusRegion } from "./StatusRegion";
import { TargetSelection } from "./TargetSelection";
import { deriveLoopStatus } from "./loopSteps";
import { useMission } from "./useMission";
import styles from "./App.module.css";

const QUALITY_PREFERENCE_OPTIONS: readonly (QualityProfileId | "auto")[] = [
  "auto",
  ...QUALITY_PROFILE_IDS,
];

const LOADABLE_MISSIONS = [
  GUIDED_MISSION_ID,
  RELIEF_MISSION_ID,
  DISTANCE_MISSION_ID,
  VARIANT_MISSION_ID,
] as const;

export function App() {
  const [capabilities] = useState<CapabilityReport>(() =>
    detectCapabilities(createBrowserProbe()),
  );
  const [backendInUse, setBackendInUse] = useState<RendererBackend | null>(null);
  const [deviceSignals] = useState<DeviceSignals>(() => readDeviceSignals());
  const [qualityPreference, setQualityPreference] = useState<QualityProfileId | "auto">("auto");
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());
  const [muted, setMuted] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Survey workstation ready. Load a mission to begin.",
  );
  const resetCameraRef = useRef<(() => void) | null>(null);

  const audioRef = useRef<AudioService | null>(null);
  if (audioRef.current === null) {
    audioRef.current = createAudioService();
  }
  const audio = audioRef.current;

  const resolvedQuality = useMemo(
    () =>
      resolveQualityProfile({
        preference: qualityPreference,
        deviceMemoryGb: deviceSignals.deviceMemoryGb,
        hardwareConcurrency: deviceSignals.hardwareConcurrency,
        webgpuConfirmed: webgpuIsConfirmed(backendInUse),
      }),
    [qualityPreference, deviceSignals, backendInUse],
  );

  const mission = useMission({ bodies: PLANETARY_BODIES });
  const { snapshot, message, dispatch } = mission;

  const renderSnapshot = useMemo(
    () => projectRenderSnapshot(snapshot, PLANETARY_BODIES, PRESENTATION_DECLARATIONS),
    [snapshot],
  );
  const loopStatus = useMemo(() => deriveLoopStatus(snapshot), [snapshot]);
  const populated = catalogueIsPopulated();
  const scienceReviewed = catalogueIsScienceReviewed();
  const activeMission = snapshot.missionId ? findMission(snapshot.missionId) : undefined;
  const selectableBodies = useMemo(() => {
    if (!activeMission) return PLANETARY_BODIES;
    const allowed = new Set(activeMission.targetBodyIds);
    return PLANETARY_BODIES.filter((body) => allowed.has(body.id));
  }, [activeMission]);

  const selectedBody = useMemo(
    () => PLANETARY_BODIES.find((body) => body.id === snapshot.selectedBodyId) ?? null,
    [snapshot.selectedBodyId],
  );

  const offeredInstruments = useMemo(() => {
    if (!activeMission || !selectedBody) return [];
    return offeredInstrumentsFor(activeMission.requiredObservations, selectedBody);
  }, [activeMission, selectedBody]);

  const offeredAttributes = useMemo((): readonly AttributeId[] => {
    if (!activeMission || !selectedBody || !snapshot.selectedInstrumentId) return [];
    return offeredAttributesFor(
      activeMission.requiredObservations,
      selectedBody,
      snapshot.selectedInstrumentId,
    );
  }, [activeMission, selectedBody, snapshot.selectedInstrumentId]);

  const targetSelectionEnabled =
    snapshot.phase === "briefing" ||
    snapshot.phase === "targetSelection" ||
    snapshot.phase === "instrumentSelection" ||
    snapshot.phase === "observing" ||
    snapshot.phase === "evidenceCapture" ||
    snapshot.phase === "comparison";

  const instrumentSelectionEnabled =
    snapshot.missionId !== null &&
    snapshot.selectedBodyId !== null &&
    (snapshot.phase === "targetSelection" ||
      snapshot.phase === "instrumentSelection" ||
      snapshot.phase === "observing" ||
      snapshot.phase === "comparison" ||
      snapshot.phase === "claimDrafting");

  const measureEnabled =
    snapshot.selectedBodyId !== null &&
    snapshot.selectedInstrumentId !== null &&
    (snapshot.phase === "instrumentSelection" ||
      snapshot.phase === "observing" ||
      snapshot.phase === "comparison" ||
      snapshot.phase === "claimDrafting");

  const captureEnabled =
    snapshot.lastMeasurement?.kind === "measured" &&
    (snapshot.phase === "observing" || snapshot.phase === "evidenceCapture");

  useEffect(() => {
    setAnnouncement(message);
  }, [message]);

  useEffect(() => {
    return observeVisibility((hidden) => {
      if (hidden) audio.suspend();
      else audio.resume();
    });
  }, [audio]);

  useEffect(() => {
    return () => audio.dispose();
  }, [audio]);

  const handleRendererEvent = (event: RendererEvent): void => {
    switch (event.kind) {
      case "ready":
        setBackendInUse(event.backend);
        setAnnouncement(`3D survey view running on ${event.backend.toUpperCase()}.`);
        return;
      case "sceneReady":
        // Do not clobber a more specific degraded/fallback explanation (for
        // example the WebGPU-unusable → WebGL2 note the smoke suite asserts).
        return;
      case "targetApproached":
        setAnnouncement(`Camera set to ${event.cameraMode} framing.`);
        return;
      case "degraded":
        setAnnouncement((current) => {
          // Prefer keeping a backend-fallback explanation over later asset notes.
          if (/webgpu/i.test(current) && !/webgpu/i.test(event.reason)) {
            return current;
          }
          return event.reason;
        });
        return;
      case "failed":
        setBackendInUse("unavailable");
        setAnnouncement(event.reason);
        return;
      default: {
        const unreachable: never = event;
        throw new Error(`Unhandled renderer event: ${JSON.stringify(unreachable)}`);
      }
    }
  };

  const toggleMute = (): void => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    if (!next) {
      void audio.unlock();
    }
    setAnnouncement(
      next
        ? "Sound muted."
        : "Sound unmuted. No audio cues are authored yet — this control exercises the audio seam.",
    );
  };

  const loadMission = (missionId: string): void => {
    const definition = findMission(missionId);
    dispatch({
      kind: "loadMission",
      missionId,
      seed: definition?.seedBase ?? 0,
    });
  };

  return (
    <>
      <a className="ps-skip-link" href="#main" tabIndex={0}>
        Skip to the survey workstation
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Junior planetary scientist · survey probe workstation</p>
          <h1>Planetary Survey</h1>
          <p className={styles.lede}>
            Measure worlds, keep the evidence, compare them, and make a claim the data can
            back up. This is a survey, not a fact quiz.
          </p>
          <p className={styles.foundationNote} data-testid="foundation-note">
            Renderer foundation build (PS-05) with instrument and evidence capture
            (PS-06). Planetary values are cited in the per-field source register.
            Independent science review is still outstanding, so content is shown as
            unreviewed rather than presented as settled. Final visual quality is not
            claimed.
          </p>
        </div>
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        <StatusRegion message={announcement} />

        <div className={styles.grid}>
          <div className={styles.column}>
            <section aria-labelledby="controls-heading" data-testid="controls">
              <h2 id="controls-heading">Workstation controls</h2>
              <div className={styles.controls}>
                <div className={styles.control}>
                  <label htmlFor="quality-preference">Presentation quality</label>
                  <select
                    id="quality-preference"
                    value={qualityPreference}
                    onChange={(event) => {
                      const value = event.target.value;
                      setQualityPreference(
                        value === "auto" ? "auto" : (value as QualityProfileId),
                      );
                    }}
                  >
                    {QUALITY_PREFERENCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "auto"
                          ? `Auto (${resolvedQuality})`
                          : qualityProfile(option).label}
                      </option>
                    ))}
                  </select>
                  <p className={styles.hint}>{qualityProfile(resolvedQuality).description}</p>
                </div>

                <div className={styles.control}>
                  <label htmlFor="reduced-motion">
                    <input
                      id="reduced-motion"
                      type="checkbox"
                      checked={reducedMotion}
                      onChange={(event) => setReducedMotion(event.target.checked)}
                    />{" "}
                    Reduce motion
                  </label>
                </div>

                <div className={styles.control}>
                  <button type="button" onClick={toggleMute} aria-pressed={muted}>
                    {muted ? "Unmute sound" : "Mute sound"}
                  </button>
                </div>
              </div>

              <p className={styles.hint} data-testid="content-status">
                {!populated
                  ? "Catalogue empty."
                  : `${PLANETARY_BODIES.length} worlds and ${MISSIONS.length} missions are authored, every value cited in the source register. ` +
                    (scienceReviewed
                      ? "Independent science review is complete."
                      : "Independent science review is outstanding.")}
              </p>

              <div className={styles.actions}>
                {LOADABLE_MISSIONS.map((missionId) => {
                  const definition = findMission(missionId);
                  return (
                    <button
                      key={missionId}
                      type="button"
                      data-testid={`load-mission-${missionId}`}
                      onClick={() => loadMission(missionId)}
                      disabled={snapshot.missionId !== null}
                    >
                      {definition ? `Open: ${definition.title}` : missionId}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => dispatch({ kind: "beginBriefing" })}
                  disabled={snapshot.phase !== "briefing" && snapshot.phase !== "unloaded"}
                >
                  Continue to target selection
                </button>
                <button
                  type="button"
                  data-testid="reset-mission"
                  onClick={() => dispatch({ kind: "reset" })}
                >
                  Reset mission
                </button>
              </div>
            </section>

            <BriefingPanel missionId={snapshot.missionId} scienceReviewed={scienceReviewed} />
            <TargetSelection
              bodies={selectableBodies}
              selectedBodyId={snapshot.selectedBodyId}
              enabled={targetSelectionEnabled && snapshot.missionId !== null}
              onSelect={(bodyId) => dispatch({ kind: "selectTarget", bodyId })}
            />
            <InstrumentSelection
              instruments={offeredInstruments}
              selectedInstrumentId={snapshot.selectedInstrumentId}
              enabled={instrumentSelectionEnabled}
              onSelect={(instrumentId: InstrumentId) =>
                dispatch({ kind: "selectInstrument", instrumentId })
              }
            />
            <ObserveMeasure
              attributeIds={offeredAttributes}
              lastMeasurement={snapshot.lastMeasurement}
              measureEnabled={measureEnabled}
              captureEnabled={captureEnabled}
              onMeasure={(attributeId) => dispatch({ kind: "measure", attributeId })}
              onCapture={() => dispatch({ kind: "captureEvidence" })}
            />
            <LoopChecklist steps={loopStatus} />
            <EvidenceNotebook records={snapshot.evidence} bodies={PLANETARY_BODIES} />
          </div>

          <div className={styles.column}>
            <RendererViewport
              capabilities={capabilities}
              quality={resolvedQuality}
              reducedMotion={reducedMotion}
              snapshot={renderSnapshot}
              onEvent={handleRendererEvent}
              onControllerReady={(controller) => {
                resetCameraRef.current = () => controller.resetCamera();
              }}
            />

            <div className={styles.actions}>
              <button
                type="button"
                data-testid="reset-camera"
                onClick={() => {
                  resetCameraRef.current?.();
                  setAnnouncement("Camera reset to the current survey framing.");
                }}
              >
                Reset camera
              </button>
            </div>

            <section aria-labelledby="diag-heading" data-testid="diagnostics">
              <h2 id="diag-heading">System check</h2>
              <dl className={styles.diagnostics}>
                <dt>Renderer backend in use</dt>
                <dd data-testid="diag-backend">{backendInUse ?? "not started"}</dd>
                <dt>Renderer backend requested</dt>
                <dd data-testid="diag-backend-requested">{capabilities.backend}</dd>
                <dt>WebGL2 (required baseline)</dt>
                <dd>{capabilities.webgl2 ? "available" : "not available"}</dd>
                <dt>WebGPU (enhancement)</dt>
                <dd data-testid="diag-webgpu">
                  {capabilities.webgpu
                    ? backendInUse === "webgpu"
                      ? "available and in use"
                      : "API present, but no usable adapter confirmed"
                    : "not available"}
                </dd>
                <dt>Resolved quality profile</dt>
                <dd data-testid="diag-quality">{resolvedQuality}</dd>
                <dt>Camera mode</dt>
                <dd data-testid="diag-camera">{renderSnapshot.presentation.cameraMode}</dd>
                <dt>Scale mode</dt>
                <dd data-testid="diag-scale">{renderSnapshot.presentation.scaleMode}</dd>
                <dt>Device signals</dt>
                <dd>
                  {deviceSignals.hardwareConcurrency ?? "unknown"} threads ·{" "}
                  {deviceSignals.deviceMemoryGb ?? "unknown"} GiB reported memory
                </dd>
              </dl>
              <p className={styles.hint}>
                Gameplay, measurements, evidence, and claims are identical on WebGL2 and
                WebGPU, and at every quality tier. Only presentation cost changes.
              </p>
            </section>

            <section aria-labelledby="accessible-evidence-heading">
              <h2 id="accessible-evidence-heading">Evidence without the 3D view</h2>
              <p>
                The survey view is an enhancement. Every measurement, comparison, and claim
                is available as text and as a real data table, so a learner can complete the
                science objective with a keyboard, with a screen reader, or with the
                renderer switched off entirely.
              </p>
            </section>
          </div>
        </div>

        <footer className={styles.footer}>
          <p>
            Contract: <code>docs/PRD.md</code>, <code>docs/SCIENCE_MODEL.md</code>,{" "}
            <code>docs/TECHNICAL_DESIGN.md</code>, <code>docs/ACCESSIBILITY.md</code>,{" "}
            <code>docs/PERFORMANCE_AND_DEVICE_BUDGETS.md</code>.
          </p>
        </footer>
      </main>
    </>
  );
}
