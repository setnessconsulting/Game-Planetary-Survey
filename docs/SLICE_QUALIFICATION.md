# Planetary Survey — Guided-Mission Vertical Slice Qualification

Status: PS-09 (GAME-373) evidence record
Jira: GAME-362 (Epic), GAME-373 (PS-09)
Content register version: `ps-04.0.0`
Owner of everything this document does **not** claim: see §6

---

## 1. What this document is

GAME-373 requires a **guided-mission production vertical slice**: one complete guided
mission, the full loop playable end to end, with science, UX, accessibility,
real-render, and performance evidence attached — as the hard gate before content
expansion. This document is the record of what was measured, against what, and what
is still outstanding.

**It is not a qualification sign-off.** No human has reviewed the visuals, no
target-age learner has played it, and no science reviewer has checked the values.
Those are listed in §6 and they are not automation's to claim
(`ACCEPTANCE_EVIDENCE_MATRIX.md`, "Human evidence").

The slice is `survey-001-sizes` — "Order the rocky worlds by size" — played the way
its brief asks: the Moon, Mars, and Venus each selected, measured with the radius
sounder, captured, compared, claimed, cited, submitted, debriefed, and completed.

## 2. Acceptance → evidence

| GAME-373 requirement | Artefact |
|---|---|
| complete guided mission | `tests/e2e/verticalSlice.spec.ts` — the whole mission in a real browser, live WebGL2 renderer, ending `complete` with the target met |
| full loop playable end to end | `tests/content/missionTrace.test.ts` (renderer-free golden traces through `complete`, plus the revision path) and the same spec with **no 3D backend at all** |
| UX evidence | the same spec's degraded and keyboard-only passes: every step reachable without the renderer and without a pointer; `docs/UX_USER_FLOW.md` step coverage asserted by `tests/design/surfaceInventory.test.ts` |
| accessibility evidence | an axe scan at **every** phase in `verticalSlice.spec.ts`, the cross-engine route in `tests/e2e/accessibility.spec.ts` (chromium, firefox, webkit), and the 320 px / 200 % reflow checks |
| real-render evidence | `verticalSlice.spec.ts` asserts the renderer reaches `ready` on the required WebGL2 baseline and that its frame counter advances across the whole slice; `tests/e2e/smoke.spec.ts` owns the backend-probe matrix |
| performance evidence | `tests/e2e/sliceEvidence.spec.ts` → `reports/ps09-slice-evidence.json`, summarised in §4 |
| hard gate before content expansion | `tests/content/sliceGate.test.ts` — every shipped mission must be playable to a met target along its own authored path, and the slice evidence files must exist |

## 3. The defect the slice found (F-1)

Qualifying the slice found that **the guided mission's authored completion path was
not enforced**. A run that measured and cited only Mars and Venus reported:

```
phase=complete  verdict=supported  targetMet=true
observationsCaptured=2 of 3   citationProblems=[]
```

`src/content/missions.ts` says `claimTarget.requiredEvidence` means "you cannot finish
this without measuring … **enforced rather than intended**"; `catalog.ts` validates
the mapping; but no transition read the field. `evaluateClaim` checks only the two
worlds a claim compares, and `CompletionSummary.targetMet` was simply
`verdict === "supported"`. The guided brief tells the learner they cannot conclude
until all three worlds are measured, and the mission could be completed without the
Moon.

Resolution — recorded as **D-40** in `docs/DECISIONS.md`:

- `requiredEvidenceGaps(mission, claim, records)` reports which of a mission's own
  required observations a claim does not cite;
- `CompletionSummary.targetMet` is `supported` **and** no gaps remain;
- `MissionDebrief.missingRequiredEvidence` names what is missing, in the mission's
  authored order, so the learner is told rather than blocked;
- completion still happens on any evaluated claim (D-35 unchanged), and revision is
  still offered, so the recovery is "go and measure it", not "start again".

Qualifying the slice found a **second, related gap**: the state machine allows
`selectTarget` from `claimDrafting` and `debrief` — the "return to measurement"
recovery of `docs/UX_USER_FLOW.md` step 11 — but the shell disabled target selection
in exactly those phases, so the D-40 recovery path was unreachable through the UI.
The shell now offers what the state machine permits. Both gaps are pinned by tests:
`tests/domain/debrief.test.ts` (domain), `tests/content/missionTrace.test.ts`
(content), `tests/ui/claimLoop.test.tsx` (shell), and the browser spec.

## 4. Measured evidence

Produced by `npm run test:e2e` (or the commands in §7) and written to
`reports/ps09-slice-evidence.json`; the durable per-run copy is
`_evidence/planetary-survey-ps09/slice-evidence.json`. The artefact carries the
`sourceSha` it was measured against — a measurement without a SHA is not evidence —
and **the artefact is authoritative**: the figures below are from the run archived
with this story, and the archived JSON wins if the two ever disagree.

Environment for the run below: headless chromium, 1280×720, backend `webgl2`,
quality tier `standard` (auto-resolved). **Software rasterization through
ANGLE/SwiftShader**, which is CPU work.

### Environment-independent rows — asserted

| Metric | Budget | Measured | Verdict |
|---|---:|---:|---|
| Initial eager JS transfer (gzip) | ≤ 250 KiB | 92.63 KiB | pass |
| Initial critical HTML + CSS transfer (gzip) | ≤ 60 KiB | 3.58 KiB | pass |
| Babylon renderer chunk (gzip, lazy) | ≤ 1228.8 KiB | 564.94 KiB | pass |
| Console errors / page errors / off-origin requests | 0 / 0 / 0 | 0 / 0 / 0 | pass |
| Detectable WCAG A/AA violations on the completed slice | 0 | 0 | pass |

### GPU-dependent rows — recorded, **not** judged here

`PERFORMANCE_AND_DEVICE_BUDGETS.md` §2.3 and §11 require a real GPU or representative
device for frame-time, load-timing, and memory sign-off. Every row below is therefore
recorded with the reason it cannot be judged from this environment.

| Metric | Budget | Measured | Why not judged |
|---|---:|---:|---|
| Steady-state frame time, median | ≤ 16.7 ms | 16.86 ms | software rasterization |
| Steady-state frame time, p95 | ≤ 25 ms | 19.19 ms | software rasterization |
| Long tasks > 50 ms over a 60 s session | ≤ 5 | 1 (longest 118 ms, 36.9 s session) | software rendering; session shorter than the budget window |
| Time to first mission interactive (warm) | ≤ 8 s | 625 ms | harness wall clock, software rendering |
| JS heap steady state | ≤ 256 MiB | 23.4 MiB used | software rasterization |

These are single-run numbers under software rasterization, and they move run to run
(a second run of the same commit measured p95 at 17.30 ms, and in one run 19 of the 20
sampling windows advanced the frame counter). That variance is exactly why the median
frame time is not reported as a pass *or* a failure: an idle three-sphere scene under
SwiftShader is not the reference desktop, and the number that affects release is the
one taken on real hardware. The honest statement is that the slice's frame loop ran
throughout the run, the harness is repeatable, and a GPU-qualified measurement is
outstanding.

One other measurement worth recording: the shell's own control was interactive
436 ms from navigation start, and the renderer had already reached `ready` by then
(§2.1's ordering is a *capability* here rather than a measured win — on this warm
local preview the lazy renderer chunk arrives before the shell's first meaningful
interaction). The architectural claim it protects is proven instead by the degraded
pass: the entire slice completes with no 3D backend at all.

## 5. What the slice proves

- The guided mission can be played from brief to `complete` in a real browser, on the
  required WebGL2 baseline, with the target met and every step reachable by keyboard.
- The same mission completes with **no renderer**, so no required measurement,
  comparison, or claim exists only visually.
- A supported claim that does not meet the mission's target is reported honestly, and
  the learner can recover by measuring the world that was missing — in the browser.
- No console error, no uncaught exception, and no off-origin request occurred across
  any pass (v1 is local-first; `docs/PRIVACY_AND_PERSISTENCE.md`).
- The eager payload, the lazy renderer chunk, and every budget that does not depend on
  the GPU hold.

## 6. Outstanding — and not claimed

| Evidence | Owner | State |
|---|---|---|
| GPU/device-qualified frame time, pacing, and memory | PS-12 (consolidated qualification) | **outstanding** — §4 records software-rendered numbers only |
| Real or representative device check (desktop + Chromebook-class) | PS-12 / PS-14 | **outstanding** |
| Human visual review of the design direction | PS-14 | **outstanding** — no Figma file exists (`STATUS.md` constraint 3), and PS-10's production art is original and machine-generated, so nobody has looked at it and approved it (`ART_DIRECTION.md`) |
| Target-age usability and comprehension playtest | PS-11 / PS-14 | **outstanding** |
| Screen-reader human experience; final accessibility conformance | PS-14 | **outstanding** — axe is coverage, never sign-off (`ACCESSIBILITY.md` §6) |
| Independent science review of the v1 content | GAME-368 / PS-11 | **outstanding** — `catalogueIsScienceReviewed()` returns `false` |
| Production art, PBR/HDR calibration, audio service, no placeholders | PS-10 | **delivered** — see `ART_DIRECTION.md`; the slice now runs on per-body production art, a prefiltered HDR environment, calibrated PBR, a complete audio service, and a populated provenance manifest. **Human visual sign-off remains outstanding (PS-14)** and GPU-qualified visual quality remains outstanding (PS-12) |

**A note on the slice's re-qualification.** The `@slice` suite was re-run in full
against the PS-10 production art in a real browser and passes: the guided mission
still plays brief to complete, still runs keyboard-only, and still completes with no
3D backend at all. PS-10 also re-ran the per-engine suites — chromium 24, firefox
17+1 skip, webkit 17+1 skip, host 3. The slice's *evidence artefact* numbers in §4
predate PS-10 and are not restated here, because a frame-time or memory figure
measured under software rasterisation is not judgeable in either direction and
republishing it would lend it a currency it has not earned. PS-12 measures them on
real hardware.

## 7. Reproducing this evidence

```bash
npm run build && npm run report:bundle        # the bundle the evidence is measured against
npx playwright test --config=playwright.config.ts --grep @slice --workers=1
npm run test:e2e                              # build + bundle report + all engines: the full browser gate
npm run verify                                # static, unit, coverage, architecture, build, manifests
```

`test:e2e` generates `reports/bundle-size.json` before running the browser suites,
because `sliceEvidence.spec.ts` records the exact bundle it measured against: a
measurement whose bundle is missing is not evidence. Running the spec directly
therefore requires `npm run build && npm run report:bundle` first, and the spec fails
with that instruction rather than recording a number it cannot attribute.

`reports/` is gitignored by policy: the artefact is derived from `dist/` plus the run
and asserted in the spec, so committing it would only add churn. The committed
evidence is the spec, this document, and the per-run copy under `_evidence/`.
