/**
 * Engine creation.
 *
 * WebGL2 is constructed eagerly because it is the required correctness baseline.
 * WebGPU is imported LAZILY and only when the capability probe selected it, so the
 * WebGPU code path never enters the initial bundle and a WebGL2-only browser never
 * downloads it.
 *
 * Isolation rule: `runRenderLoop` is called from exactly one place in this
 * repository — `controller.ts`, inside `src/renderer/`. React never calls it
 * (docs/TECHNICAL_DESIGN.md §4.1); `scripts/check-architecture.mjs` enforces this.
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

import type { RendererBackend } from "@/platform/capabilities";

export interface EngineInitResult {
  readonly engine: AbstractEngine;
  /** The backend actually in use, which may differ from the requested one. */
  readonly backend: Extract<RendererBackend, "webgpu" | "webgl2">;
  readonly notes: readonly string[];
}

export class RendererEngineError extends Error {
  readonly backend: RendererBackend;

  constructor(message: string, backend: RendererBackend) {
    super(message);
    this.name = "RendererEngineError";
    this.backend = backend;
  }
}

export interface CreateEngineOptions {
  readonly canvas: HTMLCanvasElement;
  /** Requested backend from the capability probe. */
  readonly backend: RendererBackend;
  /**
   * Mutable sink the caller owns, appended to as backends are tried.
   *
   * This is an out-parameter on purpose: when every backend fails this function
   * throws, and a thrown error would otherwise discard the record of what was
   * attempted. Without it, a learner whose WebGPU attempt failed and whose WebGL2
   * attempt then failed is told only "WebGL2 initialization failed", which hides
   * half of what happened.
   */
  readonly notes: string[];
}

/**
 * Create the best available engine.
 *
 * Throws `RendererEngineError` when no backend can initialize, which the UI turns
 * into an honest, accessible explanation rather than a blank viewport
 * (docs/TECHNICAL_DESIGN.md §6.4).
 */
export async function createEngineFor(options: CreateEngineOptions): Promise<EngineInitResult> {
  const { notes } = options;

  if (options.backend === "webgpu") {
    const webgpu = await tryCreateWebGPU(options.canvas, notes);
    if (webgpu) return webgpu;
    notes.push("WebGPU was requested but did not initialize; falling back to WebGL2.");
  }

  if (options.backend === "unavailable") {
    throw new RendererEngineError(
      "No supported 3D backend is available in this browser.",
      "unavailable",
    );
  }

  try {
    const engine = new Engine(options.canvas, true, { stencil: true, alpha: false }, true);
    return { engine, backend: "webgl2", notes };
  } catch (error) {
    throw new RendererEngineError(
      `WebGL2 initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      "webgl2",
    );
  }
}

async function tryCreateWebGPU(
  canvas: HTMLCanvasElement,
  notes: string[],
): Promise<EngineInitResult | null> {
  try {
    const module = await import("@babylonjs/core/Engines/webgpuEngine");
    const supported = await module.WebGPUEngine.IsSupportedAsync;
    if (!supported) {
      notes.push("WebGPU API present but the engine reports it as unsupported.");
      return null;
    }
    const engine = new module.WebGPUEngine(canvas, { antialias: true, stencil: true });
    await engine.initAsync();
    notes.push("WebGPU engine initialized (enhancement path).");
    return { engine, backend: "webgpu", notes };
  } catch (error) {
    notes.push(
      `WebGPU initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
