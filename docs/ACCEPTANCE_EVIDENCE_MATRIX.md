# Planetary Survey — Acceptance and Evidence Matrix

Status: PS-01 implementation map
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

This matrix defines the **minimum evidence** expected before each story can be
treated as complete. Jira story descriptions remain the authority for full scope;
this table exists so that "done" always has an artifact attached to it.

---

| Jira | Story | Outcome | Required evidence |
|---|---|---|---|
| GAME-363 | PS-01 | frozen implementation contract | contract docs committed to the canonical repo; technology + comparator freeze; exact starting SHA; no unresolved owner decision (`DECISIONS.md` §D-18) |
| GAME-364 | PS-02 | executable standalone foundation | clean-clone install/typecheck/lint/test/build; domain import-boundary check; privacy-surface check; real-browser Babylon smoke; WebGL2 baseline proven; WebGPU detection proven not to affect domain; nested base-path build; CI green from the same scripts |
| GAME-365 | PS-HOST | games-site coming-soon + preview host contract | catalog entry; routes; host target documented and testable; preview vs production pointers distinct; production unchanged; `RELEASE_CONTRACT.md` §7.1 constraint resolved; games-site checks pass |
| GAME-366 | PS-03 | authoritative data/source registry and units | per-field source register for every body attribute; unit/normalization contracts with tests; deterministic domain model; provenance fixtures; no renderer/React/DOM imports in domain |
| GAME-367 | PS-DESIGN | Figma **or equivalent** preproduction design gate | design source of truth (Figma file key/version, or the in-repo equivalent); desktop/tablet/phone layouts; dense-data legibility study; motion/audio specs; accessibility annotations; comparator notes |
| GAME-368 | PS-04 | canonical bodies, missions, claims, golden fixtures | exact v1 bodies; sourced measurements; mission/claim/evidence schemas; golden fixtures; simplification register with learner text; **independent science review** |
| GAME-369 | PS-05 | Babylon renderer foundation | planet loading/LOD pipeline; camera/scale modes; typed render intents; quality tiers as data; capability probe; real-browser render evidence; domain unchanged by renderer state |
| GAME-370 | PS-06 | survey instruments and evidence capture | instrument models; measurement actions; evidence-capture contracts; deterministic measurement tests; accessible equivalents for each measurement |
| GAME-371 | PS-07 | evidence notebook, comparison, accessible equivalents | notebook/comparison board; charts plus real data-table equivalents; keyboard/touch operation; axe checks |
| GAME-372 | PS-08 | mission state machine, claim evaluation, scoring, debrief | state-machine tests; anti-guessing test (uncited claim rejected); separate scoring dimensions; debrief traceability; hints that do not answer; recovery paths |
| GAME-373 | PS-09 | guided-mission production vertical slice | complete guided mission; full loop playable end to end; science/UX/accessibility/real-render/performance evidence; **hard gate before content expansion** |
| GAME-374 | PS-10 | final visual/motion/audio polish + asset pipeline | final assets with provenance; PBR/HDR calibrated; motion/reduced-motion; audio service complete with mute; no placeholders; provenance manifest populated |
| GAME-375 | PS-11 | independent missions, depth, variants, balance, final science review | independent missions; additional bodies; seeded variants; balance evidence; **final science-content review**; target-age evidence |
| GAME-376 | PS-12 | consolidated qualification | exact-candidate unit/contract/E2E/accessibility/browser/real-render/performance/memory/privacy/provenance/build package; bundle and asset reports |
| GAME-377 | PS-13 | immutable non-production candidate published | exact SHA → immutable prefix; preview pointer configured; launcher/play/nested-asset/iframe checks; production still unavailable; recorded identities |
| GAME-378 | PS-14 | comparator, independent, science, accessibility, playtest review | every rubric dimension (`BENCHMARK_RUBRIC.md` §5) reviewed against the exact candidate; independent review; **target-age human playtest**; science + accessibility review; originality review; remediation closed |
| GAME-379 | PS-PROMOTE | production promotion + rollback | exact approved artifact promoted (no rebuild); live smoke of the full loop; rollback exercised and restored; evidence recorded |
| GAME-380 | former PS-15 | **Wont Do** — LevelBest excluded | not implemented; retained as planning history only |
| GAME-381 | PS-16 | final reconciliation and Epic closeout | exact SHAs/build identities; docs current; known limitations; release notes; Jira/games-site/repo describe the same state; no unresolved release blocker |

---

## Outstanding human evidence

### GAME-367 / PS-DESIGN — human visual sign-off is **not** delivered

GAME-367's criteria say "Figma **or equivalent** source-of-truth handoff". No Figma
file exists and none is linked; the equivalent is delivered in the repository. What
the equivalent does not provide is recorded rather than glossed:

| Required evidence | State |
|---|---|
| design source of truth with component/state inventory | delivered — `docs/DESIGN_SYSTEM.md` and `src/design/surfaces.ts`, 14 surfaces × states |
| desktop/tablet/phone layouts | delivered as declared breakpoints with per-breakpoint rules, and asserted against `UX_USER_FLOW.md` |
| dense-data legibility study | delivered as contract — token floor, `--ps-measure`, and 13 measured contrast pairs |
| motion/audio specs | motion delivered as a four-step hierarchy with a reduced-motion override per duration; audio cue inventory deferred to PS-10 |
| accessibility annotations | delivered as a required field per surface, mapped to every obligation in `ACCESSIBILITY.md` |
| comparator notes | delivered — `DECISIONS.md` D-15 plus the comparator boundary in `DESIGN_SYSTEM.md` §8 |
| **linked design file (Figma key/version)** | **absent** — no file exists |
| **human visual review of the direction** | **outstanding** — owned by PS-09 and PS-14 |

---

### GAME-368 / PS-04 — independent science review is **not** delivered

The GAME-368 row above requires independent science review. As of register version
`ps-04.0.0` that evidence does **not** exist, and no automated check may stand in
for it:

| Required evidence | State |
|---|---|
| exact v1 bodies | delivered — 5 bodies, one curator per compared property |
| sourced measurements | delivered — 11 values, every one cited to a named record |
| mission/claim/evidence schemas | delivered — enforced by `validateMissionDefinition` |
| golden fixtures | delivered — fixture and shipped-content digests pinned in test |
| simplification register with learner text | delivered — 7 entries, four required elements each |
| **independent science review** | **outstanding** — [`SCIENCE_REVIEW_PACKET.md`](SCIENCE_REVIEW_PACKET.md) |

One value is shipped as `contested` (the Moon's surface relief, where two agency
products disagree) and is excluded from every scored path. `catalogueIsScienceReviewed()`
reports `false`, and it is what PS-11 and PS-14 read.

---

### GAME-372 / PS-08 — mission engine, claim/citation/debrief, hints, and recovery

| Required evidence | State |
|---|---|
| state-machine tests | delivered — a legal/illegal transition table over every intent × phase, plus a no-dead-end proof |
| anti-guessing test (uncited claim rejected) | delivered — an uncited claim is `insufficient-evidence`; scoring reports `right-answer-uncited` without counting it |
| separate scoring dimensions | delivered — four `ClaimDimensions` plus a word-level outcome; no points, timer, streak, or rank exists in the type |
| debrief traceability | delivered — every `sourced` fact carries its register ids, and cited observations are named as supporting or refuting |
| hints that do not answer | delivered — `hintReveal` is ordered and pure; a hint changes only `hintsUsed` |
| recovery paths | delivered — in-place revision (D-36) and completion on any evaluated claim (D-35) |
| completion summary | delivered — bounded counts and a verdict; no clock, device, identity, or learner free text |
| no renderer bypass | delivered — a projection test plus a transition test that no renderer-originated intent can fabricate evidence or a claim |
| **independent science review** | **outstanding** — GAME-368, unchanged; content ships as unreviewed |

---

### GAME-373 / PS-09 — guided-mission production vertical slice

The slice is `survey-001-sizes`. Full record and the outstanding list:
[`SLICE_QUALIFICATION.md`](SLICE_QUALIFICATION.md).

| Required evidence | State |
|---|---|
| complete guided mission | delivered — `tests/e2e/verticalSlice.spec.ts` plays the mission brief → complete in a real browser with the target met |
| full loop playable end to end | delivered — renderer-free golden traces through `complete` for all four missions, the same slice with the keyboard alone, and the same slice with **no 3D backend at all** |
| science evidence | delivered as machine-checked traceability (every displayed value cited to a named register record; derived numbers recomputed in test) — **independent science review outstanding**, GAME-368, unchanged |
| UX evidence | delivered as the degraded and keyboard-only passes plus the surface-inventory and UX-flow assertions — **human usability review and target-age playtest outstanding** |
| accessibility evidence | delivered as an axe scan at every phase of the slice, the cross-engine route in `accessibility.spec.ts` (chromium, firefox, webkit), and the 320 px / 200 % reflow checks — **human screen-reader review and final conformance outstanding** |
| real-render evidence | delivered — the renderer reaches `ready` on the required WebGL2 baseline and its frame counter advances across the whole slice — **real GPU/device observation outstanding** |
| performance evidence | delivered as a repeatable artefact (`reports/ps09-slice-evidence.json`, generated by `tests/e2e/sliceEvidence.spec.ts`): eager-payload, renderer-chunk, console, network, and a11y rows asserted; frame-time, load-timing, and memory rows recorded and explicitly marked **not judgeable** under software rasterization — **GPU-qualified numbers outstanding** |
| **hard gate before content expansion** | delivered — `tests/content/sliceGate.test.ts` requires every shipped mission to reach a met target along its own authored path, and requires the slice specs and this record to exist |
| defect found by the slice | delivered — **D-40**: `targetMet` required only a supported claim, so the guided mission could be completed with two of its three required observations. The field is now read, the debrief names the gap, and the shell offers the return-to-measurement recovery the state machine always allowed |

**Not claimed by PS-09:** GPU/device-qualified performance, human visual sign-off, target-age
playtest, screen-reader experience, science review, and production art (PS-10's pipeline;
the slice runs on PS-05's generated placeholders).

---

## Cross-story rules

### Exact identity

Whenever evidence refers to a candidate or release, record the source SHA **and**
the release version. A version without a SHA is not evidence.

### Stale evidence

A code, content, or dependency change invalidates any prior evidence affected by
it. Re-run the affected checks; do not carry evidence across a change.

### Human evidence

Automated tests and AI review may **not** fabricate:

- target-age usability or comprehension approval;
- fun/engagement approval;
- science-expert approval;
- screen-reader human experience;
- originality / non-plagiarism judgement.

Automation may gather supporting evidence and must be labelled as such.

### Renderer evidence

Renderer claims require **real-browser** evidence. A mocked canvas in a unit test
is not renderer evidence. Production qualification additionally requires a real
GPU/device observation, not only headless or software rendering.

### Release blockers

The following block release until resolved:

- unresolved P0/P1 defect;
- high-severity science finding;
- an inaccessible required interaction;
- a required measurement that exists only visually;
- privacy/network surface violation;
- provenance gap on a shipping asset;
- unproven immutable artifact identity;
- broken or unexercised rollback;
- a budget breach recorded in `PERFORMANCE_AND_DEVICE_BUDGETS.md` without an
  explicit owner decision.

### Scope guard

No downstream story may silently redefine an upstream authority contract. If a
later story needs a contract change, it must be reconciled in the owning document
and recorded in Jira against GAME-362.
