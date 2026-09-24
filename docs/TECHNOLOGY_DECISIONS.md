# Planetary Survey — Technology Decisions

Status: binding PS-01 decision record
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24
Evidence checks performed: 2026-09-24 against the public npm registry and the
typescript-eslint dependency-support contract.

This record freezes the **technology families and boundaries**. Exact pins are
owned by PS-02 (`GAME-364`), which must resolve and commit them in
repository-controlled `package.json` / lockfile rather than copying any version
string from a planning document.

---

## 1. Runtime baseline

| Technology | Family baseline | Role | Allowed boundary | Decision |
|---|---|---|---|---|
| TypeScript | 6.0.x | all application and domain source | everywhere | required |
| React | 19.3.x | semantic application shell, mission UI, notebook, accessible controls | `src/ui/` | required |
| React DOM | 19.3.x | DOM renderer | `src/ui/` | required |
| Vite | 8.3.x | dev server and production build | tooling | required |
| Babylon.js `@babylonjs/core` | 9.28.x | 3D planetary renderer, scene, camera, render loop | `src/renderer/` | required |
| Babylon.js `@babylonjs/loaders` | 9.28.x | glTF/GLB loading | `src/renderer/` | required |
| Zod | 4.6.x | validation of late-bound / untrusted data only | `src/content/`, persistence adapter | conditional (§5) |

### 1.1 Development / test baseline

| Technology | Family baseline | Role |
|---|---|---|
| Node.js | 24.x | repo and CI toolchain runtime (aligns with current Setness standalone-game repos) |
| Vitest | 5.0.x | unit, contract, and deterministic fixture tests |
| Playwright | 1.63.x | real-browser smoke, E2E, WebGL2/WebGPU path checks |
| `@axe-core/playwright` | 4.13.x | automated accessibility checks |
| ESLint | 10.11.x | lint |
| typescript-eslint | 8.70.x | TypeScript lint integration |
| `@vitejs/plugin-react` | 6.1.x | React/Vite integration |
| jsdom | 30.x | unit-test DOM environment (never a rendering-fidelity authority) |

## 2. TypeScript version decision (D-03)

**Decision: begin on TypeScript 6.0.x, not TypeScript 7.**

Verified on 2026-09-24:

- `typescript` `latest` is **7.0.2**; the highest stable 6.x is **6.0.3**.
- `typescript-eslint` (current 8.70.x) declares its TypeScript peer as
  **`>=4.8.4 <6.1.0`** via `@typescript-eslint/utils` / `@typescript-eslint/typescript-estree`.
- TypeScript 7.0.2 therefore sits **outside** the currently supported
  typescript-eslint window.

Rationale: a fully supported lint + typecheck toolchain is worth more than
adopting a newer compiler immediately. Suppressing an unsupported-version warning
to get TypeScript 7 is explicitly not permitted.

PS-02 pins the exact 6.0.x patch. The upgrade to TypeScript 7 is a planned future
change gated on §9.

## 3. Language and styling

- TypeScript **strict mode**, ESM, `moduleResolution` per the Vite template used
  by PS-02.
- Production modules must not be untyped JavaScript. A tooling-only `.mjs`
  script (architecture/privacy/manifest checks) may remain JavaScript because it
  runs in Node before the build, not in the app runtime.
- Styling: **CSS Modules** for component styles, **CSS custom properties** for
  design tokens, one small global reset/foundation layer.
- Tokens must explicitly cover type scale, spacing, elevation, **focus**,
  motion, and semantic scientific states (including non-color encodings).
- Do **not** add Tailwind, Bootstrap, Material UI, or any other UI framework for
  implementation convenience. Planetary Survey needs an authored instrument/
  workstation visual system, not a component library's default look.
- No CSS-in-JS runtime.

## 4. State management

- **Pure TypeScript domain transitions** are the only science/game authority.
- React state, reducers, and context are used **only** for UI orchestration,
  focus management, and preference flags.
- Frame-by-frame Babylon state is **never** React state (see
  `TECHNICAL_DESIGN.md` §4).

Not approved for v1:

- Redux, Zustand, XState, MobX, Jotai, Recoil, or any general state framework;
- any ECS library;
- any "framework" whose primary value is state plumbing.

Introducing one requires an ADR with a **measured** complexity or testability
benefit against the pure-transition baseline, plus full verification.

## 5. Data validation

Two distinct data paths, deliberately separated:

1. **Authored, bundled content** (bodies, missions, schemas) is authored as
   **typed TypeScript modules**, validated at **build time** by `tsc` and at
   **test time** by contract tests. Compile-time validation is stronger and
   cheaper than runtime parsing for data that ships with the build.
2. **Late-bound / untrusted data** — persisted local preferences or resume state,
   and any content loaded at runtime as JSON rather than as a typed module — is
   validated with an explicit **Zod** schema that fails closed.

Rules:

- Zod is **not** permitted in `src/domain/` (the domain must be dependency-free
  pure TypeScript) or in `src/renderer/`.
- Zod must not be pulled into the **initial eager bundle**. If used at all, it
  belongs to the code-split content/persistence chunk so it cannot threaten the
  first-interactive-load budget.
- Invalid authored content fails **loudly in development** and produces a
  bounded, learner-legible recovery state in production. It never silently
  degrades into a different lesson.
- No schema library may become the science authority. Schemas describe shape;
  the domain layer owns meaning.

## 6. 3D rendering

Babylon.js 9 is the primary and only approved 3D renderer for v1.

Band rationale (recorded in GAME-362, restated for completeness):

- the core interaction is interactive 3D inspection of spherical worlds;
- a mature scene system, PBR/glTF workflow, and browser-native delivery are
  required;
- Phaser is strong for 2D but not a 3D renderer;
- Unity WebGL adds build/runtime weight without a v1 requirement;
- Three.js / React Three Fiber is viable but would require more custom
  game/scene infrastructure for this product.

Babylon is a **presentation and input adapter**. It is never scientific truth.
Full boundary contract: `TECHNICAL_DESIGN.md` §4 and
`RENDERING_QUALITY_STRATEGY.md`.

### 6.1 Renderer backend policy

- **WebGL2 is the required correctness baseline** across the supported browser
  matrix. Every mission must be completable and every required measurement
  obtainable on WebGL2.
- **WebGPU is an enhancement path.** It may raise presentation quality; it may
  not gate a mission, a measurement, an evidence record, a claim outcome, or an
  accessible equivalent.
- The runtime must detect capability and select a compatible path **without
  changing domain/game behaviour** (see `TECHNICAL_DESIGN.md` §6).
- A failed or unsupported renderer initialization must degrade **honestly and
  visibly**, never into a blank viewport or a fake success.

## 7. Audio

- Browser-native **Web Audio** behind a **game-owned audio service**.
- **FMOD is not approved for v1.** It may only be revisited through a separate
  ADR/spike proving a real adaptive-audio requirement that this architecture
  cannot reasonably satisfy.
- The service must expose master/music/ambience/SFX buses, mute, pause/resume,
  visibility handling, preload/stream policy, and non-audio equivalents for every
  essential cue.
- Details: `TECHNICAL_DESIGN.md` §9 and `ACCESSIBILITY.md`.

## 8. Design and asset tooling (not runtime dependencies)

| Tool | Role | Runtime dependency? |
|---|---|---|
| Figma | production UI/interaction design authority once a real file/version is linked | **No** |
| Blender | source-art/DCC path for probe/props/meshes, UVs, cleanup, baking, LOD generation, format conversion | **No** |
| glTF 2.0 / GLB | shipping runtime 3D asset format | Yes (via Babylon loaders) |
| KTX2 / Basis Universal | preferred compressed texture delivery | Yes (via Babylon texture loaders) |

Repository **runs without Blender and without a Figma file linked**. Those tools
support production; they are not build prerequisites. Until a real Figma
file/version is linked, repository wireframes are illustrative and cannot claim
visual approval.

## 9. Package-version policy

1. **PS-02 resolves and pins exact versions** for mutual compatibility, in
   `package.json` plus a committed lockfile. Planning-document version strings
   are a family baseline, never a pin.
2. **Committing the lockfile is mandatory.** Install in CI uses the lockfile, not
   a floating range.
3. Where a package has a required peer (for example React Testing Library's DOM
   peer, or Babylon loader packages against `@babylonjs/core`), PS-02 pins a
   **compatible peer version**, not a range.
4. All Babylon packages must be pinned to the **same 9.28.x version** —
   mismatched Babylon core/loader versions are a known source of runtime failure.
5. **The lockfile is authoritative after PS-02 lands.**
6. After the production vertical slice (PS-09), dependency changes require a
   dedicated change carrying: motivation, compatibility review, full
   verification, and regenerated exact-SHA evidence where applicable.
7. **"A newer version exists" is not sufficient justification** for an upgrade.
8. Security-driven upgrades may proceed ahead of §6 with a recorded rationale and
   full re-verification.

## 10. Upgrade gates

### 10.1 TypeScript 7 gate

Do not upgrade to TypeScript 7 while the active typescript-eslint support range
excludes it. The upgrade requires all of:

- official typescript-eslint support for TypeScript 7;
- clean lint and typecheck across the full repository;
- no suppression of unsupported-version warnings;
- full PS-12 verification re-run and evidence regenerated.

### 10.2 React / Vite major gate

A React or Vite major upgrade requires an ADR plus a full re-verification,
including the real-browser renderer smoke test and the accessibility suite.

### 10.3 Babylon major gate

A Babylon **major** upgrade requires an ADR covering: renderer boundary impact,
shader/material compatibility, WebGL2 fallback behaviour, asset-loading
compatibility, and re-measured performance budgets.

## 11. CI

GitHub Actions is the automation authority, but **local correctness comes first**:
every authoritative check must be runnable locally with documented commands, and
cloud minutes must not be spent discovering failures that reproduce locally.

CI is **credential-free** and must not require a game runtime backend. Baseline
job set (established by PS-02):

- install from lockfile;
- typecheck;
- lint;
- unit / contract / deterministic fixture tests;
- domain import-boundary check;
- production build;
- privacy/network-surface check;
- real-browser renderer smoke test.

## 12. Explicitly rejected for v1

Unless a new Jira requirement plus an ADR establish otherwise:

- Phaser, PixiJS, Three.js, React Three Fiber;
- Unity / Unity WebGL;
- Godot, Unreal;
- any second 3D engine alongside Babylon;
- FMOD and Wwise;
- Rive / Lottie as required runtime dependencies;
- Supabase, Firebase, or any hosted backend;
- learner accounts, auth, or server-side save;
- analytics, advertising, or marketing SDKs;
- any runtime LLM/AI API;
- remote learner telemetry;
- general state frameworks (§4);
- CSS frameworks / component libraries (§3);
- 3D Tiles or streamed planetary terrain (§12.1);
- LevelBest integration of any kind.

### 12.1 3D Tiles / streamed terrain — rejected for v1

Rejected because v1 mission design does not require seamless high-detail
planetary-surface traversal. Adding it would introduce heavy infrastructure with
no requirement behind it. Re-opening this requires a PS-05 ADR grounded in a real
mission need. See `TECHNICAL_DESIGN.md` §5.

## 13. Version evidence checked (2026-09-24)

- `typescript` npm dist-tags: `latest` 7.0.2; highest stable 6.x 6.0.3
- `@typescript-eslint/utils` peer: `typescript: >=4.8.4 <6.1.0`
- `react` / `react-dom`: 19.3.0
- `vite`: 8.3.1
- `@babylonjs/core` / `@babylonjs/loaders`: 9.28.0
- `vitest` / `@vitest/coverage-v8`: 5.0.1
- `@playwright/test`: 1.63.0
- `@axe-core/playwright`: 4.13.0
- `eslint`: 10.11.0; `typescript-eslint`: 8.70.1
- `@vitejs/plugin-react`: 6.1.1
- `zod`: 4.6.5
- `jsdom`: 30.x
- Node.js current line: 24.x (toolchain)

PS-02 must re-verify these at implementation time and pin the exact resolved set.
This table is evidence of the family baseline, not a pin list.
