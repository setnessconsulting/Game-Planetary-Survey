# Planetary Survey — Privacy and Persistence Contract

Status: binding PS-01 privacy contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

Planetary Survey is used by minors in school settings. The privacy contract is
therefore strict by default, and the default is **local-first**.

---

## 1. Governing rule

> **No remote service is required to play the game.**

The game is a static web artifact. Same-origin, immutable static asset delivery
is the only permitted runtime network activity.

## 2. Prohibited in v1

Release-blocking if present:

| Prohibited | Note |
|---|---|
| learner accounts, sign-in, or identity | there is no learner data to own |
| advertising or ad SDKs | — |
| marketing or product-analytics trackers | — |
| remote learner telemetry or behavioural reporting | includes "anonymous" usage ping-by-default |
| engagement analytics that report per-learner activity | — |
| runtime LLM / AI API calls | no AI tutor feature exists |
| remote upload of mission traces, evidence, or written claims | claims stay on device |
| remote storage / cloud save | — |
| third-party CDNs or font/script hosts | assets are same-origin |
| engagement-pressure mechanics | streaks, FOMO, loot boxes, playtime limits |
| error reporting that uploads learner content | includes stack traces containing user input |

## 3. Permitted runtime network activity

- **Same-origin immutable static asset delivery** for the build's own files
  (JS/CSS chunks, textures, meshes, audio, manifests) under the games-site asset
  prefix.
- Nothing else.

No runtime `fetch` to a third-party origin, no websocket, no beacon, no
local-network discovery.

## 4. Persistence

Default v1 persistence is **session-local** with a small, explicitly bounded
local persistence layer.

### 4.1 Allowed to persist

- preference flags: reduced motion, mute, master/per-bus volume, quality profile;
- optionally, a **bounded mission resume state** — only if PS-08 demonstrates it
  improves UX for the target learner.

### 4.2 Never persist

- identity, names, usernames, email, or account-like identifiers;
- the learner's **free-text reasoning or written claims**;
- location, device fingerprint, or network identifiers;
- any learner-derived content that is uploaded anywhere.

### 4.3 Persistence rules

- Persisted schemas are **versioned**.
- Load is **fail-safe**: validate → migrate if a known older version → fall back to
  defaults. A malformed or unreadable store must never throw the learner into a
  broken state.
- Storage unavailability (private mode, disabled storage, quota) must degrade to
  an in-memory session with no functional loss to the mission.
- Persisted data must be clearable from within the product.
- Storage must be used through a single adapter so the surface is auditable and
  testable — not scattered `localStorage` calls.

## 5. Evidence and traces

- Mission traces, evidence records, comparisons, and claims are **domain state
  that stays on device**.
- Local capture of a trace for **developer/reviewer evidence** is a build/test
  artifact, not a runtime learner feature, and must not be enabled in a production
  learner build.
- Any reviewer/qualification capture must be produced from an explicitly
  identified build, not silently from a learner's session.

## 6. No learner data in tests

- Automated tests, screenshots, and video artifacts must not contain real learner
  data (there should be none to contain).
- Playtest evidence collected by humans follows the owner's process and is not
  stored in this repository.

## 7. Enforcement from PS-02

PS-02 must establish:

- a **privacy-surface check** (`scripts/`) that fails the build when an unapproved
  runtime network API or host is introduced;
- a runtime-dependency allowlist check, so a new dependency that phones home or
  inflates the trust surface fails loudly;
- documentation of the approved runtime dependency set and why each exists.

PS-12 extends this into consolidated qualification evidence.

## 8. Games-site boundary

The game does not define games-site behaviour. games-site owns its own
navigation, hosting, and any outer-shell telemetry policy. The game must not
import games-site code or depend on a host message protocol
(`TECHNICAL_DESIGN.md` §13).

Where a games-site concern could affect learner privacy — for example an outer
shell analytics capability — that policy is owned and reviewed by games-site, and
the game's contract is only that **the game itself introduces none**.

## 9. Review gates

| Gate | Requirement |
|---|---|
| PS-02 | privacy-surface + dependency-allowlist checks exist and pass |
| PS-12 | exact-candidate evidence: zero third-party requests, zero telemetry calls, clean console/network |
| PS-14 | privacy review finding recorded against the exact candidate |
| Release | no known privacy violation; no unresolved high-severity finding |
