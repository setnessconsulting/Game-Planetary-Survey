# Planetary Survey — Art Direction

Status: binding PS-10 production record
Jira: GAME-362 (Epic), GAME-374 (PS-10)
Decision date: 2026-09-25
Provenance authority: [`ASSET_PROVENANCE.md`](ASSET_PROVENANCE.md) · [`DECISIONS.md`](DECISIONS.md) D-41, D-42
Visual language: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §8

## What this is

Every pixel and vertex that ships in v1 is **original procedural work** produced by
`scripts/generate-production-assets.mjs`. There is no agency imagery, no licensed
third-party asset, no stock material, and nothing derived from a comparator. The
generator is committed, the art is reproducible from it, and the content hash of
every shipped file is recorded in `src/assets/provenanceManifest.json`.

## What ships

| Asset | Count | Notes |
|---|---|---|
| Body meshes | 10 | LOD0 (96×64) and LOD1 (32×20) for each of the five bodies |
| Albedo textures | 5 | 512×256 equirectangular RGB |
| Normal maps | 5 | 512×256 tangent-space, from the same height field as the mesh |
| Environment | 1 | 128×64 Radiance `.hdr`, prefiltered at load for image-based lighting |
| Audio cues | 9 | **Zero shipped bytes.** Synthesised at play time; see [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) §9 |

Total shipping art is ~2.5 MB, loaded progressively: the bundle report confirms
every asset stays in the lazy payload, and the first mission becomes interactive
without fetching the set (`PERFORMANCE_AND_DEVICE_BUDGETS.md` §3.3).

## The one rule that governs the art

**Art direction is not measurement.** Nothing in the generator is derived from the
source register. A body's mesh is a *presentation-scale* illustration, and every
learner-visible number comes from the domain layer and the per-field source
register, never from a mesh or a texture. This is
[`RENDERING_QUALITY_STRATEGY.md`](RENDERING_QUALITY_STRATEGY.md) §10 rule 4 — a
body's visual representation must not imply a measurement the game does not have —
and rule 6 — imagery illustrates a sourced value and is never its source. Every
provenance record therefore carries `scientific_claim_linkage: "none"`, and a test
asserts the renderer reads no planetary attribute name at all.

Displacement amplitudes are a small fraction of radius (0.005–0.014) precisely so
that no silhouette reads as a scale claim. The system-comparison view keeps its own
"not drawn to literal scale" declaration unchanged.

## Visual language

`DESIGN_SYSTEM.md` §8.1 already defines the language: cinematic but calm, legible,
scientific, original; data over chrome; dark neutral surfaces with colour reserved
for meaning; no motion as decoration. The generated art obeys it in three ways that
are worth naming, because they are the points a reviewer is most likely to push on:

- **The environment is dark and directional, not bright and even.** An even
  ambient wash would light every body identically from every angle, leaving albedo
  as the only difference between two worlds — the exact failure §3 forbids. A dark
  field with one warm key aligned to the renderer's key light lets the key do the
  modelling, so bodies separate by their material response under a *common* light.
- **Bodies must stay distinguishable.** Every pair of bodies is separated by at least
  a CIE76 ΔE of 10 in Lab space, asserted in test. The binding pair is Europa and the
  Moon: both pale, one icy and one grey.
- **Roughness varies by body and means something.** Europa's ice (0.42) is the
  smoothest surface in the survey and the Moon's regolith (0.94) the roughest. If
  those ever invert, the art has stopped saying anything.

Exposure (1.05), contrast (1.12), environment intensity (0.85) and the ACES tone
map live in `src/renderer/calibration.ts` with a written rationale each. They are
reviewed values, not defaults: the rationale states what was measured and what
would break if the value moved.

## The atmosphere shell

Only a world with a **sourced** `atmosphereDepth` shows a shell, so in v1 that is
Titan alone. The shell is a *neutral, explicitly labelled representation*, not a
depth measurement, and the reason is specific: the one sourced atmosphere value is a
**lower bound on the altitude at which the atmosphere was detected**, not a measured
top. Sizing a shell from it would draw a precise boundary the register does not
contain. `RENDERING_QUALITY_STRATEGY.md` §4 provides this alternative explicitly.
Deriving a real depth is left open for PS-11/PS-12 (D-44).

## What this does not claim

- **No human visual review.** Nobody has looked at this art and approved it. The
  contract is machine-checked and the separation is asserted numerically; neither is
  taste. Human visual sign-off is PS-14's, and constraint 3 of `STATUS.md` is
  unchanged.
- **No artist commissioning.** The art is generated, not hand-made. It is
  production-fidelity and provenance-clean, and that is a different claim from
  "designed by an artist and approved by a person".
- **No GPU- or device-qualified visual quality.** Every rendering observation in
  this story was made under software rasterisation. Frame time, memory, and how the
  art looks on real hardware are PS-12's (see `SLICE_QUALIFICATION.md` §6).
- **No target-age legibility.** That the art reads well for a 12-year-old is
  reasoning, not evidence. The target-age playtest is PS-11/PS-14's.
- **No science review.** The art is unrelated to the science question (GAME-368
  remains open), and the values learners are graded on are unchanged by it.
- **No Figma file.** The design source of truth remains in the repository; see
  `DESIGN_SYSTEM.md` §1 and §10.

## How to review it

1. `node scripts/generate-production-assets.mjs` — regenerates every byte. Output is
   deterministic, so hashes should not move; a test asserts that.
2. `npm run check:assets` — verifies registration, provenance completeness, approval
   status, and that every recorded byte count and content hash matches disk.
3. `npx vitest run tests/assets tests/renderer tests/design tests/audio` — the
   separation, budget, determinism, calibration, and cue contracts.
4. Look at the app: `npm run dev`, open a mission, measure a world, and compare two.
   The numbers in the notebook are the science; the viewport is the illustration.

## Changing it

`ART_DIRECTION` in the generator is the single place a body's look is defined.
Change it there, re-run the generator, and let the regenerated manifests and hashes
follow. Editing an asset file by hand will fail `npm run check:assets`, which is
the intended behaviour: the bytes and their provenance are one fact, not two.
