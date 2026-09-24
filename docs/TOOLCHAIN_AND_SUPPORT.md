# Planetary Survey — Toolchain, Dependency, and Browser Support Policy

Status: established by GAME-364 / PS-02
Jira: GAME-362 (Epic), GAME-364 (PS-02)
Authority: implements D-03, D-05, D-08, and D-19/D-20/D-21 in
[`DECISIONS.md`](DECISIONS.md). Product and architecture authority remains
[`PRD.md`](PRD.md) and [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md).

This document exists because "we pin our dependencies" and "we support modern
browsers" are not verifiable statements. Everything below is either mechanically
enforced or explicitly listed as NOT claimed.

---

## 1. Node.js runtime

| Fact | Value | Where it is recorded |
|---|---|---|
| Required Node major | **24.x** | `.nvmrc`, `.node-version`, `engines.node` |
| Verified on | 24.15.0 | this repository's session evidence |
| Package manager | **npm** | `package-lock.json` is the only lockfile |

Three files state the same version on purpose. `.nvmrc` is what `nvm use` and
`actions/setup-node`'s `node-version-file` read; `.node-version` is what `asdf`,
`fnm`, and `volta` read; `engines.node` is what npm itself refuses to violate.
A developer on Node 22 should get a clear failure rather than a subtly different
build.

**Policy:** the Node major is bumped deliberately, in its own change, with a full
`npm ci && npm run verify && npm run test:e2e && npm run test:host` run recorded in
the pull request. It is never floated.

---

## 2. Dependency version policy

**Every runtime and development dependency is pinned exactly.** There are no caret
(`^`) or tilde (`~`) ranges in `package.json`.

The reason is not tidiness. This project's correctness claims are about *specific*
renderer behaviour: whether Babylon's `WebGPUEngine.IsSupportedAsync` agrees with
the capability probe, whether `attachControl` adds a `tabindex`, and exactly what
the eager and lazy chunks weigh. A floating range means two developers — or a
developer and CI — can be running different renderers while both reporting "tests
pass". That turns the whole evidence trail into a claim about an unknown version.

Therefore:

- `npm ci` installs the exact committed graph, and CI uses `npm ci` and nothing else.
- `package-lock.json` is committed and reviewed as part of any dependency change.
- A dependency upgrade is a deliberate, separately reviewed change that re-runs the
  full gate, including the real-browser suites. Upgrades are never bundled into
  feature work.
- Major families are frozen by PS-01 (`TECHNOLOGY_DECISIONS.md`); PS-02 resolved the
  exact pins within those families.

### Resolved pins at PS-02

| Area | Package | Pin |
|---|---|---|
| Language | `typescript` | 6.0.3 |
| UI shell | `react`, `react-dom` | 19.3.0 |
| Build | `vite` | 8.3.1 |
| 3D renderer | `@babylonjs/core`, `@babylonjs/loaders` | 9.28.0 |
| Unit tests | `vitest`, `@vitest/coverage-v8` | 5.0.1 |
| Browser tests | `@playwright/test` | 1.63.0 |
| Accessibility automation | `@axe-core/playwright` | 4.13.0 |
| Lint | `eslint`, `@eslint/js`, `typescript-eslint` | 10.11.0, 10.0.1, 8.70.1 |

**TypeScript is held at 6.0.x deliberately.** TypeScript 7.0.2 was evaluated and
excluded: `@typescript-eslint/utils` declares a peer range of `>=4.8.4 <6.1.0`, so
7.x has no supported lint toolchain. Adopting 7 would mean either linting with an
unsupported type resolution or disabling type-aware lint rules on a project whose
domain layer is *protected by* type-aware rules. See `TECHNOLOGY_DECISIONS.md` §2.

---

## 3. Browser support

### 3.1 The supported matrix

Support is defined by capability, not by user-agent sniffing. Any browser that
provides the baseline is supported; the app never gates on a brand or version string.

| Requirement | Status |
|---|---|
| WebGL2 | **Required.** The correctness baseline. |
| ES2022 modules | Required |
| `matchMedia` | Required for the reduced-motion preference |
| WebGPU | **Optional enhancement.** Never required, no capability may depend on it. |

v1 targets **desktop and laptop browsers** on the baseline above. School
Chromebook-class hardware is the design point for the `reduced` quality tier.

### 3.2 What is actually tested

Playwright runs the renderer and accessibility suites on **chromium, firefox, and
webkit** (`.github/workflows/ci.yml`). Firefox and WebKit are not decorative
entries: the WebKit run is what exposed a real defect in this repository — WebKit
excludes plain links from sequential focus navigation, so the skip link was
unreachable by keyboard and WCAG 2.4.1 "Bypass Blocks" did not hold. That was fixed
in application code, not waived.

### 3.3 Backend selection is honest

The capability probe can only *request* a backend. Only an async adapter request can
confirm WebGPU, and browsers routinely expose `navigator.gpu` while being unable to
supply an adapter. So:

- the renderer reports the backend it **settled on**;
- the System check displays *in use* and *requested* as separate facts;
- the `high` quality tier requires a **confirmed** backend, never mere API presence.

Reporting the request as fact previously displayed "webgpu" while rendering on
WebGL2, and escalated an unusable-WebGPU machine to the most expensive tier. Both
are now covered by regression tests in a real browser.

### 3.4 Explicitly NOT claimed

To keep the evidence honest, PS-02 claims none of the following. They belong to
later stories:

- **No real-GPU visual or performance claim.** Headless WebGL on CI is ANGLE +
  SwiftShader software rasterization. It proves the renderer *works*; it cannot
  measure frame pacing, and it must never be cited as visual-quality evidence
  (`PERFORMANCE_AND_DEVICE_BUDGETS.md` §2.3).
- **No device-matrix qualification.** Real school-laptop, tablet, and low-end
  hardware review is PS-12/PS-14.
- **No mobile/touch sign-off.** Touch support is designed in; it is not yet reviewed.
- **No assistive-technology sign-off.** Automated axe checks are coverage, never
  approval (`ACCESSIBILITY.md` §6). Manual keyboard, screen-reader, and low-vision
  review is PS-07/PS-14.
- **No Safari-version floor.** The WebKit engine build used in CI is not a proxy for
  a specific shipping Safari version.

---

## 4. Changing any of this

Any change to Node major, a pinned dependency, the quality-tier policy, or the
supported matrix requires:

1. a full local gate run recorded in the pull request;
2. the real-browser suites re-run on all three engines;
3. `docs/DECISIONS.md` updated if the change contradicts a frozen decision.

A dependency bump is never "just a version bump" in this repository.
