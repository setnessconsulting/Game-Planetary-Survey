/**
 * Audio cue contract (GAME-374).
 *
 * docs/TECHNICAL_DESIGN.md §9 and docs/ACCESSIBILITY.md A-10. Two of the rules
 * are about content, and content is exactly what a type system will not check
 * for you, so they are checked here:
 *
 *  - every essential cue has a non-audio equivalent, and no required
 *    information is audio-only;
 *  - audio does not advance mission state.
 *
 * The second is enforced structurally rather than by convention: `cues.ts` must
 * not import the domain or the UI, so there is no path by which a cue could
 * reach a mission. A test that greps the import list catches a regression the
 * moment someone adds one, instead of at review.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_CUE_IDS, CUE_INVENTORY, isAudioCueId } from "@/audio/cues";
import { DEFAULT_MUTED, createNullAudioService } from "@/audio";

const root = resolve(__dirname, "..", "..");

describe("cue inventory", () => {
  it("declares a definition for every cue id", () => {
    for (const cue of ALL_CUE_IDS) {
      expect(CUE_INVENTORY[cue], cue).toBeDefined();
    }
    expect(new Set(ALL_CUE_IDS).size).toBe(ALL_CUE_IDS.length);
  });

  it("gives every cue a non-audio equivalent, because A-10 forbids audio-only information", () => {
    for (const cue of ALL_CUE_IDS) {
      const definition = CUE_INVENTORY[cue];
      expect(definition.nonAudioEquivalent, cue).toBeTruthy();
      expect(definition.nonAudioEquivalent.trim(), cue).not.toBe("");
      // "none-required-*" is the only acceptable way to say a cue carries no
      // information, and even then it must be explicit rather than empty.
      if (!definition.essential) {
        expect(definition.nonAudioEquivalent, cue).toMatch(
          /^(none-|focus-ring|aria-live-status)/,
        );
      }
    }
  });

  it("requires every essential cue to name a real visual equivalent", () => {
    const essential = ALL_CUE_IDS.filter((cue) => CUE_INVENTORY[cue].essential);
    expect(essential.length).toBeGreaterThan(0);
    for (const cue of essential) {
      const equivalent = CUE_INVENTORY[cue].nonAudioEquivalent;
      // An essential cue must point at something the UI actually renders, not
      // at the "no information" escape hatch.
      expect(equivalent.startsWith("none-"), cue).toBe(false);
      expect(equivalent.length, cue).toBeGreaterThan(5);
    }
  });

  it("classifies each cue as looping or one-shot, and only ambience loops", () => {
    for (const cue of ALL_CUE_IDS) {
      if (CUE_INVENTORY[cue].loop) {
        expect(CUE_INVENTORY[cue].bus, cue).toBe("ambience");
      }
    }
  });

  it("routes every cue to a real bus", () => {
    const buses = new Set(["master", "music", "ambience", "sfx"]);
    for (const cue of ALL_CUE_IDS) {
      expect(buses.has(CUE_INVENTORY[cue].bus), cue).toBe(true);
    }
  });

  it("describes every cue in language a reviewer can check", () => {
    for (const cue of ALL_CUE_IDS) {
      expect(CUE_INVENTORY[cue].description.length, cue).toBeGreaterThan(30);
    }
  });

  it("synthesises deterministically, so a cue never sounds like noise", () => {
    // The noise burst uses a fixed seed for exactly this reason.
    const source = readFileSync(join(root, "src", "audio", "cues.ts"), "utf8");
    expect(source).toContain("let seed = 0x2f6e2b1");
    expect(source).not.toMatch(/Math\.random/);
  });
});

describe("audio cannot advance mission state", () => {
  it("keeps the cue module free of domain and UI imports", () => {
    const source = readFileSync(join(root, "src", "audio", "cues.ts"), "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1] ?? "");
    for (const specifier of imports) {
      expect(specifier, "cues.ts must not reach the domain").not.toMatch(/@\/domain/);
      expect(specifier, "cues.ts must not reach the UI").not.toMatch(/@\/ui/);
      expect(specifier, "cues.ts must not reach content").not.toMatch(/@\/content/);
    }
  });

  it("returns nothing from a synth, so a cue cannot report a result", () => {
    // Build every cue against a stub audio graph. A synth that returned a value
    // could be feeding something back into the game, and a synth that threw
    // would take a mission down over a sound.
    const context = stubAudioContext();
    for (const cue of ALL_CUE_IDS) {
      const result = CUE_INVENTORY[cue].synth(
        context as unknown as AudioContext,
        context.destination as unknown as AudioNode,
        0,
      );
      expect(result, `${cue} returns undefined`).toBeUndefined();
    }
  });

  it("connects every node it creates, so a cue cannot leak a dangling voice", () => {
    const context = stubAudioContext();
    for (const cue of ALL_CUE_IDS) {
      CUE_INVENTORY[cue].synth(
        context as unknown as AudioContext,
        context.destination as unknown as AudioNode,
        0,
      );
    }
    // A node still unconnected after every cue ran is a dangling voice: it would
    // never be collected, and on a real device that is a slow leak per press.
    expect(context.unconnected()).toEqual([]);
  });
});

/**
 * A minimal AudioContext stand-in.
 *
 * Real Web Audio does not exist in jsdom, and stubbing it is the only way to
 * exercise the synthesis graphs at all. It records connections so a dangling
 * node is detectable, which is the failure that would otherwise only show up as
 * a silent memory leak on a real device.
 */
function stubAudioContext() {
  const unconnected = new Set<object>();
  const param = () => ({
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
  });
  // `connect` must delete the object it is attached to, so the node is built in
  // one step and closes over itself rather than being assembled by spreading.
  const make = <T extends object>(extra: T) => {
    const self = {
      connect: () => {
        unconnected.delete(self);
        return self;
      },
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      ...extra,
    };
    unconnected.add(self);
    return self;
  };
  // The destination is the terminal node: cues connect INTO it and nothing
  // connects out of it, so tracking it would report a permanent false positive.
  const destination = make({});
  unconnected.delete(destination);
  return {
    sampleRate: 48000,
    currentTime: 0,
    destination,
    createGain: () => make({ gain: { value: 0, ...param() } }),
    createOscillator: () =>
      make({
        type: "sine",
        frequency: { value: 0, ...param() },
        detune: { value: 0, ...param() },
      }),
    createBiquadFilter: () => make({ type: "bandpass", frequency: { value: 0, ...param() } }),
    createBuffer: (_channels: number, frameCount: number) => ({
      getChannelData: () => new Float32Array(frameCount),
    }),
    createBufferSource: () => make({ buffer: null, loop: false }),
    unconnected: () => [...unconnected],
  };
}

describe("cue ids", () => {
  it("recognises exactly the declared ids", () => {
    expect(isAudioCueId("ui.select")).toBe(true);
    expect(isAudioCueId("ambience.survey")).toBe(true);
    expect(isAudioCueId("not.a.cue")).toBe(false);
    // A prototype-polluting or inherited key must not pass as a cue.
    expect(isAudioCueId("toString")).toBe(false);
    expect(isAudioCueId("constructor")).toBe(false);
  });
});

describe("default audio state", () => {
  it("starts muted, as A-10 requires", () => {
    expect(DEFAULT_MUTED).toBe(true);
    expect(createNullAudioService().isMuted).toBe(true);
  });

  it("exposes each cue's non-audio equivalent through the service", () => {
    const service = createNullAudioService();
    for (const cue of ALL_CUE_IDS) {
      expect(service.nonAudioEquivalentFor(cue), cue).toBe(CUE_INVENTORY[cue].nonAudioEquivalent);
    }
  });
});
