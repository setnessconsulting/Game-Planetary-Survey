# Planetary Survey — Rendering and Visual Quality Strategy

Status: binding PS-01 rendering contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

Planetary Survey is expected to reach a polished, commercially credible visual
bar. This document fixes the **architecture that makes that bar reachable**, the
**renderer baselines**, the **quality tiers**, and the **integrity rules** that
keep visual polish subordinate to science.

The quality ceiling must be designed in from the beginning. The implementation
may reach it progressively (PS-05 → PS-10), but PS-02 must not make a decision
that closes it off.

---

## 1. Renderer baseline

| Layer | Baseline | Status |
|---|---|---|
| Required correctness baseline | **WebGL2** | required for all supported browsers |
| Enhancement path | **WebGPU** | used when detected and usable |
| Engine | Babylon.js 9.28.x | only approved 3D engine |
| Runtime 3D format | glTF 2.0 / GLB | required |
| Texture delivery | KTX2 / Basis Universal | preferred |

### 1.1 Invariance rule (release-blocking)

Across renderer backend (WebGL2 vs WebGPU) and across quality tier:

- planetary truth is identical;
- measurements and their precision are identical;
- evidence records are identical;
- mission rules and step legality are identical;
- scoring and claim evaluation are identical;
- accessible equivalents are identical;
- the learner can complete every mission on the lowest tier and on WebGL2.

Only presentation cost may differ.

## 2. Camera and navigation model

```text
system comparison view  →  approach  →  orbit  →  inspection
```

- **System comparison view.** A deliberately **non-literal** comparative scale
  view. It exists to make relative scale legible; the literal scale is stated as
  a number and an explicit note, not inferred from the picture. This is a
  scientific choice: eyeballing an empty true-scale solar system teaches less than
  a labelled comparison.
- **Approach / orbit / inspection.** Per-target scenes normalized to a
  body-relative presentation scale, with the active body at the scene origin.
- Camera transitions preserve orientation. The learner must never become
  disoriented about which body they are looking at or from where.
- No free-flight, no long-baseline traverse, no surface traversal — see
  `TECHNICAL_DESIGN.md` §5, which records why neither `GeospatialCamera` nor
  Large World Rendering is required in v1.

Every camera mode must have an **accessible equivalent path** to the same
evidence. Camera skill may never be a gate on obtaining a required measurement.

## 3. Materials, lighting, and image quality

Approved production techniques:

- Babylon **PBR / OpenPBR-compatible** material workflow;
- **HDR / prefiltered image-based lighting** for environments where physically
  sensible;
- **deliberate tone mapping and calibrated exposure** — chosen and reviewed, not
  left at defaults by accident;
- **calibrated color handling** so that a displayed color is intentional and
  reproducible;
- **solar illumination** that is honest about the fact that illumination falls
  off with distance (this is scientifically meaningful, not decoration).

Not permitted:

- materials or lighting that imply a measurement the game does not have;
- an HDR/IBL environment that makes two measurably different bodies look
  measurably the same;
- exposure tuning used to hide a scientific difference.

## 4. Atmosphere policy

Atmosphere is **scientifically meaningful** in the MS-ESS1-3 layer-depth
objective, so it is permitted — and constrained.

Allowed:

- an atmospheric shell whose **depth is derived from the sourced
  attribute** for that body, expressed in the body's presentation scale;
- scattering that communicates atmospheric presence and depth rather than
  spectacle alone;
- tier-scaled scattering quality (sample counts, resolution, effects).

Required:

- where a body's atmospheric depth is **not** authoritatively known, the game must
  **not** render a plausible-looking shell that implies a measurement. It must use
  a neutral, explicitly-labelled representation (or none) plus learner text.
- atmosphere rendering must never be the only carrier of the depth value; the
  number and its accessible equivalent must exist independently.

## 5. Quality tiers

```text
QualityProfileId = 'high' | 'standard' | 'reduced'
```

Profiles are **data** in `src/assets/`, consumed only by `src/renderer/`.

| Setting | high | standard | reduced |
|---|---|---|---|
| Hardware/render scale | native, possibly >1 on capable GPUs | native (clamped) | reduced (e.g. 0.75, tabled) |
| Shadow support | on | on, reduced resolution | off |
| Atmosphere/scattering | full sample budget | moderate | minimal or simplified shell |
| Post-processing | full approved stack | reduced stack | off |
| Particle density | full | reduced | minimal |
| Texture LOD bias / streaming | aggressive quality, larger budget | balanced | conservative, smaller budget |
| Animation/effect density | full | reduced | minimal |
| Target frame pacing | per `PERFORMANCE_AND_DEVICE_BUDGETS.md` | same | same |

Selection order: explicit learner preference → media preferences
(`prefers-reduced-motion`) → device heuristic → `standard`.

Every tier must be **playable and complete**, not a degraded placeholder.
`reduced` is a supported configuration, not a punishment mode.

## 6. Post-processing policy

- Post-processing is permitted for production image quality through Babylon's
  Frame Graph / post-process pipeline.
- **Every effect must have a quality tier.** No effect may be unconditionally
  enabled.
- **No effect may encode or alter scientific truth.** Bloom, tone mapping, depth
  of field, and similar are presentation only.
- A visual effect must never fabricate scientific evidence
  (`SCIENCE_MODEL.md` §8).
- Effects are added because they serve clarity or quality — never because they
  exist.

## 7. Asset loading, LOD, and progression

- **Progressive / lazy loading is required.** The first mission must become
  interactive without downloading the whole production asset set.
- Mission and body assets are **code-split or manifest-loaded on demand**.
- LOD: authored multi-resolution meshes and textures, with transitions that do not
  visibly pop in a way that misrepresents a body's shape or scale.
- Mipmaps are authored/verified, not left to chance, for shipping textures.
- No unbounded preload. No blocking load of non-current mission assets.
- A failed asset fetch produces a bounded error with retry, never an endless
  spinner (`TECHNICAL_DESIGN.md` §15).

## 8. Texture compression

- **KTX2 / Basis Universal is the preferred web delivery format.**
  - Supercompressed (ETC1S-style) for imagery where quality allows;
  - UASTC-style for data-like textures where quality demands it.
  - The choice per texture is recorded, not guessed.
- Shipping textures must be GPU-efficient: no shipping an uncompressed source PNG
  where a compressed equivalent suffices.
- Texture memory is tracked against the memory budget proxy in
  `PERFORMANCE_AND_DEVICE_BUDGETS.md`.

## 9. Performance instrumentation

PS-02 establishes, and later stories maintain, a repeatable harness reporting:

- **Build-time:** JS chunk sizes (raw and compressed), asset payload per logical
  group, total shipping asset bytes.
- **Runtime:** frame time distribution (median and p95), frame pacing / long-task
  counts, engine render time, number of active draw calls where available,
  texture/GPU memory proxies.
- **Loading:** time to first meaningful paint, time to interactive, time to first
  mission interactive, per-mission incremental asset load.
- **Backend:** which backend was selected, whether the fallback was exercised.

Instrumentation is **presentation-side only** and reports no learner data off
device (`PRIVACY_AND_PERSISTENCE.md`).

Budgets and reference devices: `PERFORMANCE_AND_DEVICE_BUDGETS.md`.

## 10. Visual integrity rules (release-blocking)

1. A visual effect may never fabricate scientific evidence.
2. A quality tier may never change a learner-visible scientific value,
   measurement, evidence record, or claim outcome.
3. Presentation scale distortion must be explicit and must never alter a
   displayed authoritative value.
4. A body's visual representation must not imply a measurement the game does not
   have.
5. Scientific clarity and evidence readability outrank spectacle. If polish
   reduces legibility of a required value, polish loses.
6. Imagery is never a source of a value; it is an illustration of a sourced
   value.
7. No reproduction of any comparator's expressive design, layout, art, text,
   narrative, UI, or proprietary asset (`BENCHMARK_RUBRIC.md`).

## 11. Reference browser and device qualification

| Tier | Requirement |
|---|---|
| Required | Current desktop Chromium and Firefox on WebGL2 |
| Required | Current Safari/WebKit on WebGL2 |
| Enhancement | WebGPU on a browser/device where it is available and stable |
| Required | At least one representative lower-capability device/browser |
| Required | A real-GPU/device check in addition to headless/software rendering |

Exact versions are recorded at PS-12/PS-13 qualification time. Headless or
software rendering is **not** accepted as sole evidence of visual or performance
quality.

## 12. Ownership

| Concern | Owner story |
|---|---|
| renderer foundation, camera modes, asset pipeline | PS-05 |
| instruments and measurement presentation | PS-06 |
| accessible data equivalents | PS-07 |
| final visual/motion polish, provenance-controlled assets | PS-10 |
| consolidated rendering/performance qualification | PS-12 |
| comparator and originality review | PS-14 |
