# Planetary Survey

A browser-first planetary-science game for learners in approximately **grades
6–8**.

The learner acts as a junior planetary scientist operating a survey probe and
workstation: they receive a brief, choose a target world, pick an instrument,
take a measurement, capture it as evidence, compare worlds, make a claim, and
defend that claim by citing the evidence they collected.

**Planetary Survey is not a planet-fact quiz.** No mission can be completed by
recalling a fact. Completion requires producing, inspecting, and interpreting
measurement evidence.

- **Canonical repository:** `setnessconsulting/Game-Planetary-Survey` (branch `main`)
- **Jira Epic:** `GAME-362`
- **Hosting:** `setnessconsulting/games-site` (static-web release)
- **Curriculum target:** NGSS **MS-ESS1-3** (primary), MS-ESS1-2 (bounded,
  qualitative)

## Status

| Phase | Story | State |
|---|---|---|
| Contract freeze | GAME-363 / PS-01 | complete — this `docs/` set |
| Executable foundation | GAME-364 / PS-02 | next |
| games-site host contract | GAME-365 / PS-HOST | blocked by PS-02 |
| Science registry | GAME-366 / PS-03 | blocked by PS-02 |
| Design preproduction | GAME-367 / PS-DESIGN | blocked by PS-02 |

Live status is tracked in Jira and summarized in [`docs/STATUS.md`](docs/STATUS.md).

**This repository is in the contract/foundation phase.** There is no playable
build yet; the application skeleton lands in PS-02. The `docs/` directory is the
binding product, science, and architecture contract that all downstream work must
honor.

## Scope boundaries

- **Standalone game.** Planetary Survey is built as a standalone game and
  released through `games-site`. It is not a host-integrated module.
- **LevelBest is out of scope.** No LevelBest dependency, adapter, or host
  contract may be added, and release completion must not depend on LevelBest.
  The former LevelBest issue is retired as Wont Do (`GAME-380`).
- **No replacement repository.** This is the canonical implementation authority.
  Do not create, rename, migrate, or fork implementation elsewhere.
- **Local-first.** No learner accounts, no advertising, no marketing trackers, no
  remote learner telemetry, no runtime LLM calls, no remote upload of learner
  work. No remote service is required to play.

## Architecture in one paragraph

Planetary Survey is a deterministic, source-backed science application with a
game-quality presentation layer. A **pure TypeScript domain layer** owns
scientific truth, units, mission state, evidence records, claim evaluation,
deterministic seeds, and scoring — and depends on nothing else. **React** owns
the semantic application shell, mission controls, evidence notebook, and
accessible equivalents. **Babylon.js** is a presentation/input adapter that owns
the scene, camera, and render loop. React never drives the 3D frame loop;
Babylon never decides a measurement. The layers communicate only through typed
snapshots, intents, and events.

Full detail: [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md).

## Technology

Families are frozen by PS-01; **exact versions are resolved and pinned by PS-02**
in `package.json` plus a committed lockfile.

| Area | Family | Baseline |
|---|---|---|
| Language | TypeScript | 6.0.x (see `docs/TECHNOLOGY_DECISIONS.md` §2 for why not 7) |
| UI shell | React / React DOM | 19.3.x |
| Build | Vite | 8.3.x |
| 3D renderer | Babylon.js (`@babylonjs/core`, `@babylonjs/loaders`) | 9.28.x |
| Required renderer baseline | WebGL2 | required |
| Enhancement renderer | WebGPU | optional, never required |
| Unit/contract tests | Vitest | 5.0.x |
| Browser/E2E | Playwright | 1.63.x |
| Accessibility automation | `@axe-core/playwright` | 4.13.x |
| Lint | ESLint + typescript-eslint | 10.11.x / 8.70.x |
| Toolchain runtime | Node.js | 24.x |
| 3D asset format | glTF 2.0 / GLB | required |
| Texture format | KTX2 / Basis Universal | preferred |
| Audio | browser-native Web Audio behind a game-owned service | no FMOD |

## Repository layout

```text
src/
  domain/     pure TypeScript science/mission authority (no React, no Babylon, no DOM)
  content/    authored bodies/missions/claims + schemas
  renderer/   Babylon adapter: scene, camera, materials, asset loading, instrumentation
  ui/         React semantic application shell
  audio/      game-owned audio service
  assets/     runtime asset manifests, loaders, quality profiles
  platform/   capability detection, environment, quality-tier resolution
  styles/     design tokens and global foundations
  testing/    shared deterministic fixtures
docs/         binding product/science/architecture contract
scripts/      architecture, privacy, provenance, and release-manifest checks
tests/
```

`src/domain/` is a leaf module: it must not import React, Babylon, DOM APIs,
`fetch`, `Math.random`, or `Date.now`. This is enforced by an automated
architecture check.

## Development commands

**Established by PS-02.** This section will list the authoritative local
commands as soon as the package is bootstrapped. PS-01 defines the command set
that PS-02 must provide, and local and CI verification must call the same scripts:

```text
install          install from the committed lockfile
typecheck        tsc --noEmit
lint             eslint .
test             vitest run            (unit / contract / deterministic fixtures)
test:e2e         build + playwright     (real-browser renderer smoke + E2E)
test:a11y        axe-core checks
check:architecture   domain import-boundary enforcement
check:privacy        runtime dependency + network surface enforcement
check:assets         source-art vs shipping-asset separation
build            production build (must work under a nested base path)
verify           the aggregate local gate
```

Local correctness comes first; cloud CI is evidence, not the only way to verify
work.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | product vision, learner, core loop, v1 scope, non-goals, body criteria |
| [`docs/SCIENCE_MODEL.md`](docs/SCIENCE_MODEL.md) | NGSS matrix, learning objectives, source authority, simplification policy |
| [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md) | architecture, layer boundaries, data flow, state ownership, hosting boundary |
| [`docs/TECHNOLOGY_DECISIONS.md`](docs/TECHNOLOGY_DECISIONS.md) | technology ADR, version policy, rejected technologies |
| [`docs/RENDERING_QUALITY_STRATEGY.md`](docs/RENDERING_QUALITY_STRATEGY.md) | renderer baseline, WebGPU policy, quality tiers, atmosphere policy, asset loading |
| [`docs/UX_USER_FLOW.md`](docs/UX_USER_FLOW.md) | the 11-step first-user path and mission state model |
| [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) | accessibility contract and precedence rules |
| [`docs/PERFORMANCE_AND_DEVICE_BUDGETS.md`](docs/PERFORMANCE_AND_DEVICE_BUDGETS.md) | measurable load, frame, memory, and device budgets |
| [`docs/BENCHMARK_RUBRIC.md`](docs/BENCHMARK_RUBRIC.md) | frozen comparator rubric and review dimensions |
| [`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md) | asset pipeline and provenance policy |
| [`docs/PRIVACY_AND_PERSISTENCE.md`](docs/PRIVACY_AND_PERSISTENCE.md) | local-first privacy contract and persistence rules |
| [`docs/RELEASE_CONTRACT.md`](docs/RELEASE_CONTRACT.md) | games-site host, promotion, and rollback contract |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | frozen decision log |
| [`docs/ACCEPTANCE_EVIDENCE_MATRIX.md`](docs/ACCEPTANCE_EVIDENCE_MATRIX.md) | per-story required evidence |
| [`docs/STATUS.md`](docs/STATUS.md) | current phase and open dependencies |

## Scientific sourcing

Every displayed scientific value must be traceable to an authoritative source —
NASA/JPL, NASA planetary resources, USGS Astrogeology, or an equivalent primary
authority — recorded per field in the source register.

Rules that are not negotiable:

- a value with no register entry cannot ship;
- previously known values are not exempt from sourcing;
- imagery illustrates a sourced value and is never the source of it;
- simplifications are licensed with a source, rationale, model boundary, and a
  learner-facing explanation;
- NASA/USGS branding is not part of this product's identity, and the game must not
  appear officially sponsored or endorsed by any agency.

See [`docs/SCIENCE_MODEL.md`](docs/SCIENCE_MODEL.md) and
[`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md).

## Contributing rules

- Do not work directly on `main`; use a focused branch scoped to one Jira issue.
- Read `GAME-362`, the target child issue, its direct blockers, and current `main`
  before editing.
- Repository state is implementation authority; Jira is work/scope authority.
- Do not implement a downstream issue while an unresolved blocker can change its
  contract.
- No unrelated cleanup in a scoped change.
- Never claim human playtest, accessibility review, originality review, or
  science sign-off from automated evidence.
