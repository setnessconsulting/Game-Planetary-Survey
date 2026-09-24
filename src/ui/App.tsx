/**
 * The application shell.
 *
 * React owns: briefing, mission controls, the evidence notebook, the comparison
 * surface, accessible semantics, results/debrief, and application navigation.
 * Babylon owns the scene, camera, and frame loop. The only channel between them is
 * typed snapshots, intents, and events (docs/TECHNICAL_DESIGN.md §4).
 *
 * PS-04 authored the catalogue: five worlds and four missions, every displayed
 * value cited in the source register. This shell still does not *load* one —
 * wiring the authored missions into the workstation is a later gate — so what it
 * proves is that the seams, the boundaries, the accessibility routes, and the
 * honest failure paths are real.
 *
 * The shell reports two different things about that content, and the difference is
 * deliberate. `catalogueIsPopulated()` says content exists; it is true.
 * `catalogueIsScienceReviewed()` says a human signed the science off; it is false.
 * Collapsing those into one "ready" flag would let a build that has sourced values
 * look like a build that has reviewed ones.
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
  catalogueIsPopulated,
  catalogueIsScienceReviewed,
} from "@/content";
import { projectRenderSnapshot } from "@/domain/renderSnapshot";
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
import { LoopChecklist } from "./LoopChecklist";
import { RendererViewport } from "./RendererViewport";
import { StatusRegion } from "./StatusRegion";
import { deriveLoopStatus } from "./loopSteps";
import { useMission } from "./useMission";
import styles from "./App.module.css";

const QUALITY_PREFERENCE_OPTIONS: readonly (QualityProfileId | "auto")[] = [
  "auto",
  ...QUALITY_PROFILE_IDS,
];

export function App() {
  const [capabilities] = useState<CapabilityReport>(() =>
    detectCapabilities(createBrowserProbe()),
  );
  //
  // The capability probe can only REQUEST a backend; only the renderer can confirm
  // which one actually runs. This is the single source of truth for "what is the
  // learner's browser really using", and quality selection is gated on it rather
  // than on the probe's optimistic request.
  const [backendInUse, setBackendInUse] = useState<RendererBackend | null>(null);
  const [deviceSignals] = useState<DeviceSignals>(() => readDeviceSignals());
  const [qualityPreference, setQualityPreference] = useState<QualityProfileId | "auto">("auto");
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());
  const [muted, setMuted] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Survey workstation ready. No mission content is loaded yet.",
  );

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
    () => projectRenderSnapshot(snapshot, PLANETARY_BODIES),
    [snapshot],
  );
  const loopStatus = useMemo(() => deriveLoopStatus(snapshot), [snapshot]);
  const populated = catalogueIsPopulated();
  const scienceReviewed = catalogueIsScienceReviewed();

  // Announce domain outcomes; the live region is the single non-visual channel.
  useEffect(() => {
    setAnnouncement(message);
  }, [message]);

  // Audio is a seam: pause when the tab is hidden, resume when it returns. The
  // game works fully with no audio at all (docs/TECHNICAL_DESIGN.md §9).
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
      case "degraded":
        setAnnouncement(event.reason);
        return;
      case "failed":
        // Nothing is rendering, so nothing is "in use" — even though the renderer can
        // say which backend it tried and lost. Reporting the attempted backend here
        // would put a backend name in the System check next to a blank viewport, which
        // is the same class of lie as reporting the probe's request as fact. The
        // attempt itself is named in the explanation the learner is given.
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
      // A user gesture is the only legitimate moment to start audio.
      void audio.unlock();
    }
    setAnnouncement(next ? "Sound muted." : "Sound unmuted. No audio cues are authored yet — this control exercises the audio seam.");
  };

  return (
    <>
      {/*
        `tabindex={0}` is deliberate and load-bearing.

        WebKit excludes plain links from sequential focus navigation, following the
        macOS convention where Tab visits form controls but not links. Without an
        explicit tabindex, a keyboard-only Safari learner pressing Tab skips straight
        past this link to the quality selector — the bypass mechanism (WCAG 2.4.1)
        would simply not exist for them. Verified in a real WebKit run: the link is
        skipped without it and is the first tab stop with it.

        It is `0`, never a positive value: a positive tabindex would reorder focus
        against DOM order. In Chromium and Firefox this matches the link's natural
        focusability, so nothing changes there.
      */}
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
            Source-register build (PS-04). The product, science, architecture,
            accessibility, performance, and release contracts are frozen in <code>docs/</code>,
            and every planetary value is cited in the per-field source register. Independent
            science review of that content is still outstanding, so it is shown as unreviewed
            rather than presented as settled.
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
                        {option === "auto" ? `Auto (${resolvedQuality})` : qualityProfile(option).label}
                      </option>
                    ))}
                  </select>
                  <p className={styles.hint}>
                    {qualityProfile(resolvedQuality).description}
                  </p>
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
                  ? "Catalogue empty: " +
                    PLANETARY_BODIES.length +
                    " bodies, " +
                    MISSIONS.length +
                    " missions. Nothing is measured with an unsourced value."
                  : `${PLANETARY_BODIES.length} worlds and ${MISSIONS.length} missions are authored, every value cited in the source register. ` +
                    (scienceReviewed
                      ? "Independent science review is complete."
                      : "Independent science review is outstanding.")}
              </p>

              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => dispatch({ kind: "loadMission", missionId: "foundation-briefing", seed: 0 })}
                  disabled={snapshot.missionId !== null}
                >
                  Open the foundation briefing
                </button>
                <button type="button" onClick={() => dispatch({ kind: "beginBriefing" })}>
                  Continue to target selection
                </button>
              </div>
              <p className={styles.hint}>
                The foundation briefing contains no scientific content. The authored missions
                are not loadable from this shell yet, so this briefing is what keeps the
                mission loop, the notebook, and the announcement path exercisable in the
                meantime.
              </p>
            </section>

            <BriefingPanel missionId={snapshot.missionId} />
            <LoopChecklist steps={loopStatus} />
            <EvidenceNotebook records={snapshot.evidence} />
          </div>

          <div className={styles.column}>
            <RendererViewport
              capabilities={capabilities}
              quality={resolvedQuality}
              reducedMotion={reducedMotion}
              snapshot={renderSnapshot}
              onEvent={handleRendererEvent}
            />

            <section aria-labelledby="diag-heading" data-testid="diagnostics">
              <h2 id="diag-heading">System check</h2>
              <dl className={styles.diagnostics}>
                {/*
                  "In use" is reported from the renderer, which is the only part of
                  the app that can confirm a usable adapter. "Requested" is the
                  probe's advisory plan. Showing one as the other is how a browser
                  ends up claiming WebGPU while rendering on WebGL2.
                */}
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
                <dt>Device signals</dt>
                <dd>
                  {deviceSignals.hardwareConcurrency ?? "unknown"} threads ·{" "}
                  {deviceSignals.deviceMemoryGb ?? "unknown"} GiB reported memory
                </dd>
              </dl>
              <p className={styles.hint}>
                Gameplay, measurements, evidence, and claims are identical on WebGL2 and
                WebGPU, and at every quality tier. Only presentation cost changes. The
                highest presentation tier is only offered once WebGPU is confirmed in
                use; a browser that merely exposes the WebGPU API still gets the
                WebGL2-baseline tier.
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
