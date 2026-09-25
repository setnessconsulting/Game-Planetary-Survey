# Planetary Survey — Asset and Provenance Policy

Status: binding PS-01 production policy
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

## Principle

Every shipping asset must be **original**, **generated/commissioned with
documented rights**, or **licensed for the intended distribution**.

"Found online" is not provenance. Unknown provenance is release-blocking.

Planetary Survey uses space-agency *data* as a scientific source. That is not the
same as having a licence for agency *imagery, textures, or branding*, and the two
must never be conflated.

## Comparator boundary

Comparator products (`BENCHMARK_RUBRIC.md`) are quality references only.

No asset, layout, wording, sound, icon set, shader look, UI treatment, narrative,
or content may be copied from Universe Sandbox, Kerbal Space Program, SpaceEngine,
NASA Eyes on the Solar System, or any other product.

## Branding boundary

- NASA, JPL, USGS, ESA, and agency marks are **not** part of the Planetary Survey
  identity.
- The product must not appear to be sponsored, endorsed, or produced by any agency.
- Agency data is cited as a **source**, in a citation/attribution context — never
  as a co-brand, and never as a logo in the interface.
- Do not imitate agency visual identity, typography, or UI conventions.

## Asset categories to track

At minimum:

- probe/spacecraft models and their textures;
- planet/body meshes and surface textures;
- scientific imagery (agency or derived);
- topographic/bathymetric data or derivatives;
- UI icons and instrument symbols;
- workstation/HUD art and backgrounds;
- charts/illustrations;
- fonts;
- sound effects, ambience, music;
- Figma-exported production assets;
- generated assets;
- third-party libraries that embed assets.

## Three-stage pipeline

```text
source art / external DCC        -> tracked, not shipped as-is
intermediate / derived           -> regenerable, excluded from shipping build
shipping optimized               -> what the browser downloads
```

- Blender is the supported source-art/DCC tool for custom 3D assets (mesh
  cleanup, UVs, baking, LOD generation, format conversion) and is **not** a
  runtime or build dependency.
- Source `.blend` files, high-poly meshes, and uncompressed source imagery are
  **source** artifacts, not shipping bytes.
- A `scripts/` check must distinguish source art from shipping optimized assets so
  source bytes cannot silently enter the bundle.

## Provenance record (required)

Every non-code shipping asset has:

```text
asset_id
path                      (shipping artifact path)
category
creator / provider
creation method           (original | commissioned | licensed | derived | generated)
source reference          (URL, dataset id, or original-work reference)
license / rights basis    (exact license or usage basis)
agency origin             (NASA / JPL / USGS / other / none)
usage restrictions        (attribution required? redistributable? commercial ok? derivatives ok?)
transformations           (crop, resize, retopology, bake, compression, colour handling)
tool + version used       (Blender version, texture tool, encoder settings)
source artifact reference (which source file this came from)
scientific claim linkage  (which scientific attribute this asset illustrates, if any)
reviewer
review date
release status            (approved | pending | rejected)
```

## Agency data — required review

NASA/JPL/USGS data may be an excellent scientific source and still require
**asset-level** usage review. For each agency-derived asset, record:

1. which specific product it comes from (dataset, image ID, or page);
2. whether redistribution and derivative use are permitted for this product;
3. whether attribution is required, and where it appears in-product;
4. what transformations were applied;
5. whether the depiction could mislead about a measurement.

An agency asset is **not** approved merely because it is publicly viewable.

## Scientific imagery integrity

- Imagery is *illustrative of* a sourced value, never a source of it.
- A texture or render must not imply a measurement the game does not have
  (`SCIENCE_MODEL.md` §8, `RENDERING_QUALITY_STRATEGY.md` §10).
- Where a body's surface or atmosphere is not authoritatively known at the
  fidelity shown, the asset must be labelled representative.
- Provenance review is a **science** review too: PS-04's science review covers the
  claim linkage field.

## Generated assets

If generative tools are used:

- record tool/provider and date;
- perform a human originality review;
- do not request or retain output that imitates a comparator's protected visual
  style or any agency's brand identity;
- confirm the output is safe to distribute under project policy;
- generated imagery may never be presented as real observational data.

## Fonts

- Prefer system fonts or well-understood open-licence fonts.
- If bundled: record the exact licence, bundle required licence text, and verify
  web-embedding is permitted.
- Do not add a font solely for novelty if it degrades readability or bundle size.
- Text must remain readable and reflowable at 200% zoom (`ACCESSIBILITY.md`).

## Audio

Audio must be original or clearly licensed, small/bounded, optional, present in
the provenance manifest, and never the sole carrier of essential information
(`TECHNICAL_DESIGN.md` §9).

No unlicensed commercial music. No extracted audio from any product.

## Design authority

PS-DESIGN (GAME-367) delivered the design source of truth **in the repository**
rather than as a Figma file: `docs/DESIGN_SYSTEM.md`, generated from
`src/design/tokens.ts` and `src/design/surfaces.ts`. No Figma file is linked, and
`STATUS.md` records that. The trade is stated in `DESIGN_SYSTEM.md` §1: the contract
is complete and machine-checked, and a canvas's real strengths — fast visual
exploration and a human artefact to approve — are not provided. Human visual
sign-off remains outstanding and belongs to PS-09/PS-14.

If a Figma file is later introduced, it becomes production design authority only
once PS-DESIGN records:

- file key;
- version/checkpoint;
- relevant pages/frames;
- asset ownership and provenance status for exported material.

Exports must be traceable back to the approved design revision, and the typed token
source remains the authority for any value that ships: a frame exported from a
design file does not override `src/design/tokens.ts` without a change to it.

## Asset manifest (machine-readable)

PS-02 establishes the manifest structure; PS-10 populates it at production
fidelity. Minimum shipping fields per asset:

```text
logical id
shipping path
content hash
provenance id
category
licence category
quality tier requirement (if any)
LOD variants
release approval status
```

The release manifest references the asset/provenance manifest version
(`RELEASE_CONTRACT.md`).

## Release blockers

Unknown, incomplete, or incompatible provenance for a shipping asset blocks
release until the asset is:

- replaced with a provenance-clean asset;
- proven distributable; or
- explicitly removed from the build.

An agency logo, an unlicensed texture, or a comparator-derived asset appearing in
a candidate build is a **P0** finding.
