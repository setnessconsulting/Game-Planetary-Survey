# Planetary Survey — games-site Release Contract

Status: binding PS-01 host/release contract
Jira: GAME-362 (Epic), GAME-363 (PS-01)
Decision date: 2026-09-24

## 1. Ownership

`setnessconsulting/Game-Planetary-Survey` owns:

- source and tests;
- science content and the source register;
- production build;
- release manifest;
- immutable artifact identity;
- provenance manifest.

`setnessconsulting/games-site` owns:

- public catalog entry;
- launcher and play routes;
- outer shell/navigation;
- selected preview and production release pointers;
- same-origin asset delivery;
- production promotion;
- rollback.

The game must **not** be coupled to games-site internals. No games-site import,
no shared code, and no host `postMessage` protocol for v1.

## 2. Canonical identity

```text
slug:              planetary-survey
launcher:          /planetary-survey/
play:              /planetary-survey/play/
asset prefix:      /game-assets/planetary-survey/<version>/...
release kind:      static-web   (entryFile: index.html)
preview variable:  PLANETARY_SURVEY_PREVIEW_VERSION
```

This matches the established games-site conventions (verified against the
current catalog and route implementations on 2026-09-24):

- catalog entries live in `src/data/games.ts` with a `slug`, `route`,
  `cardImage`, `controls`, `status`, and `release`;
- per-game route pages exist at `src/pages/<slug>/index.astro` and
  `src/pages/<slug>/play.astro`;
- static-web releases are served through `StaticGameFrame` with an
  `/game-assets/<slug>/<version>/<entryFile>` URL;
- catalog and routes are validated by `npm run validate:catalog` and
  `npm run validate:routes`.

## 3. Pre-promotion state (production must stay unavailable)

Production remains **coming-soon / unavailable** until PS-PROMOTE completes.

Rationale: the Epic requires that no unqualified Planetary Survey candidate is
ever publicly reachable as if it were finished.

## 4. Build contract

The game repository produces a static artifact containing:

- `index.html`;
- hashed static assets;
- the release manifest;
- all content required for the release;
- no server dependency.

Requirements:

- assets use a **relative/version-compatible base** so they resolve beneath
  `/game-assets/planetary-survey/<version>/`;
- no asset assumes domain-root deployment unless it is intentionally an
  outer-shell URL and documented;
- a deep-link direct load of the entry document succeeds;
- hashed assets are safe to cache as immutable;
- a missing asset yields bounded error behaviour, not an endless spinner;
- the built artifact works when served from a nested subdirectory (verified with
  a nested-base build test, matching the established `test:host` /
  `nestedAssetBase` precedent).

## 5. Release manifest (minimum fields)

```text
game slug
release version
source SHA
build timestamp
content / source-register version
dependency-lock identity
entrypoint
artifact file hashes or equivalent integrity inventory
asset/provenance manifest version
renderer baseline declaration (WebGL2 baseline; WebGPU optional enhancement)
```

Immutable artifacts are **never overwritten**. A code or content change produces a
new version and a new prefix.

## 6. Architecture verification before promotion

Promotion requires that the exact candidate has passed:

1. all local authoritative checks (install, typecheck, lint, unit/contract,
   architecture boundaries, real-browser renderer smoke, build, privacy surface);
2. consolidated qualification (PS-12);
3. real-GPU/device and lower-capability device checks;
4. accessibility review including manual findings;
5. science review with no unresolved high-severity finding;
6. comparator and originality review (PS-14);
7. target-age human playtest (PS-14);
8. clean console and no unexpected third-party network activity.

## 7. Qualifying the preview candidate (PS-13)

1. build the exact source SHA;
2. create an immutable release identity;
3. upload the candidate to the versioned asset prefix;
4. configure the non-production selection;
5. verify `/planetary-survey/`;
6. verify `/planetary-survey/play/`;
7. verify nested asset resolution, including direct entry load;
8. verify iframe title, focus behaviour, and keyboard reachability;
9. verify reload and direct navigation;
10. record the game SHA, release version, games-site SHA/deployment, and preview
    URL.

Production remains unavailable throughout.

### 7.1 Known integration constraint (PS-HOST must resolve)

Verified in the current `games-site` catalog validator
(`src/lib/catalog.ts`, 2026-09-24): an entry with `status: "coming-soon"` **may
not** carry a `release`, and an entry with `status: "playable"` **must** carry
one.

The established pattern therefore makes a game reachable at `/play/` by marking it
`playable` while a preview variable pins a non-production version. That pattern
does **not** satisfy §3 (production must remain unavailable) for a game that has
no promoted release yet.

**PS-HOST (`GAME-365`) owns resolving this**, and must do so without weakening
`validate:catalog` or making an unfinished candidate production-reachable. The
requirement is explicit: preview reachability and production unavailability must
be separately expressible and independently testable. This is recorded here as a
discovered dependency, not as a decision PS-01 is entitled to make on games-site's
behalf.

## 8. Production promotion (PS-PROMOTE)

Promotion changes **only** the games-site selected release/metadata. It must not:

- rebuild the game;
- mutate the immutable candidate;
- copy game source into games-site;
- change game content.

Live smoke after promotion must verify:

- launcher;
- mission start;
- briefing;
- target/instrument selection;
- observation and evidence capture;
- comparison;
- claim submission and citation;
- debrief;
- revise/replay.

## 9. Rollback

Promotion is not accepted until rollback has been exercised:

1. record the current known-good games-site state;
2. promote the approved Planetary Survey release;
3. verify;
4. roll back to the prior known-good state;
5. verify;
6. restore Planetary Survey if the release remains approved;
7. record the evidence.

## 10. Host protocol

No custom `postMessage` API is required for v1. The iframe owns the game session;
games-site owns outer navigation. Adding a host message protocol requires a new
explicit requirement and contract tests.

## 11. Security

The asset-delivery function must:

- serve only the selected preview/production versions;
- reject arbitrary versions;
- reject path traversal;
- preserve immutable caching;
- serve only expected game paths;
- apply the established CSP/framing headers for game-asset HTML documents.

## 12. LevelBest

**Out of scope.** No LevelBest dependency, adapter, host contract, or
promotion-path requirement exists for Planetary Survey under GAME-362. Release
completion must not depend on LevelBest in any way. See `DECISIONS.md` D-09.

## 13. Closeout evidence required in Jira

- game source SHA;
- release version;
- content/source-register version;
- games-site promotion SHA;
- deployment identity;
- public URL;
- rollback evidence;
- qualification results with exact commands;
- known limitations;
- confirmation that documentation, Jira, and the live site describe the same
  state.
