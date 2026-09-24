# Planetary Survey — Decisions

Status: owner/planning decisions frozen through PS-01
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

Each decision is closed. A downstream story may add detail, but may not reverse a
decision here without an explicit Jira decision recorded against GAME-362.

---

## D-01 — Canonical repository

**Decision:** `setnessconsulting/Game-Planetary-Survey`, default branch `main`.

Starting `main` SHA at PS-01:

```text
649dd013a6c8ea91f9990fbe3f78a842161b201c
```

The repository existed before this Epic and is the implementation authority for
game code, tests, design/architecture artifacts, science/content artifacts, build
metadata, and release evidence.

**No replacement repository may be created, renamed, or migrated.** Existing
history is preserved; no destructive reset.

## D-02 — Hosting and release identity

**Decision:** released through `setnessconsulting/games-site` as a `static-web`
game.

```text
slug:              planetary-survey
launcher:          /planetary-survey/
play:              /planetary-survey/play/
asset prefix:      /game-assets/planetary-survey/<version>/...
preview variable:  PLANETARY_SURVEY_PREVIEW_VERSION
```

Production remains unavailable until PS-PROMOTE. games-site is the
hosting/promotion authority, not the game implementation authority.

## D-03 — TypeScript version

**Decision:** begin on TypeScript **6.0.x** (PS-02 pins the exact patch), not
TypeScript 7.

**Reason:** verified 2026-09-24 — `typescript` `latest` is 7.0.2, but
typescript-eslint 8.70.x declares its TypeScript peer as `>=4.8.4 <6.1.0`, so
TypeScript 7 sits outside the supported lint window. A fully supported
lint/typecheck toolchain is worth more than adopting a newer compiler early, and
suppressing an unsupported-version warning is not permitted.

Upgrade to TypeScript 7 is gated on official typescript-eslint support plus a
clean full verification (`TECHNOLOGY_DECISIONS.md` §10.1).

## D-04 — Runtime architecture

**Decision:** a pure TypeScript domain/science authority, a React 19 semantic
application shell, and a Babylon.js 9 presentation/input adapter, built with
Vite 8 as a static web application.

- The domain layer owns truth and is dependency-free.
- React owns the semantic shell and must **not** own the 3D frame loop.
- Babylon owns the scene, camera, render loop, and presentation effects.
- All communication goes through typed snapshots, intents, and events.

**Reason:** the core interaction is interactive 3D inspection of spherical
worlds, while the learning objective requires deterministic, source-backed,
testable science. Separating them lets each be verified properly.

Alternatives rejected: Unity WebGL (build/runtime weight, second runtime without
a v1 requirement); Three.js / React Three Fiber (viable, but more custom
game/scene infrastructure for this product); Phaser (excellent 2D engine, wrong
tool for 3D inspection).

## D-05 — Renderer backend policy

**Decision:** **WebGL2 is the required correctness baseline.** **WebGPU is an
enhancement path only.**

Gameplay, science correctness, evidence accessibility, and mission completion are
**invariant** across renderer backend. Unsupported or failed renderer
initialization produces an honest, accessible failure state — never a blank
viewport, never a silent mock.

## D-06 — Large-world rendering infrastructure

**Decision:** v1 requires **neither** Babylon `GeospatialCamera` **nor** Large
World Rendering / floating-origin infrastructure.

**Reason:** v1 navigation is curated (system comparison → approach → orbit →
inspection). In a curated scene the active body sits at the scene origin with a
body-relative presentation scale, so the long-baseline precision problem that
floating-origin solves is avoided by construction. There is no surface-traversal
requirement. Additionally, MS-ESS1-3's scale objective is better served by an
explicitly non-literal comparative view plus authoritative numbers than by
true-scale navigation through mostly empty space.

3D Tiles / streamed planetary terrain remain rejected for v1.

**Re-opening condition:** PS-05 may adopt either only if an authored mission
requires inter-body travel at true relative scale or planetary-surface traversal,
with an ADR carrying the mission requirement. If adopted, it stays
renderer-internal and may not change domain values.

## D-07 — Quality tiers

**Decision:** three named profiles — `high`, `standard`, `reduced` — held as
**data**, consumed only by the renderer.

They may vary render scale, texture LOD/streaming, atmosphere quality, shadows,
post-processing, particles, and animation density.

They may **never** vary planetary truth, measurements, evidence, mission rules,
scoring, learner conclusions, or accessible equivalents.

## D-08 — Package-version policy

**Decision:** PS-01 fixes technology **families and boundaries**. PS-02 resolves
and pins **exact mutually compatible versions** in repository-controlled files
with a committed lockfile.

All `@babylonjs/*` packages must share one version. Planning-document version
strings are never used as pins. "A newer version exists" does not justify an
upgrade after the lockfile is authoritative.

## D-09 — LevelBest integration excluded

**Decision:** LevelBest integration is **out of scope for GAME-362 and for
Planetary Survey's v1 release path.**

No LevelBest dependency, adapter, host contract, or promotion requirement may be
added. Release completion must not depend on LevelBest. The former LevelBest
child issue is retired as Wont Do (GAME-380) and is retained only as planning
history.

If Planetary Survey is ever selected for LevelBest, that integration must be
planned and authorized separately, after this Epic.

## D-10 — No host message protocol

**Decision:** no `postMessage`/custom host protocol for v1. The iframe owns the
game session; games-site owns outer navigation. Adding one later requires a new
explicit requirement and contract tests.

## D-11 — Audio

**Decision:** browser-native **Web Audio** behind a **game-owned audio service**
with master/music/ambience/SFX buses, mute, volume, pause/resume, visibility
handling, preload/stream policy, and non-audio equivalents.

**FMOD is not approved for v1.** It may only be revisited via a separate ADR/spike
proving a concrete adaptive-audio requirement this architecture cannot satisfy.

## D-12 — Asset formats and art pipeline

**Decision:** glTF 2.0 / GLB for shipping runtime 3D assets; KTX2 / Basis
Universal as the preferred compressed texture delivery path; authored mipmaps and
LOD where appropriate.

Figma is the UI/interaction design authority once a real file/version is linked.
Blender is the supported source-art/DCC path. **Neither is a runtime or build
dependency.**

Source art, intermediate/derived artifacts, and shipping optimized assets are
separately tracked. Every shipping asset has a provenance record
(`ASSET_PROVENANCE.md`).

## D-13 — No general state framework

**Decision:** pure domain transitions plus React state/reducer/context for UI
orchestration only. Redux, Zustand, XState, MobX, and similar are not approved for
v1 and require an ADR with a measured benefit.

## D-14 — v1 content scope

**Decision:** v1 contains one guided survey mission, at least two independently
solvable comparison/survey missions, at least one replayable seeded/data variant,
multiple strongly contrasting bodies, and an evidence notebook/comparison board.

Exact bodies, measurements, and claims are frozen in **PS-04** (`GAME-368`) using
the selection criteria in `PRD.md` §7 after source-based science review.

## D-15 — Comparators

**Frozen quality comparators:**

- Universe Sandbox — science/data/system clarity and astronomical scale;
- Kerbal Space Program — mission fantasy, agency, purposeful instruments;
- SpaceEngine — celestial-body presentation, navigation, scale, orientation.

**Scientific-interaction reference (not scored):** NASA Eyes on the Solar System.

Each comparator owns a different quality dimension and is a **quality reference
only**. No expressive copying, and no comparator is a source of scientific values.
See `BENCHMARK_RUBRIC.md`.

## D-16 — Privacy and persistence

**Decision:** v1 is **local-first**. No learner accounts, advertising, marketing
trackers, remote learner telemetry, runtime LLM calls, remote upload of learner
claims/traces, remote storage, or engagement-pressure mechanics. No remote service
is required to play.

Only preferences and (optionally) a bounded mission resume state are persisted, in
versioned, fail-safe storage.

## D-17 — Accessibility precedence

**Decision:** accessibility is an architectural requirement, and the 3D view is
never the only route to required evidence.

Where accessibility conflicts with visual polish or performance optimization,
accessibility wins unless the owner explicitly changes scope. Any non-conformance
is an explicit recorded decision with a remediation story — never an unrecorded
exception.

## D-18 — Owner decisions outstanding

**Decision: there are no unresolved owner decisions that could materially change
the runtime architecture or the v1 learning loop.**

Decisions considered and resolved rather than deferred:

| Question | Resolution |
|---|---|
| Which renderer? | Babylon.js 9 (D-04) |
| WebGPU-required or WebGPU-optional? | WebGL2 baseline, WebGPU enhancement (D-05) |
| Large-world / geospatial infrastructure? | neither (D-06) |
| Exact dependency versions? | delegated to PS-02 as a pinning task, not an owner decision (D-08) |
| TypeScript 6 vs 7? | 6.0.x, toolchain-supported (D-03) |
| Which bodies in v1? | PS-04, using PS-01 criteria (D-14) |
| Performance numbers? | proposed with documented assumptions; measured and tightened by PS-12 (`PERFORMANCE_AND_DEVICE_BUDGETS.md`) |
| LevelBest? | excluded (D-09) |
| Host message protocol? | none for v1 (D-10) |
| How is a preview reachable while production stays unavailable? | **games-site's decision**, recorded as a PS-HOST dependency (`RELEASE_CONTRACT.md` §7.1) |

The last row is deliberately *not* an open owner decision for PS-01: it belongs to
games-site/PS-HOST and does not change Planetary Survey's runtime architecture or
learning loop.
