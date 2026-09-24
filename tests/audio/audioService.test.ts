import { describe, expect, it, vi } from "vitest";

import { createAudioService, createNullAudioService, createWebAudioService } from "@/audio";

function fakeAudioContext(state: AudioContextState = "suspended") {
  const nodes: { gain: { value: number }; connect: () => void }[] = [];
  const context = {
    state,
    destination: {},
    createGain: () => {
      const node = { gain: { value: 0 }, connect: () => undefined };
      nodes.push(node);
      return node;
    },
    resume: vi.fn(async () => undefined),
    suspend: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  return { context, nodes };
}

describe("null audio service", () => {
  it("reports itself honestly as unavailable", () => {
    const service = createNullAudioService();
    expect(service.available).toBe(false);
  });

  it("still supports the full control surface so callers do not need to branch", () => {
    const service = createNullAudioService();
    service.setMuted(true);
    expect(service.isMuted).toBe(true);
    service.setBusLevel("sfx", 0.25);
    expect(service.levels().sfx).toBe(0.25);
    service.suspend();
    service.resume();
    service.dispose();
  });

  it("resolves unlock without throwing, so it cannot cause an unhandled rejection", async () => {
    await expect(createNullAudioService().unlock()).resolves.toBeUndefined();
  });
});

describe("web audio service", () => {
  it("is unavailable until a context exists, and never throws when Web Audio is missing", async () => {
    const service = createWebAudioService({ contextFactory: () => null });
    expect(service.available).toBe(false);
    await expect(service.unlock()).resolves.toBeUndefined();
    expect(service.available).toBe(false);
  });

  it("survives a factory that throws", async () => {
    const service = createAudioService({
      contextFactory: () => {
        throw new Error("autoplay policy blocked");
      },
    });
    await expect(service.unlock()).resolves.toBeUndefined();
    expect(service.available).toBe(false);
  });

  it("becomes available after unlock and resumes a suspended context", async () => {
    const { context } = fakeAudioContext("suspended");
    const service = createWebAudioService({
      contextFactory: () => context as unknown as AudioContext,
    });
    await service.unlock();
    expect(service.available).toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("clamps bus levels into [0, 1]", () => {
    const { context } = fakeAudioContext("running");
    const service = createWebAudioService({
      contextFactory: () => context as unknown as AudioContext,
    });
    void service.unlock();
    service.setBusLevel("music", 5);
    expect(service.levels().music).toBe(1);
    service.setBusLevel("music", -3);
    expect(service.levels().music).toBe(0);
    service.setBusLevel("music", Number.NaN);
    expect(service.levels().music).toBe(0);
  });

  it("drives the master gain to zero when muted", async () => {
    const { context, nodes } = fakeAudioContext("running");
    const service = createWebAudioService({
      contextFactory: () => context as unknown as AudioContext,
    });
    await service.unlock();
    const master = nodes[0];
    service.setMuted(true);
    expect(master?.gain.value).toBe(0);
    service.setMuted(false);
    expect(master?.gain.value).toBeGreaterThan(0);
  });

  it("disposes cleanly and stops reporting itself as available", async () => {
    const { context } = fakeAudioContext("running");
    const service = createWebAudioService({
      contextFactory: () => context as unknown as AudioContext,
    });
    await service.unlock();
    service.dispose();
    expect(service.available).toBe(false);
    expect(context.close).toHaveBeenCalledTimes(1);
    // A second dispose must be harmless.
    service.dispose();
  });

  it("tolerates a suspend that rejects", async () => {
    const { context } = fakeAudioContext("running");
    context.suspend = vi.fn(async () => {
      throw new Error("cannot suspend");
    });
    const service = createWebAudioService({
      contextFactory: () => context as unknown as AudioContext,
    });
    await service.unlock();
    expect(() => service.suspend()).not.toThrow();
  });
});
