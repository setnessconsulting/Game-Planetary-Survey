# Planetary Survey — Technical Design

Status: canonical PS-01 architecture contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

This document is the architecture authority. It fixes **who owns truth**, **who
owns the frame loop**, and **how the layers may talk to each other**. PS-02
through PS-16 may add detail but may not silently invert a boundary defined here.

---

## 1. Architectural principle

Planetary Survey is a **deterministic, source-backed science/domain application
with a game-quality presentation layer**.

```text
domain (pure TypeScript)  owns truth
React                     owns the semantic application shell and UI
Babylon                   owns the 3D scene, camera, and render loop
games-site                owns hosting, outer navigation, and promotion
```

The authoritative value of a measurement is computed in pure TypeScript. The
renderer draws a world; it does not decide how big it is.

## 2. Source organization

Adapt to repository conventions only where an equivalent is genuinely cleaner.
The **boundaries** below are the contract; the directory names are the convention.

```text
src/
  domain/     pure TypeScript: science, units, mission state, evidence,
              claims, deterministic seeds, scoring, debrief facts
  content/    authored bodies/missions/claims as typed modules + schemas
  renderer/   Babylon adapter: engine, scene, camera modes, materials,
              asset loading, rendering instrumentation, quality application
  ui/         React semantic application: briefing, controls, notebook,
              comparison, claims, debrief, navigation, a11y semantics
  audio/      game-owned audio service (Web Audio behind one interface)
  assets/     runtime asset manifests, loaders, quality-profile data
  platform/   capability detection, environment, quality-tier resolution
  styles/     design tokens and global foundations
  testing/    shared deterministic fixtures and test helpers
docs/
scripts/      architecture, privacy, provenance, release-manifest checks
tests/
.github/workflows/
```

### 2.1 Allowed dependency direction

```text
content   -> domain
renderer  -> domain (types + pure projections), assets, platform
ui        -> domain, content, audio, platform, assets (manifest metadata only)
audio     -> platform
assets    -> platform
platform  -> (leaf)
domain    -> NOTHING
```

`domain/` is a **leaf module**. It must not import React, Babylon, DOM APIs,
`content/`, `ui/`, `renderer/`, `audio/`, `assets/`, `platform/`, `styles/`, or
any hosting/games-site code.

Automated checks must enforce §2.1. See §12.

## 3. Domain layer — the science authority

Pure TypeScript. No framework, no DOM, no network, no ambient time, no ambient
randomness.

Owns:

| Responsibility | Notes |
|---|---|
| planetary facts and attributes | shapes only; values come from the source register via `content/` |
| units and normalization | the only place a unit is converted |
| mission state | pure transitions; serializable |
| evidence records | what the learner captured, immutably |
| comparison and claim evaluation | including the anti-guessing rule |
| deterministic seeds/variants | seeded PRNG, never `Math.random` |
| scoring and debrief facts | separate dimensions, never one opaque score |
| render projections | pure functions producing renderer-facing data (see §4.3) |

Contractual properties:

- **Deterministic.** Same inputs + same seed ⇒ identical output, on any renderer,
  any quality tier, any device.
- **Serializable.** All public domain state must round-trip through JSON.
- **Pure.** No I/O inside transitions. Time and randomness are injected.
- **Unit-typed.** A bare `number` may not cross the domain boundary; values cross
  as typed value objects carrying units.
- **No renderer awareness.** The domain has no concept of a scene, camera,
  material, texture, or frame.

## 4. The React / Babylon boundary (the critical contract)

### 4.1 React must not own the 3D frame loop

**React does not represent frame-by-frame Babylon state as React state.**

Prohibited:

- storing per-frame transforms, camera matrices, or animation values in React
  state, context, or refs that trigger re-render;
- a `requestAnimationFrame` loop in a React component driving scene updates;
- re-rendering React on every frame;
- a `useEffect` that steps the simulation each frame.

Required:

- Babylon owns `engine.runRenderLoop` and all per-frame work;
- React mounts and unmounts the viewport, and otherwise communicates by explicit
  typed messages;
- React re-renders only on **semantic** change (mission step, evidence captured,
  claim submitted, preference changed), not on render tick.

### 4.2 Babylon owns / React owns

| Babylon owns | React owns |
|---|---|
| `Engine` / `WebGPUEngine` lifecycle | briefing and mission navigation |
| `Scene`, nodes, meshes, materials | menus and mission controls |
| camera and camera modes | evidence notebook |
| render loop and per-frame transforms | comparison board |
| real-time effects, post-processing, atmosphere | claim entry and citation |
| LOD/texture streaming within a scene | accessible semantic UI |
| GPU resource disposal | results and debrief |
| | application-level routing |
| | focus management and live regions |
| | non-3D evidence equivalents |

### 4.3 The three typed seams

Communication happens only through these three typed seams. No other channel is
permitted (no shared mutable object, no event bus of untyped strings, no
global).

**(a) `MissionSnapshot` — domain → everything (authoritative, serializable)**

The complete learner-visible domain state. Produced by pure domain transitions.
This is the single source of truth for what is true.

**(b) `RenderSnapshot` — domain → renderer (presentation-facing projection)**

Derived from `MissionSnapshot` by a **pure domain function**
(`projectRenderSnapshot`). It carries only what the renderer needs: active body
id, presentation scale factor, orientation/attitude reference, instrument
configuration, target state, and presentation hints. It is produced by the domain
so the renderer cannot invent truth. It must contain **no** value that the
renderer is free to reinterpret as a measurement.

**(c) `MissionIntent` — UI/renderer → domain (typed commands)**

A discriminated union of learner or renderer-originated intentions:
`selectTarget`, `beginApproach`, `selectInstrument`, `takeMeasurement`,
`captureEvidence`, `compareBodies`, `draftClaim`, `citeEvidence`, `submitClaim`,
`openDebrief`, `completeMission`, `reviseClaim`, `requestHint`, `advanceStep`, and
similar. Intentions are applied by a pure transition:
`applyIntent(snapshot, intent, env) -> { snapshot, facts }`.

As of PS-08 the intent list covers the whole frozen loop: a claim is drafted, cited,
submitted and evaluated, opened as a source-traceable debrief, and completed. The
mission's authored facts reach the transitions through `MissionContext` (dependency
injection), so the domain still imports no content (`docs/TECHNICAL_DESIGN.md` §2.1).

**(d) `RenderEvent` — renderer → app (presentation facts, never measurements)**

Renderer-originated notifications such as `targetApproached`,
`observationSettled`, `sceneReady`, `rendererDegraded`. The app translates a
`RenderEvent` into a `MissionIntent` if (and only if) the domain agrees it is a
legal transition. A `RenderEvent` may never carry, and must never be treated as,
a scientific value.

### 4.4 The measurement rule

**No measurement may originate in the renderer.**

A measurement is produced by a pure domain function of
`(instrumentId, bodyId, measurementParams, seed)` and the source register. The
renderer's job is to make the act of measuring feel real and to display the
resulting authoritative value. If the renderer is unavailable, reduced, or on a
lower quality tier, measurement values are unchanged.

### 4.5 Testability requirement

The boundary must be **testable**, not merely documented:

- an automated check that `src/ui/` does not import Babylon engine/render-loop
  APIs, and that `src/domain/` imports neither Babylon nor React;
- a check that `runRenderLoop` appears only under `src/renderer/`;
- a test asserting a domain fixture produces identical output with the renderer
  capability probe stubbed to WebGL2, to WebGPU, and to unavailable;
- a test asserting quality-tier input does not alter any domain value.

## 5. Large-world rendering decision (D-06)

**Decision: v1 requires neither Babylon `GeospatialCamera` nor Large World
Rendering / floating-origin infrastructure.**

Rationale:

- v1 navigation is **curated**: system comparison view → approach → orbit →
  inspection of one target body. It is not free-flight across a true-scale solar
  system.
- Floating-origin/large-world machinery exists to preserve precision when a
  camera traverses distances that strain 32-bit floats. That problem is **avoided
  by construction** here: in a curated scene the active body sits at the scene
  origin and the local scene extent is measured in body-relative units. There is
  no long-baseline traverse to lose precision over.
- `GeospatialCamera` targets geospatial/globe-surface navigation. v1 has no
  surface-traversal requirement.
- MS-ESS1-3's "sense of scale" objective is better served by an **explicitly
  non-literal comparative scale view** plus authoritative numbers than by
  true-scale navigation through mostly-empty space. It is also more honest: the
  scale relationship is stated rather than eyeballed.

Consequences:

- the system view is a **comparative scale view** whose non-literal scale is
  explicit, documented, and never alters displayed authoritative values;
- each target body's scene is normalized to a body-relative presentation scale;
- 3D Tiles / streamed terrain stay rejected (see
  `TECHNOLOGY_DECISIONS.md` §12.1).

**Re-opening condition:** PS-05 may adopt floating-origin or geospatial
infrastructure only if an authored mission genuinely requires inter-body travel
at true relative scale or planetary-surface traversal. That requires an ADR with
the mission requirement attached. If adopted, it must remain **renderer-internal**
and must not change any domain value or accessible equivalent.

## 6. Capability detection and renderer selection

Implemented in `src/platform/` as a pure-ish probe with no domain dependency.

```text
detectCapabilities() -> {
  webgpu: boolean,          // API present AND conceptually usable
  webgl2: boolean,
  maxTextureSize, ...       // bounded presentation facts
  preferredRenderer: 'webgpu' | 'webgl2' | 'unavailable'
}
```

Rules:

1. **WebGL2 is the correctness baseline.** If WebGPU is absent, the game runs on
   WebGL2 with the full mission set.
2. **WebGPU is an enhancement path.** Selecting it may improve presentation; it
   may not change mission rules, measurements, evidence, claims, scoring, or
   accessible equivalents.
3. Capability detection is **non-blocking**: it must not delay first interactive
   paint behind a GPU probe longer than the budget allows, and it must not throw.
4. **Honest failure.** If neither backend initializes, the app shows a real,
   accessible explanation with the reason and next step — never a blank
   viewport, never a spinner that never resolves, never a silent mock.
5. **The domain never reads capability state.**

## 7. Quality tiers

Quality profiles vary **presentation cost only**.

```text
QualityProfileId = 'high' | 'standard' | 'reduced'
```

Stored as **data** in `src/assets/` (not scattered renderer constants), so
profiles can be tuned and reviewed without editing renderer logic.

| May vary by profile | Must NOT vary by profile |
|---|---|
| hardware/render scale | planetary truth and any displayed value |
| texture LOD and streaming aggressiveness | measurements and their precision |
| atmosphere/scattering quality | evidence records |
| shadows | mission rules and step legality |
| post-processing | scoring and claim evaluation |
| particle density | learner-visible conclusions |
| animation/effect density | accessible equivalents |
| frame-rate target and resolution policy | ability to complete the mission |

Selection order: explicit learner preference → `prefers-reduced-motion` and other
media preferences → device heuristic → `standard` default. The profile is
resolved in `src/platform/` and consumed only by `src/renderer/`.
`src/domain/` must not import it.

## 8. Asset pipeline

Three distinct stages, never blended:

```text
source art/          (external DCC, design files)  -> not committed as shipping bytes
intermediate/        (derived, regenerable)        -> excluded from the shipping build
shipping optimized/  (what the browser downloads)  -> committed or produced by a build step
```

Contract:

- **Runtime format:** glTF 2.0 / GLB unless an explicit ADR approves another
  format.
- **Textures:** KTX2 / Basis Universal as the preferred compressed web delivery
  path, with authored mipmaps and LOD where appropriate.
- **Manifests:** `src/assets/` holds typed manifests describing each asset —
  logical id, shipping path, byte size, kind, LOD variants, required quality
  tier, and provenance manifest id.
- **Loading is progressive/lazy.** High visual quality must not require
  downloading the entire production asset set before the first mission is
  interactive. Mission/body assets load on demand through dynamic import or
  manifest-driven fetch of same-origin static files.
- **Separation checks:** `scripts/` must distinguish source art from shipping
  optimized assets so source bytes cannot silently enter the bundle.
- **Provenance is per asset.** Every external asset has a provenance entry before
  it can ship. See `ASSET_PROVENANCE.md`.
- **No asset without provenance.** Missing provenance is release-blocking.

## 9. Audio architecture

One **game-owned audio service** in `src/audio/`, behind a single interface.
Babylon's audio engine or raw Web Audio may be used internally; callers never
touch Web Audio nodes directly.

Required surface:

- buses: master, music, ambience, SFX;
- `mute`, per-bus volume, master volume;
- pause / resume, and separate handling of page-visibility changes;
- browser autoplay policy: audio must not start before a user gesture, and the
  game must work fully if audio never starts;
- preload/stream policy per cue (small cues preloaded; large music streamed);
- cancellation of one-shot cues on teardown.

Contractual rules:

- **Every essential audio cue has a non-audio equivalent** (visual and, where it
  carries information, semantic text). No required information is audio-only.
- Audio must not advance mission state.
- Audio nodes and listeners are disposed on teardown; nothing plays after unmount.
- The audio service is a **seam**: PS-02 establishes it even if it initially has
  placeholder or no real cues.

## 10. State ownership

| State | Owner | Persisted? |
|---|---|---|
| scientific values | `content/` + source register | authored |
| mission progress, evidence, claims | `domain/` | optional bounded resume only |
| scene, camera, transforms | Babylon (`renderer/`) | no |
| semantic UI step, focus, panels | React (`ui/`) | no (focus is not persisted) |
| preferences (reduced motion, mute, volume, quality) | `platform/` + persistence adapter | yes, versioned |
| capability probe result | `platform/` | no |

Rule: **one authority per fact.** No fact is stored in two owners. If the
renderer needs a value, it receives it through `RenderSnapshot`.

## 11. Persistence

- Default v1 behaviour is **session-local and local-first**.
- Persist only: preference flags (reduced motion, mute/volume, quality profile)
  and, if PS-08 proves it improves UX, a bounded mission resume state.
- Never persist identity, free-text learner reasoning, or remote telemetry.
- Persisted schemas are **versioned and fail safely** (validate → migrate →
  bounded fallback), never throwing the learner into a broken state.
- Details and prohibited behaviours: `PRIVACY_AND_PERSISTENCE.md`.

## 12. Testing strategy

### 12.1 Unit / contract

- deterministic domain transitions;
- seeded PRNG and variant reproducibility;
- unit conversion and normalization;
- measurement and claim-evaluation contracts, including the anti-guessing rule;
- content schema conformance;
- persistence schema versioning and safe failure;
- accessible formatting helpers.

### 12.2 Architectural boundary tests (required, automated)

1. `src/domain/` imports no React, no Babylon, no DOM/browser API, no `fetch`,
   no `Math.random`, no `Date.now`, no `requestAnimationFrame`.
2. `src/ui/` does not import Babylon engine/render-loop APIs.
3. `runRenderLoop` appears only inside `src/renderer/`.
4. No module outside `src/renderer/` imports `@babylonjs/core` engine classes.
5. A deterministic domain fixture yields identical output under WebGL2-stubbed,
   WebGPU-stubbed, and renderer-unavailable capability probes.
6. A quality-tier permutation test proves domain output is invariant.

### 12.3 Real-browser renderer tests

- **Babylon initializes in a real browser** (Playwright, real GPU/software
  rasterizer — not a mocked canvas).
- WebGL2 path renders a scene and reports engine readiness.
- Unsupported/failed renderer initialization produces the honest failure UI.
- The render loop is proven to run without React re-rendering per frame.

Mocks may support unit tests but may **not** substitute for this real-browser
evidence.

### 12.4 Component

React Testing Library verifies behaviour from user-observable semantics, not
implementation detail.

### 12.5 E2E

Playwright covers: Chromium, Firefox, WebKit; keyboard-only completion of the
loop; a representative touch viewport; the games-site nested base path; reduced
motion; critical mission path; reload/error recovery.

### 12.6 Accessibility

axe-core provides automated coverage, **supplemented by manual keyboard,
screen-reader-oriented, reflow, contrast, motion, and target-size evidence**.
Automation alone may never be claimed as accessibility sign-off.

### 12.7 Performance

A repeatable measurement harness (PS-02 establishes it) reports bundle/chunk
sizes, asset payloads, and frame timing so the budgets in
`PERFORMANCE_AND_DEVICE_BUDGETS.md` are enforceable. Production qualification
requires real GPU/device evidence in addition to headless/software rendering.

## 13. Hosting boundary

- `setnessconsulting/Game-Planetary-Survey` owns source, tests, content, build,
  release manifest, and immutable artifact identity.
- `setnessconsulting/games-site` owns the public catalog, launcher/play routes,
  outer shell, selected release pointer, same-origin asset delivery, promotion,
  and rollback.
- The game **must not be coupled to games-site internals**. It must not import
  games-site code, and it must not depend on a host `postMessage` protocol for
  v1.

Canonical identity:

```text
slug:            planetary-survey
launcher:        /planetary-survey/
play:            /planetary-survey/play/
asset prefix:    /game-assets/planetary-survey/<version>/...
release kind:    static-web  (entryFile: index.html)
preview variable: PLANETARY_SURVEY_PREVIEW_VERSION
```

Build contract: a self-contained static artifact whose asset references resolve
beneath a **nested versioned base path** (not domain root). No server dependency.

Full contract, promotion, and rollback semantics: `RELEASE_CONTRACT.md`.

## 14. Release identity

The build must emit a release manifest containing at minimum:

- source SHA;
- release version;
- content/source-register version;
- build timestamp;
- dependency-lock identity;
- entrypoint;
- artifact file hashes or an equivalent integrity inventory;
- asset/provenance manifest version;
- renderer capability assumptions (baseline WebGL2).

Immutable candidate artifacts are **never overwritten**.

## 15. Errors and recovery

- Content validation failure: loud in development; bounded, legible recovery in
  production — never a silent different lesson.
- Renderer initialization failure: honest accessible explanation.
- Asset load failure: bounded error with retry affordance, never an endless
  spinner.
- Engine/scene runtime error: degrade to accessible non-3D evidence path where
  possible, since the 3D view is never the only route to required evidence.
- No learner-visible state may be lost by a renderer failure that occurs after
  evidence was captured, because evidence lives in the domain and is persisted
  only as allowed by §11.
