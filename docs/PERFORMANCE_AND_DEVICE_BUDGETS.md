# Planetary Survey — Performance and Device Budgets

Status: binding PS-01 budget contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

These are **release gates, not aspirations**. PS-02 establishes the measurement
harness; PS-12 consolidates exact-candidate evidence; PS-14 reviews against this
document.

"Fast" and "performant" are not acceptance criteria. Every line below is
measurable.

---

## 1. Assumptions and evidence status

These budgets were proposed at PS-01 from:

- the sibling standalone-game precedent (`game-weather-command`, a 2D SVG game
  with a 350 KiB initial-transfer budget) — used as a **lower bound reference
  only**, since Planetary Survey ships a 3D engine and therefore cannot inherit
  that number;
- the decision to make the React shell interactive **before** the renderer loads
  (`TECHNICAL_DESIGN.md` §8), which is what keeps shell-load budgets small;
- a 3D engine payload expectation calibrated by the requirement that Babylon
  loads as a **lazy chunk**, not part of the eager shell;
- the target learner context, which includes school-managed devices.

**Status of these numbers:** initial, deliberately conservative, and expected to
be *measured* by PS-02 and *tightened* by PS-12. A budget may only be relaxed by
an explicit Jira decision that records the measured evidence and the reason.
Tightening needs no special approval.

Assumptions that must be re-checked by PS-02 and are not silently inherited:

1. The React shell can reach interactive state without importing Babylon.
2. Babylon's required subset can be bundled into a lazy chunk within its budget.
3. glTF/GLB + KTX2 assets stay within the per-mission payload budget at the
   authored quality bar.

## 2. Reference environments

### 2.1 Reference desktop / laptop (primary qualification target)

- 4+ physical cores, 8 GB RAM minimum;
- integrated GPU of recent generation, or entry discrete GPU;
- 1920 × 1080 CSS px viewport;
- current stable Chromium and Firefox; current Safari/WebKit;
- Node.js 24.x for the local/CI toolchain.

### 2.2 Lower-capability supported device (must remain playable)

Chosen to represent school deployment reality:

- Chromebook-class or low-end laptop: 2–4 threads, 4 GB RAM;
- integrated GPU (low-end Intel/AMD/Mali class);
- 1366 × 768 CSS px viewport (and down to 1024 px width);
- current stable Chromium.

**This class is a supported target, not a degraded afterthought.** A learner on
this device must be able to complete every mission on the `reduced` tier.

### 2.3 Responsive qualification viewports

- 1024 × 768 (small laptop / tablet landscape);
- 1366 × 768 (Chromebook-class);
- 1440 × 900 (desktop-class);
- 1920 × 1080 (reference desktop);
- 360 × 640 and 390 × 844 (phone-class, for the semantic UI and accessible
  evidence path — the 3D viewport may be reduced or replaced here, but the
  evidence path must still work).

At least one **real or representative device/browser** check is required at
PS-14. Headless/software rendering alone is insufficient for visual or
performance sign-off.

## 3. Load budgets

Measured on a production build served warm from the same origin, no throttling
unless stated.

### 3.1 Shell (before renderer)

| Metric | Reference desktop | Lower-capability |
|---|---:|---:|
| Time to first meaningful paint | ≤ 1.5 s | ≤ 3.0 s |
| Time to interactive shell (React shell usable, no 3D) | ≤ 2.0 s | ≤ 4.0 s |
| Initial **eager** JS transfer (gzip) | ≤ 250 KiB | ≤ 250 KiB |
| Initial critical HTML + CSS transfer (gzip) | ≤ 60 KiB | ≤ 60 KiB |

The shell must be usable — briefing readable, keyboard navigable, accessible
evidence reachable — **without the renderer chunk loaded**.

### 3.2 Renderer chunk

| Metric | Budget |
|---|---:|
| Babylon renderer chunk (gzip, lazy) | ≤ 1.2 MiB |
| Additional lazy renderer sub-chunks per feature (gzip each) | ≤ 300 KiB |

The renderer chunk must not be part of the initial eager bundle.

### 3.3 Mission assets

| Metric | Budget (compressed transfer) |
|---|---:|
| First mission interactive asset payload (probe + first body + scope) | ≤ 6 MiB |
| Incremental per-body asset load | ≤ 4 MiB |
| Incremental per-mission asset load | ≤ 4 MiB |
| Total shipping asset payload for v1 (all bodies + all missions) | ≤ 60 MiB |

High visual quality must not require fetching the entire production asset set
before the first mission is interactive.

### 3.4 First mission interactive

| Metric | Reference desktop | Lower-capability |
|---|---:|---:|
| Time to first mission interactive (shell + renderer + first mission assets, warm cache) | ≤ 8 s | ≤ 15 s |
| Time to first mission interactive (cold cache, no throttling) | ≤ 12 s | ≤ 25 s |

## 4. Frame timing and pacing budgets

### 4.1 Reference desktop (tiers `high` and `standard`)

| Metric | Budget |
|---|---|
| Steady-state frame time, median | ≤ 16.7 ms (60 fps target) |
| Steady-state frame time, p95 | ≤ 25 ms |
| Sustained long tasks (> 50 ms) during interaction | 0 |
| Long tasks (> 50 ms) over a 60 s representative session | ≤ 5 |
| Frame pacing: frames exceeding 2× median frame time over a 30 s window | ≤ 1% |

### 4.2 Lower-capability device (tier `reduced`)

| Metric | Budget |
|---|---|
| Steady-state frame time, median | ≤ 33 ms (30 fps floor) |
| Steady-state frame time, p95 | ≤ 50 ms |
| Sustained long tasks during interaction | 0 |
| Interaction must remain responsive even if frame rate dips | required |

A lower frame rate on a lower-capability device is acceptable. An unresponsive
or unusable interface is not.

### 4.3 Transition budgets

- Camera mode transition (system → approach → orbit → inspection): must complete
  within ≤ 1200 ms of presentation time and must be skippable.
- Reduced-motion path performs no unnecessary interpolation loop at all — it
  arrives at the same end state without the tween.

## 5. Interaction and domain-compute budgets

| Operation | Budget |
|---|---|
| Semantic control response visible feedback | ≤ 100 ms |
| Domain measurement computation (pure function) | ≤ 16 ms median, ≤ 50 ms p95 |
| Measurement result displayed after action | ≤ 250 ms |
| Evidence capture reflected in notebook | ≤ 100 ms |
| Comparison board update | ≤ 100 ms |
| Claim evaluation | ≤ 50 ms p95 |
| Quality-tier switch applied | ≤ 1 s, without losing mission state |

The science computation must never be the reason an interaction feels slow; at
this scale, presentation and I/O dominate.

## 6. Memory budgets (proxies)

These are **proxy** budgets: measurable on the reference set, but not a portable
GPU accounting model.

| Metric | Budget |
|---|---:|
| GPU texture memory, tier `high`, reference desktop | ≤ 256 MiB |
| GPU texture memory, tier `standard` | ≤ 128 MiB |
| GPU texture memory, tier `reduced` | ≤ 64 MiB |
| JS heap steady state, reference desktop | ≤ 256 MiB |
| JS heap steady state, lower-capability | ≤ 160 MiB |
| Retained heap growth after mission teardown (10-minute session) | ≤ 10% of steady state |

Lifecycle requirements:

- no unbounded trace/history accumulation;
- replay/evidence histories bounded by mission requirements;
- GPU resources disposed on scene teardown;
- audio nodes and listeners disposed;
- animation loops cancelled on unmount;
- no interval/timer continues after mission teardown.

## 7. Bundle discipline

- Do not add an umbrella library for one helper.
- No duplicate copies of React or of Babylon packages.
- All `@babylonjs/*` packages pinned to the same version
  (`TECHNOLOGY_DECISIONS.md` §9).
- No production dependency used only for development convenience.
- Zod (if used) must not enter the eager bundle
  (`TECHNOLOGY_DECISIONS.md` §5).
- Every new runtime dependency must justify its bytes. "It is convenient" is not
  justification.
- PS-02 must add a repeatable, committed bundle-size report; PS-12 must include it
  in exact-candidate evidence.

## 8. Static-host budget

The build must work beneath the nested versioned base path:

```text
/game-assets/planetary-survey/<version>/
```

Requirements:

- no root-relative asset assumption that bypasses the version base;
- all hashed assets cache safely as immutable;
- direct entry load succeeds (deep-link into the built artifact, not only via the
  outer shell);
- a missing asset produces bounded error behaviour rather than an endless
  spinner;
- the app works when served from a subdirectory, matching the games-site preview
  contract.

## 9. Console and network budget

On a qualified mission path:

- zero uncaught exceptions;
- zero unhandled promise rejections;
- zero unexpected console errors;
- zero unexpected third-party network requests;
- zero mixed-content or CSP violations;
- zero runtime calls to analytics, advertising, telemetry, remote storage, or
  LLM endpoints.

A clean console is a release gate (`RELEASE_CONTRACT.md`).

## 10. Accessibility-performance rule

Performance optimization may **not** remove semantic equivalents, focus
behaviour, accessible data tables, or any evidence route needed to solve the
game.

If an optimization creates a conflict with an accessibility requirement, the
accessibility requirement wins unless the owner explicitly changes scope. This is
recorded as a rule because the conflict is predictable in a 3D game.

## 11. Evidence required

PS-12 records, against the exact candidate SHA:

- bundle/chunk size report (raw and compressed);
- asset payload inventory;
- load-timing measurements on the reference environments;
- frame-time / pacing measurements from a **real GPU or representative device**
  in addition to any headless run;
- memory proxy readings;
- console/network assertions;
- the renderer backend and quality tier under which each measurement was taken;
- explicit statement of any budget not met, with the reason and follow-up issue.

## 12. Budget-change policy

- Tightening a budget: allowed at any time with recorded evidence.
- Relaxing a budget: requires an explicit Jira decision recording the measured
  value, the attempted optimizations, and the owner rationale.
- A budget met by disabling a required accessible path is **not** met.
