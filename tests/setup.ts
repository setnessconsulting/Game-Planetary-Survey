/**
 * Unit-test environment setup.
 *
 * jsdom has no GPU, so `getContext` is stubbed to return null. That makes the
 * capability probe follow its REAL "unsupported" branch rather than emitting
 * jsdom "not implemented" noise — it is not a stand-in for renderer evidence.
 *
 * The real renderer path is proven in a real browser by
 * tests/e2e/smoke.spec.ts. A mocked canvas is never accepted as renderer
 * evidence (docs/ACCEPTANCE_EVIDENCE_MATRIX.md, "Renderer evidence").
 */

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => null,
  writable: true,
  configurable: true,
});

afterEach(() => {
  cleanup();
});
