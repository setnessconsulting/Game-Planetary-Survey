# Planetary Survey — Status

Last updated: 2026-09-25
Jira Epic: `GAME-362`
Canonical repository: `setnessconsulting/Game-Planetary-Survey` (`main`)

---

## Current phase

**Current phase: production visual and audio assets (PS-10) complete on canonical main — PS-09 satisfied the hard gate before content expansion, and PS-10 removed the last placeholder from the build.**

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
  impossible or uncited values (**PS-03**, [`SOURCE_REGISTER.md`](SOURCE_REGISTER.md));
- the canonical v1 content: 5 worlds, 11 values each cited to a named register
  record, 4 missions with completion paths and claim targets, and 7 licensed
  simplifications with learner text (**PS-04**, register version `ps-04.0.0`);
- the design source of truth: 57 tokens that each state their purpose, a generated
  stylesheet with a drift check, 13 measured contrast pairs, and a surface
  inventory covering every step of the frozen loop (**PS-DESIGN**,
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md));
- the Babylon planetary renderer foundation: GLB/KTX2 asset pipeline, camera and
  scale modes, typed render contract, and authored-mission load in the shell
  (**PS-05** / GAME-369);
- instrument selection, observe/measure, and evidence capture wired through the
  shell on the existing domain contracts (**PS-06** / GAME-370);
- comparison board with table-first findings, optional chart twin, and expanded
  a11y coverage through compare (**PS-07** / GAME-371);
- the full claim loop on the domain contracts: a structured, evaluable claim form,
  explicit evidence citation counted as a learner choice, submit and evaluation, a
  debrief built from the mission's own source-traceable facts, a bounded completion
  summary, progressive content-driven hints, and revision that reopens the claim in
  place (**PS-08** / GAME-372);
- the qualified guided-mission vertical slice: one complete mission playable brief to
  completion in a real browser on the required WebGL2 baseline, with the same loop
  proven with no 3D backend at all, an axe scan at every phase, a software-rendered
  performance baseline written as an artefact, and a build-time gate that every
  shipped mission is playable to a met target along its own authored path
  (**PS-09** / GAME-373, [`SLICE_QUALIFICATION.md`](SLICE_QUALIFICATION.md));
- the production art and audio pipeline: per-body GLB meshes with LODs, albedo and
  normal-map textures, a prefiltered HDR environment, calibrated PBR and exposure
  with each body proven perceptually distinguishable, the renderer reading the
  motion tokens, a complete audio service with a real cue inventory and mute on by
  default, and a populated provenance manifest enforced by the asset gate
  (**PS-10** / GAME-374, [`ART_DIRECTION.md`](ART_DIRECTION.md)).

Authored missions load into the workstation. Learners can select a mission-offered
instrument, measure with honest unavailable paths, capture evidence, compare worlds
on a semantic table, draft a claim, cite the evidence behind it, submit it for
evaluation, read a sourced debrief, and finish the mission — revising in place if
their citation or reasoning fell short, and going back to measure a world the
mission's target still needs. The worlds they survey now carry their own production
art rather than a shared placeholder sphere, lit by a prefiltered environment and
calibrated so that no two worlds look alike, with optional sound that is off by
default and never the only carrier of anything. Target-age qualification, human
visual review, and GPU-qualified performance evidence remain outstanding.
Independent science review remains outstanding.

**No independent science review has occurred.** Every value is transcribed from an
agency source and machine-checked for physical plausibility; none has been checked
by a human against that source. [`SCIENCE_REVIEW_PACKET.md`](SCIENCE_REVIEW_PACKET.md)
is the material prepared for that review, and
`ACCEPTANCE_EVIDENCE_MATRIX.md` forbids automation from claiming it.

## Story state

| Jira | Story | State | Notes |
|---|---|---|---|
| GAME-363 | PS-01 — contract freeze | **complete** | this `docs/` set |
| GAME-364 | PS-02 — executable foundation | **complete** | verified gate, real-browser renderer smoke, CI |
| GAME-365 | PS-HOST — games-site host contract | **complete** | preview and production pointers distinct; production unavailable |
| GAME-366 | PS-03 — data/source registry | **complete** | source-of-truth layer |
| GAME-367 | PS-DESIGN — design system + preproduction | **complete** (in-repo equivalent; no Figma file — see constraint 3) | tokens, surfaces, breakpoints, motion, accessibility mapping |
| GAME-368 | PS-04 — canonical bodies/missions | **implemented; science review outstanding** | content authored and sourced; see constraint 1 |
| GAME-369 | PS-05 — Babylon renderer foundation | **complete** | GAME-369; real-browser renderer evidence; science/visual review not claimed |
| GAME-370 | PS-06 — instruments/evidence capture | **complete** | GAME-370; instrument → measure → capture in shell; science review not claimed |
| GAME-371 | PS-07 — notebook/comparison/a11y equivalents | **complete** | GAME-371; comparison board + a11y through compare; science/visual review not claimed |
| GAME-372 | PS-08 — mission engine/claim/citation/debrief | **complete** | GAME-372; claim → cite → submit → debrief → complete in the shell; constraints 6–7 closed; science/visual review not claimed |
| GAME-373 | PS-09 — guided-mission vertical slice | **complete** | GAME-373; guided mission qualified end to end in a real browser; D-40 fixed the unenforced mission target the slice found; science/visual/playtest review not claimed |
| GAME-374 | PS-10 — visual/motion/audio polish | complete | GAME-374; production art for all five bodies, calibrated PBR/HDR, motion conformance, complete audio service with mute, provenance manifest populated; art is original and generated — human visual sign-off not claimed |
| GAME-375 | PS-11 — independent missions/depth | ready | unblocked by PS-09 |
| GAME-376 | PS-12 — consolidated qualification | blocked | by PS-10 + PS-11 |
| GAME-377 | PS-13 — immutable preview candidate | blocked | by PS-12 |
| GAME-378 | PS-14 — comparator/human review | blocked | by PS-13 |
| GAME-379 | PS-PROMOTE — promotion + rollback | blocked | by PS-14 |
| GAME-380 | former PS-15 | **Wont Do** | LevelBest excluded; retained as planning history only |
| GAME-381 | PS-16 — reconciliation/closeout | blocked | by PS-PROMOTE |

## Open dependencies and known constraints

1. **Independent science review of the v1 content.** The register now holds 11
   entries with citations for every displayed value, and the mechanism that keeps
   them complete is enforced. What is missing is human review: every entry is
   `unreviewed` except one `contested`, every body carries `scienceReviewed: false`,
   and D-14 delegated the v1 body/claim freeze to PS-04 *after* source-based
   science review. PS-04 prepared
   [`SCIENCE_REVIEW_PACKET.md`](SCIENCE_REVIEW_PACKET.md) for that review and did
   not perform it. `catalogueIsScienceReviewed()` is what PS-11 and PS-14 read, and
   it reports `false` today.

2. **Dependency version pins.** Resolved and pinned exactly, with a committed
   lockfile (`DECISIONS.md` D-20). A dependency change is a separately reviewed
   change that re-runs the whole gate, including the real-browser suites.

3. **No design file, and no human visual review of the design direction.** PS-DESIGN
   delivered the handoff in the repository instead of as a Figma file, because that
   form is machine-checkable and versioned with the code; `DESIGN_SYSTEM.md` §1
   states plainly what that trade gives up — fast visual exploration, and a canvas a
   human can look at and approve. Nothing about the current visual direction has
   been reviewed or approved by a person. PS-09 qualified the slice technically and
   did **not** close this: human visual sign-off and target-age legibility evidence
   are PS-14's, and the slice's own performance numbers are software-rendered until
   PS-12 measures them on a real GPU or representative device
   ([`SLICE_QUALIFICATION.md`](SLICE_QUALIFICATION.md) §6).
   [`ACCEPTANCE_EVIDENCE_MATRIX.md`](ACCEPTANCE_EVIDENCE_MATRIX.md) records the
   absent artefacts.

4. **games-site positional parameter.** `isApprovedRelease` gained an eighth
   positional argument for the preview pointer in PS-HOST. It works and is tested,
   but the call site is positional rather than named. Recorded as technical debt
   for a later, separately scoped cleanup — it is not a release blocker.

5. **Freshness thresholds are defaults, not a policy decision.** Two and five
   years (`SOURCE_REGISTER.md` §7.3) are reasoned defaults carried as data. If a
   reviewer wants a different re-retrieval cadence, it is a one-line change, but
   nobody has yet signed off on a cadence as a science decision.

6. **Constraint 6 — the missing debrief/completion transition — is resolved.**
   `openDebrief` and `completeMission` now move an evaluated claim into `debrief` and
   then `complete`, so a mission can finish. The trace suite that used to pin the
   boundary now exercises the end of the loop instead. Recorded as D-35.

7. **Constraint 7 — revision forcing a redundant measurement — is resolved.**
   `reviseClaim` reopens the claim in `claimDrafting` and keeps the notebook and the
   drafted claim, so fixing an incomplete citation costs no extra instrument
   reading. Recorded as D-36.

## Recorded decisions

PS-01 decisions are closed (`DECISIONS.md` D-01…D-18); PS-02 and PS-03 added
D-19…D-27; PS-04 added D-28…D-31; PS-DESIGN added D-32 and D-33; PS-05 added
D-34; PS-08 added D-35…D-39 (mission completion semantics, in-place revision,
named-credit scoring, progressive hints, and the debrief as a domain artefact);
PS-09 added D-40 (a met mission target requires the mission's own
`claimTarget.requiredEvidence` to be cited, not only a supported claim); PS-10 added
D-41…D-44 (original generated production art with a generated provenance manifest,
PNG textures because the approved dependency set cannot decode KTX2, audio on by
default and every cue carrying a non-audio equivalent, and the renderer reading the
motion tokens while the atmosphere shell stays a labelled representation). The
outstanding-decision audit remains D-18: **no unresolved owner decision can
materially change the runtime architecture or the v1 learning loop.**

D-28 was the one worth flagging. Learner-facing text is the first place in the
product where a number is *derived* rather than cited, so no provenance gate can
catch it being wrong. The response was to make content depend on the formula
register and to recompute every quoted derived number in test — which means a
hand-typed figure in a feedback sentence is now a build failure rather than a
science finding.

## Explicit non-goals reminder

- No LevelBest work of any kind.
- No replacement/renamed/migrated repository.
- No learner accounts, analytics, advertising, telemetry, runtime LLM calls, or
  remote upload of learner work.
- No production promotion before PS-PROMOTE.
