# Planetary Survey — Status

Last updated: 2026-09-24
Jira Epic: `GAME-362`
Canonical repository: `setnessconsulting/Game-Planetary-Survey` (`main`)

---

## Current phase

**Executable foundation and source-of-truth layer complete. No playable build yet.**

The repository contains:

- the binding product, science, architecture, UX, accessibility, performance,
  provenance, release, and toolchain contract in `docs/`;
- a running application skeleton with real-browser renderer evidence, boundary
  checks, a privacy-surface check, budget reporting, and a release manifest
  (**PS-02**);
- a games-site host contract that keeps preview and production pointers distinct
  (**PS-HOST**);
- the authoritative data layer: source register schema and policy, canonical
  units, formula-identified derived values, presentation scale/distortion
  metadata, deterministic mission-data snapshots, and validation that refuses
  impossible or uncited values (**PS-03**, [`SOURCE_REGISTER.md`](SOURCE_REGISTER.md)).

**There is still no playable build and no planetary value is shipped.** The body
catalogue and the source register are deliberately empty until PS-04 authors them
and takes them through independent science review, because an unreviewed citation
would look like provenance without being provenance.

## Story state

| Jira | Story | State | Notes |
|---|---|---|---|
| GAME-363 | PS-01 — contract freeze | **complete** | this `docs/` set |
| GAME-364 | PS-02 — executable foundation | **complete** | verified gate, real-browser renderer smoke, CI |
| GAME-365 | PS-HOST — games-site host contract | **complete** | preview and production pointers distinct; production unavailable |
| GAME-366 | PS-03 — data/source registry | **complete** | build the source-of-truth layer; register content arrives in PS-04 |
| GAME-367 | PS-DESIGN — Figma preproduction | ready | no open blocker; see constraint 3 |
| GAME-368 | PS-04 — canonical bodies/missions | next | by PS-03 |
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

1. **Source register content.** The register *mechanism* exists and is enforced,
   but it holds no entries and no body ships a value. PS-03 delivered the layer;
   PS-04 (`GAME-368`) authors the entries and the bodies, and owns independent
   science review. Until then, no body value may be displayed in a shipping build,
   and `validateBodiesAgainstRegister` fails the build if one appears uncited.

2. **Dependency version pins.** Resolved and pinned exactly, with a committed
   lockfile (`DECISIONS.md` D-20). A dependency change is a separately reviewed
   change that re-runs the whole gate, including the real-browser suites.

3. **Figma file.** No production Figma file/version is linked yet. Until
   PS-DESIGN records one, repository wireframes are illustrative and cannot claim
   visual approval.

4. **games-site positional parameter.** `isApprovedRelease` gained an eighth
   positional argument for the preview pointer in PS-HOST. It works and is tested,
   but the call site is positional rather than named. Recorded as technical debt
   for a later, separately scoped cleanup — it is not a release blocker.

5. **Freshness thresholds are defaults, not a policy decision.** Two and five
   years (`SOURCE_REGISTER.md` §7.3) are reasoned defaults carried as data. If a
   reviewer wants a different re-retrieval cadence, it is a one-line change, but
   nobody has yet signed off on a cadence as a science decision.

## Recorded decisions

PS-01 decisions are closed (`DECISIONS.md` D-01…D-18), and PS-02 and PS-03 added
D-19…D-27. The outstanding-decision audit remains D-18: **no unresolved owner
decision can materially change the runtime architecture or the v1 learning loop.**

## Explicit non-goals reminder

- No LevelBest work of any kind.
- No replacement/renamed/migrated repository.
- No learner accounts, analytics, advertising, telemetry, runtime LLM calls, or
  remote upload of learner work.
- No production promotion before PS-PROMOTE.
