# Planetary Survey — Status

Last updated: 2026-09-24
Jira Epic: `GAME-362`
Canonical repository: `setnessconsulting/Game-Planetary-Survey` (`main`)

---

## Current phase

**Contract frozen (PS-01). Executable foundation not yet built.**

The repository contains the binding product, science, architecture, UX,
accessibility, performance, provenance, and release contract in `docs/`. There is
no application code and no playable build yet. The application skeleton,
toolchain, boundary checks, and real-browser renderer smoke test land in **PS-02
(`GAME-364`)**.

## Story state

| Jira | Story | State | Notes |
|---|---|---|---|
| GAME-363 | PS-01 — contract freeze | **complete** | this `docs/` set |
| GAME-364 | PS-02 — executable foundation | next | blocked by PS-01 only |
| GAME-365 | PS-HOST — games-site host contract | blocked | by PS-02; see dependency below |
| GAME-366 | PS-03 — data/source registry | blocked | by PS-02 |
| GAME-367 | PS-DESIGN — Figma preproduction | blocked | by PS-02 |
| GAME-368 | PS-04 — canonical bodies/missions | blocked | by PS-03 |
| GAME-369 | PS-05 — Babylon renderer foundation | blocked | by PS-03 + PS-DESIGN |
| GAME-370 | PS-06 — instruments/evidence capture | blocked | by PS-04 + PS-05 |
| GAME-371 | PS-07 — notebook/comparison/a11y equivalents | blocked | by PS-06 |
| GAME-372 | PS-08 — mission engine/scoring/debrief | blocked | by PS-04 + PS-07 |
| GAME-373 | PS-09 — guided-mission vertical slice | blocked | hard gate before content expansion |
| GAME-374 | PS-10 — visual/motion/audio polish | blocked | by PS-09 |
| GAME-375 | PS-11 — independent missions/depth | blocked | by PS-09 |
| GAME-376 | PS-12 — consolidated qualification | blocked | by PS-10 + PS-11 |
| GAME-377 | PS-13 — immutable preview candidate | blocked | by PS-12 |
| GAME-378 | PS-14 — comparator/human review | blocked | by PS-13 |
| GAME-379 | PS-PROMOTE — promotion + rollback | blocked | by PS-14 |
| GAME-380 | former PS-15 | **Wont Do** | LevelBest excluded; retained as planning history only |
| GAME-381 | PS-16 — reconciliation/closeout | blocked | by PS-PROMOTE |

## Open dependencies and known constraints

1. **games-site preview vs. production availability.** The current games-site
   catalog validator rejects a `release` on a `coming-soon` entry and requires one
   on a `playable` entry. That makes "preview reachable" and "production
   unavailable" hard to express separately for a game with no promoted release.
   **Owner: PS-HOST (`GAME-365`).** Recorded in
   [`RELEASE_CONTRACT.md`](RELEASE_CONTRACT.md) §7.1. This does not block PS-02.

2. **Dependency version pins.** PS-01 freezes families; PS-02 must resolve and pin
   exact mutually compatible versions and commit a lockfile. Planning version
   strings must not be used as pins.

3. **Figma file.** No production Figma file/version is linked yet. Until
   PS-DESIGN records one, repository wireframes are illustrative and cannot claim
   visual approval.

4. **Source register.** Does not exist yet; PS-03 builds it and PS-04 populates
   it. Until then, no body value may be displayed in a shipping build.

## Recorded decisions

All PS-01 decisions are closed; see [`DECISIONS.md`](DECISIONS.md). The
outstanding-decision audit is `DECISIONS.md` D-18, which records that **no
unresolved owner decision can materially change the runtime architecture or the
v1 learning loop**.

## Explicit non-goals reminder

- No LevelBest work of any kind.
- No replacement/renamed/migrated repository.
- No learner accounts, analytics, advertising, telemetry, runtime LLM calls, or
  remote upload of learner work.
- No production promotion before PS-PROMOTE.
