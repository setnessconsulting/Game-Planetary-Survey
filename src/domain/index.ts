/**
 * Planetary Survey — pure domain layer (the science authority).
 *
 * This is the only layer that decides what is true. It must not import React,
 * Babylon, DOM/browser APIs, `content/`, `ui/`, `renderer/`, `audio/`, `assets/`,
 * `platform/`, or any hosting code (docs/TECHNICAL_DESIGN.md §2.1).
 *
 * The boundary is enforced by:
 *  - `scripts/check-architecture.mjs` (import + source-pattern scan);
 *  - the `no-restricted-imports` rules in `eslint.config.mjs`;
 *  - `tests/domain/purity.test.ts`.
 */

export * from "./attributes";
export * from "./bodies";
export * from "./claims";
export * from "./comparison";
export * from "./evidence";
export * from "./measurement";
export * from "./mission";
export * from "./quantities";
export * from "./random";
export * from "./renderSnapshot";
