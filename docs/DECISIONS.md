# Planetary Survey — Decisions

Status: owner/planning decisions frozen through PS-03
Jira: GAME-362 (Epic), GAME-363 (PS-01), GAME-366 (PS-03)
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

---

## D-19 — Browser support is capability-declared, not version-enumerated

**Decision:** support is defined by capability. WebGL2 plus ES2022 modules is the
required baseline; WebGPU is an optional enhancement that no gameplay, science,
accessibility, or completion requirement may depend on. No user-agent sniffing and
no browser-version allowlist.

**Rationale:** a version allowlist would have to be re-researched on every browser
release and would still not answer the question that matters — does *this* machine
render correctly. Capability declaration is testable, and it keeps school hardware
on the `reduced` tier playable rather than excluded.

**Consequence:** the renderer and accessibility suites run on chromium, firefox, and
webkit. Where an engine genuinely behaves differently, the difference is either
fixed in application code or recorded as an explicit non-claim — never silently
tolerated.

## D-20 — Dependencies are pinned exactly

**Decision:** no caret or tilde ranges. `package.json` carries exact versions,
`package-lock.json` is committed, and CI installs with `npm ci` only.

**Rationale:** the correctness claims in this project are claims about *specific*
renderer behaviour — whether Babylon's WebGPU support probe agrees with ours,
whether `attachControl` adds a `tabindex`, what the eager and lazy chunks weigh. A
floating range lets two environments run different renderers while both report
"tests pass", which invalidates the evidence rather than merely risking it.

**Consequence:** a dependency upgrade is a separately reviewed change that re-runs
the whole gate including real-browser suites. It is never folded into feature work.

## D-21 — The Node major is recorded in three places on purpose

**Decision:** `.nvmrc`, `.node-version`, and `engines.node` all state `24.x`, and the
Node major changes only in its own reviewed change.

**Rationale:** different tools read different files. Stating it once would let a
developer on an older runtime get a subtly different build instead of a clear
failure.

## D-22 — The capability probe may request a backend but never claims one

**Decision:** the renderer is the sole authority on the backend in use. The
capability probe's result is advisory ("requested"), the System check reports *in
use* and *requested* separately, and the `high` quality tier requires a **confirmed**
backend.

**Rationale:** presence of `navigator.gpu` is not evidence of a usable WebGPU
adapter. Treating it as one displayed "webgpu" while rendering on WebGL2, and
escalated machines with no usable adapter to the most expensive presentation tier —
a silent lie to the learner and a real performance defect on weak hardware.

**Consequence:** both paths are pinned by real-browser regression tests
(`tests/e2e/smoke.spec.ts`), one of which injects a present-but-unusable WebGPU API.

---

## D-23 — "Canonical unit" means two different things, and both are needed

**Decision:** an attribute has a **canonical unit** for storage and display
(`km`, `K`), and each unit `kind` has an **SI base unit** for comparison and ratio
computation (`m`, `K`, `ratio`). Both are declared in one registry
(`src/domain/quantities.ts`), and both are enforced.

**Rationale:** PS-01 wrote both statements without reconciling them —
`SCIENCE_MODEL.md` §6 says canonical storage units are SI, while the attribute
registry declares `km` for lengths. They are not in conflict once separated:
"what unit is this value stored and shown in" and "what does this value equal" are
different questions. Leaving the tension unrecorded would have produced two unit
conversion factors in two modules and a ratio that quietly depended on which one an
author happened to call.

**Consequence:** a value stored in a non-canonical unit is a *warning* (it is
convertible, not wrong); a value in the wrong *kind* is an error; every comparison
and every derived value is computed in the SI base unit; and the conversion factor
for a unit exists in exactly one place. Recording and display precision is always
supplied by the caller, so rounding for display can never change a stored value.

## D-24 — The register is a two-part contract, and a third-party source cannot originate a value

**Decision:** the register's **schema, policy, and validation** live in
`src/domain/sources.ts` and `src/domain/register.ts`; the register's **data** lives
in `src/content/provenance.ts`. A record has a `role`: `value-source` or `locator`.
Only a `value-source` of an accepted class (`agency-primary`, `peer-reviewed`,
`agency-dataset`) can resolve a displayed value. A `third-party` record may only be
a `locator`, and must carry a justification naming the primary source it led to.

**Rationale:** two separate concerns made this shape necessary. First, the privacy
surface check permits absolute URLs only under `src/content/`, because a citation is
the one legitimate place for one — so the validating code must not hold URL data and
the data must not hold policy. Second, `SCIENCE_MODEL.md` §5.1 already said a
third-party source "may be used only to *find* the primary source"; encoding that as
a role rather than as a rule in prose makes it unenforceable to ignore. Without it,
the single most likely provenance failure — citing an infographic or a comparator as
the origin of a number — is the hardest one to detect after the fact.

**Consequence:** `resolveSource` cannot return a locator; a register with an
unjustified or mis-roled third-party record fails validation; and there is no
write-in exception path for a non-authoritative source, because the policy's whole
value is that it has none.

## D-25 — Freshness is a function of recorded dates, never of the clock

**Decision:** `assessRegisterFreshness(register, asOf, thresholds)` takes its
reference date as an argument. Default thresholds are `agingDays: 730` and
`staleDays: 1825`, passed as data. Calendar arithmetic uses a proleptic-Gregorian
day-number conversion, not the platform date parser.

**Rationale:** a build must be able to state "this register is current as of its own
retrieval date" and have that answer be identical on two runs of the same commit.
Reading the clock would make the register's state a property of the machine that
ran the check, and would break the determinism PS-03 exists to establish. The
platform date parser is avoided for a second reason: it silently rolls a
non-existent day over into the next month, which would let a typo'd retrieval date
pass validation. Epoch-dependent values are flagged by `appliesToEpoch` on the
record instead, because a date cannot express that a value moves.

**Consequence:** the domain layer contains no `Date` usage at all, freshness is
testable at any date without mocking, and an empty register reports `unknown`
rather than appearing fresh.

## D-26 — Derived values are formula-identified, unit-typed, and never replace what they came from

**Decision:** a derived value carries the `formulaId` that produced it, its own
unit (`ratio`), and its inputs with the source ids they came from. It is computed
only from authoritative values, and it is added *alongside* the measurement it
derives from. An unavailable or incomparable input returns `null` — never a default.

**Rationale:** MS-ESS1-3 asks the learner to interpret a proportion, so proportions
are inevitable — and an unlabelled proportion is exactly where a fabricated number
could enter unnoticed. Naming the formula and carrying the source ids makes the
derivation auditable and citable, and keeps the measurement as the evidence a claim
must cite (`SCIENCE_MODEL.md` §4). Returning `null` rather than a fallback is the
same rule as an absent value: the game reports the gap instead of guessing.

**Consequence:** `ratioOf` and `relativeScale` are the only constructors, a derived
value cannot be hand-built, and a proportion is displayed through
`describeDerivedValue` at the caller's precision so a normalization can never claim
more precision than its source supports.

## D-27 — A distorted representation must declare itself, in data

**Decision:** every rendered representation has a
`PresentationScaleDeclaration`: kind, `ratio` (drawn : literal), the register
entries it illustrates, a rationale, a model boundary, and the exact learner-facing
words. `literal` requires ratio 1; any other kind requires a ratio other than 1, a
non-empty model boundary, non-empty learner text, and at least one source basis.
`applyPresentationDeclaration` returns only a scale factor, a notice, and the
declaration id.

**Rationale:** `SCIENCE_MODEL.md` §7-§8 already forbid a quality tier or an effect
from changing a scientific value, and require a simplification to be licensed by a
source, a rationale, a boundary, and learner text. Holding that as renderer
constants would have left the requirement unenforceable — a drawing rule nobody can
inspect is how a learner comes to believe a non-literal comparison view is literal.
Naming the declaration in the domain keeps the *decision* auditable and leaves the
renderer free to implement it however it likes.

**Consequence:** the system comparison view cannot be added by PS-05 without
disclosing its distortion, and because the application output type has no field for
a measurement, a declaration can change what a world looks like and never what it
is.

## D-28 — A number quoted to a learner must be produced by a registered formula

**Decision:** a mission may not state a derived quantity unless
`src/domain/normalization.ts` has a registered formula that produces it. When PS-04
content needed to tell a learner that one world holds 0.13 of another "by volume",
the response was to add `relativeVolume` to the formula register — with the sphere
assumption written into its definition — rather than to type the number into a
feedback sentence.

**Rationale:** a cited number is protected by `validateBodiesAgainstRegister`, but a
*derived* number has no citation to check, so a transcription or arithmetic slip in
learner-facing prose is invisible to every existing gate. PS-03 recorded exactly
this hazard in D-26 and then had nothing in it; PS-04 is the first story to write
learner text, and it is where the hole would have been used.

**Consequence:** `tests/content/missionArithmetic.test.ts` recomputes every derived
number quoted in shipped mission text through the domain and requires the authored
sentence to contain the domain's own output, so editing a measurement without
editing the sentence that reasons about it fails the build. Adding a derived claim
to content is now a two-module change, which is the intended cost.

## D-29 — A disputed value ships as `contested`, and may not be scored

**Decision:** where agency products disagree and no retrieved source states its
definition, the value stays in the register with both figures recorded in its
`reviewNote`, marked `contested`, and is excluded from every mission's completion
path by `validateMissionsAgainstRegister`. Deleting it was the alternative.

**Rationale:** this is the Moon's surface relief. NSSDCA states a 13 km topographic
range; LRO altimetry implies roughly 20 km, and the two disagree about whether the
Moon is proportionally smoother than Mars — the very comparison a relief mission
makes. Deleting the value would hide a real disagreement in published data, which
is the failure mode a provenance system exists to prevent; scoring it would teach a
dispute as a fact.

**Consequence:** the register can carry a value the game refuses to use, the
refusal is mechanical rather than editorial, and `SIM-5` tells the learner the
measurement is under review instead of leaving an unexplained gap. Resolving the
dispute is a named item in `SCIENCE_REVIEW_PACKET.md` §3 Q3.

## D-30 — "No content yet" is a declared state, not a scope failure

**Decision:** `validateV1Scope` returns no issues while the catalogue is entirely
empty, and applies in full the moment any body or mission exists.

**Rationale:** PS-02 and PS-03 shipped a deliberately empty catalogue, and the v1
scope rules (one guided mission, two independent missions, one variant) would have
failed that build. A check that fails an honest empty state pushes authors toward
placeholder content to silence it — the opposite of what the rule is for. The empty
state is already declared by design: the register version reads `unpopulated`.

**Consequence:** PS-04's content is the first to be scope-checked, and
`validateCatalog` on the shipped catalogue is a real assertion rather than a
formality. A half-authored catalogue still fails, which is the point.

## D-31 — The browser-suite timeout budget is separated from the assertion budget

**Decision:** the per-test wall-clock budget in both Playwright configs is 120s,
while `expect` keeps the 15s budget. The one test that spent 25 browser round-trips
gathering focus state now records focus in the page and reads the log once.

**Rationale:** a worker in these suites is a full Chromium driving WebGL through
SwiftShader while a multi-megabyte Babylon chunk loads and a frame loop runs at
display rate, so a test's *duration* is a property of the machine and of how many
sibling workers are competing. On a loaded developer machine the same suite
reported eight failures that were all timeouts and none of them defects — including
tests that pass in 2.9s on their own. A gate that reports product failures when the
machine is busy trains reviewers to ignore it, which is worse than a slow gate.

**Consequence:** a genuine hang still fails the run, a genuine regression still
fails fast on the 15s assertion budget, and "the suite is red" now means something.
The duration of each test is no longer itself an assertion, which is the honest
position: this project does not measure performance in CI, and PS-12 owns
performance evidence.

## D-32 — The design source of truth is typed and generated, not a canvas

**Decision:** visual constants are declared in `src/design/tokens.ts`, and
`src/styles/tokens.css` is generated from them and byte-compared in the gate.
Surfaces, their states, and the obligation each one owes are declared in
`src/design/surfaces.ts` as required fields. GAME-367's criteria allow a "Figma or
equivalent" handoff; this is the equivalent, and no Figma file is linked.

**Rationale:** a canvas cannot fail a build. The rules this project actually depends
on — a required distinction carries a non-colour encoding, a surface that shows
visual data names its table equivalent, a surface that uses the 3D view names its
semantic alternative, every interactive control meets the touch minimum, every
motion duration is neutralised under reduced motion — are all enforceable as typed
fields and unenforceable as annotations. A Figma library is also a second place a
colour can be changed, and the drift between a library and a stylesheet is invisible
until someone ships it.

**Consequence:** the trade is recorded rather than hidden (`DESIGN_SYSTEM.md` §1):
fast visual exploration and a human artefact to approve are *not* provided, and
human visual sign-off remains outstanding under PS-09/PS-14. If a design file is
later introduced, it does not override the token source without a change to it.

## D-33 — Contrast is a measured property of the pair in use, not of the palette

**Decision:** `CONTRAST_REQUIREMENTS` declares the foreground/background pairs that
ship; `npm run check:design` computes the real WCAG 2.1 ratio for each and fails
below the declared minimum. Text tokens a learner must read — including units and
provenance tags — are held to 4.5:1 rather than 3:1. Raising a declared minimum to
make a failing pair pass is forbidden.

**Rationale:** the first run of the check failed `--ps-border-strong`, inherited
from the PS-02 foundation palette, at **2.14:1** against a panel: below the 3:1
non-text minimum that the token exists to meet, and invisible until the ratio was
computed. A palette can pass a linter and fail a learner, so the requirement is
stated per pair in use, because what matters is that this text sits on that surface.
Treating units and source tags as optional reading was the same class of mistake: in
a product whose premise is that a number travels with its source, they are not
decoration.

**Consequence:** `--ps-border-strong` is now `#5a6d80` (3.52:1 on a panel, 3.25:1 on
a raised control) and `--ps-text-subtle` was lightened for the text minimum; both
changes are recorded in the tokens' own purpose notes so a later reader does not
restore the darker values. Every future palette change either keeps its pairs above
their minimum or is a redesign.

## D-34 — Generated placeholder assets carry `generated.*` provenance ids

**Decision:** Shipping assets that are original generated placeholders (PS-05
foundation GLB/KTX2) must carry an explicit provenance id of the form
`generated.<slug>`. `provenanceId: null` remains forbidden by
`npm run check:assets`.

**Rationale:** `src/assets/assetManifest.ts` previously commented that `null` was
allowed for generated placeholders, while `scripts/check-asset-pipeline.mjs` and
`docs/ASSET_PROVENANCE.md` required a provenance record for every shipping asset.
Leaving `null` would either fail the gate or silently weaken provenance. A
`generated.*` id documents creation method without inventing agency rights, and
PS-10 replaces these placeholders with production art under full provenance
records.

**Consequence:** PS-05 placeholders use `generated.ps05-placeholder-*` ids. The
manifest comment matches the gate. External or agency-derived art still needs a
complete provenance record before release.
