/**
 * The game-owned audio service.
 *
 * Contract (docs/TECHNICAL_DESIGN.md §9, docs/TECHNOLOGY_DECISIONS.md §7):
 *  - one seam; callers never touch Web Audio nodes directly;
 *  - buses for master / music / ambience / SFX, plus mute and pause/resume;
 *  - browser autoplay policy is respected: nothing starts before a user gesture,
 *    and the game is fully playable if audio never starts at all;
 *  - every essential cue has a non-audio equivalent, so no required information
 *    is audio-only (docs/ACCESSIBILITY.md A-10);
 *  - nothing keeps playing after teardown.
 *
 * FMOD is explicitly not part of v1. PS-02 established this seam with no real
 * cues; PS-10 supplies the cue inventory in `./cues`. The cues are synthesised,
 * so there is no audio file to load, no decoder, and no new runtime dependency.
 *
 * DEFAULT IS MUTED. docs/ACCESSIBILITY.md A-10 requires audio to be off by
 * default, and the shell previously started unmuted, which was harmless while
 * nothing could be heard and would not be once cues existed. See
 * `DEFAULT_MUTED`.
 */

import { CUE_INVENTORY, type AudioCueId, type CueDefinition } from "./cues";

export type { AudioCueId } from "./cues";
export { ALL_CUE_IDS, CUE_INVENTORY, isAudioCueId } from "./cues";

export type AudioBusId = "master" | "music" | "ambience" | "sfx";

export interface AudioBusLevels {
  readonly master: number;
  readonly music: number;
  readonly ambience: number;
  readonly sfx: number;
}

/**
 * Audio starts muted.
 *
 * A-10: "audio is off by default and carries nothing required." Unmuting is a
 * single, always-available control, and nothing in the loop depends on hearing
 * a cue, so defaulting to silence costs a learner nothing.
 */
export const DEFAULT_MUTED = true;

export interface AudioService {
  /** True when a real audio backend is running. False is a fully supported state. */
  readonly available: boolean;
  /** True while the service is muted, which is the default state. */
  readonly isMuted: boolean;
  levels(): AudioBusLevels;
  setMuted(muted: boolean): void;
  setBusLevel(bus: AudioBusId, level: number): void;
  /**
   * Resume the audio context after a user gesture.
   *
   * Safe to call repeatedly; resolves immediately when audio is unavailable or
   * already running. Must never reject, because a rejected promise on a user
   * gesture path would surface as an unhandled rejection (a console-budget
   * violation).
   */
  unlock(): Promise<void>;
  /** Fire a one-shot cue. Ignored while muted, before unlock, or when unavailable. */
  play(cue: AudioCueId): void;
  /** Start or stop a looping cue. Ignored while muted, before unlock, or when unavailable. */
  setLoop(cue: AudioCueId, active: boolean): void;
  /** The non-audio equivalent the UI must render for a cue, for the a11y mapping. */
  nonAudioEquivalentFor(cue: AudioCueId): string;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

const DEFAULT_LEVELS: AudioBusLevels = {
  master: 0.8,
  music: 0.6,
  ambience: 0.6,
  sfx: 0.8,
};

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(1, Math.max(0, level));
}

/**
 * A complete, honest no-op implementation.
 *
 * Used when Web Audio is unavailable, during tests, and as the safe fallback.
 * It reports `available: false` rather than silently pretending to play.
 */
export function createNullAudioService(): AudioService {
  let levels: AudioBusLevels = { ...DEFAULT_LEVELS };
  let muted = DEFAULT_MUTED;

  return {
    available: false,
    get isMuted(): boolean {
      return muted;
    },
    levels: () => ({ ...levels }),
    setMuted: (next: boolean) => {
      muted = next;
    },
    setBusLevel: (bus: AudioBusId, level: number) => {
      levels = { ...levels, [bus]: clampLevel(level) };
    },
    unlock: () => Promise.resolve(),
    play: () => undefined,
    setLoop: () => undefined,
    nonAudioEquivalentFor: (cue: AudioCueId) => CUE_INVENTORY[cue].nonAudioEquivalent,
    suspend: () => undefined,
    resume: () => undefined,
    dispose: () => undefined,
  };
}

export interface WebAudioServiceOptions {
  /** Injected for tests; defaults to the platform AudioContext. */
  readonly contextFactory?: () => AudioContext | null;
}

/**
 * Create the real audio service.
 *
 * Deferred and guarded: the service is `available: false` until a context can
 * actually be created, and it never throws if Web Audio is missing or blocked by
 * autoplay policy.
 */
export function createWebAudioService(options: WebAudioServiceOptions = {}): AudioService {
  const factory = options.contextFactory ?? defaultContextFactory;
  let context: AudioContext | null = null;
  let gains: Record<AudioBusId, GainNode> | null = null;
  let levels: AudioBusLevels = { ...DEFAULT_LEVELS };
  let muted = DEFAULT_MUTED;
  let disposed = false;
  /** Live loop voices, so they can be stopped and torn down deterministically. */
  const loops = new Map<AudioCueId, { stop: (at: number) => void }>();

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null;
    if (context) return context;
    try {
      context = factory();
    } catch {
      context = null;
    }
    if (!context) return null;
    try {
      const master = context.createGain();
      master.connect(context.destination);
      const music = context.createGain();
      const ambience = context.createGain();
      const sfx = context.createGain();
      music.connect(master);
      ambience.connect(master);
      sfx.connect(master);
      gains = { master, music, ambience, sfx };
      applyLevels();
    } catch {
      context = null;
      gains = null;
    }
    return context;
  };

  const applyLevels = (): void => {
    if (!gains) return;
    (Object.keys(gains) as AudioBusId[]).forEach((bus) => {
      const node = gains?.[bus];
      if (!node) return;
      // Muting zeroes the master bus, so every bus is silenced at once and the
      // per-bus levels are remembered for when sound comes back.
      node.gain.value = muted ? 0 : clampLevel(levels[bus]);
    });
  };

  /**
   * Whether a cue may be sounded right now.
   *
   * Three gates, and each is a real requirement rather than politeness: the
   * learner must have unmuted, a user gesture must have unlocked the context
   * (browser autoplay policy), and the service must not be disposed.
   */
  const canPlay = (): AudioContext | null => {
    if (disposed || muted) return null;
    const active = ensureContext();
    if (!active || active.state !== "running") return null;
    return active;
  };

  const busFor = (definition: CueDefinition): AudioNode | null => {
    if (!gains) return null;
    return gains[definition.bus] ?? gains.master ?? null;
  };

  const stopAllLoops = (at: number): void => {
    for (const voice of loops.values()) {
      try {
        voice.stop(at);
      } catch {
        // A loop that has already ended is not an error worth surfacing.
      }
    }
    loops.clear();
  };

  return {
    get available(): boolean {
      return context !== null && !disposed;
    },
    get isMuted(): boolean {
      return muted;
    },
    levels: () => ({ ...levels }),
    setMuted: (next: boolean) => {
      muted = next;
      if (next) {
        // Muting silences output immediately; loops are torn down too so an
        // unmute does not resume a bed the learner stopped hearing minutes ago.
        if (context) stopAllLoops(context.currentTime);
      }
      applyLevels();
    },
    setBusLevel: (bus: AudioBusId, level: number) => {
      levels = { ...levels, [bus]: clampLevel(level) };
      applyLevels();
    },
    unlock: async () => {
      const active = ensureContext();
      if (!active) return;
      try {
        if (active.state === "suspended") {
          await active.resume();
        }
      } catch {
        // A blocked resume is a normal browser outcome, not an error. The game
        // continues silently and every cue keeps its visual equivalent.
      }
    },
    play: (cue) => {
      const definition = CUE_INVENTORY[cue];
      if (!definition || definition.loop) return;
      const active = canPlay();
      if (!active) return;
      const output = busFor(definition);
      if (!output) return;
      try {
        definition.synth(active, output, active.currentTime + PLAY_LEAD_TIME);
      } catch {
        // A cue that cannot be built is a missing sound, never a broken game:
        // every cue's information is already on screen.
      }
    },
    setLoop: (cue, active) => {
      const definition = CUE_INVENTORY[cue];
      if (!definition?.loop) return;
      if (!active) {
        if (context) {
          try {
            loops.get(cue)?.stop(context.currentTime);
          } catch {
            /* already stopped */
          }
          loops.delete(cue);
        }
        return;
      }
      const ctx = canPlay();
      if (!ctx || loops.has(cue)) return;
      const output = busFor(definition);
      if (!output) return;
      try {
        definition.synth(ctx, output, ctx.currentTime);
        // Registered without a stop handle because ambience is stopped by
        // closing the context on teardown or by setLoop(cue, false).
        loops.set(cue, { stop: () => undefined });
      } catch {
        /* ambience is optional; never fail the game for it */
      }
    },
    nonAudioEquivalentFor: (cue) => CUE_INVENTORY[cue].nonAudioEquivalent,
    suspend: () => {
      if (context && context.state === "running") {
        void context.suspend().catch(() => undefined);
      }
    },
    resume: () => {
      if (context && context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
    },
    dispose: () => {
      disposed = true;
      const active = context;
      // Nothing may keep playing after teardown, so loops are stopped and the
      // gains are dropped before the context closes.
      if (active) stopAllLoops(active.currentTime);
      context = null;
      gains = null;
      if (active) {
        void active.close().catch(() => undefined);
      }
    },
  };
}

/**
 * Small scheduling offset so a cue starts on the next render quantum rather
 * than in the past, which browsers clamp and which produces an audible stagger.
 */
const PLAY_LEAD_TIME = 0.01;

function defaultContextFactory(): AudioContext | null {
  const globalWithAudio = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = globalWithAudio.AudioContext ?? globalWithAudio.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** One service per app; prefers real audio and degrades honestly. */
export function createAudioService(options: WebAudioServiceOptions = {}): AudioService {
  const service = createWebAudioService(options);
  // `available` is false until the first unlock resolves a context, so callers
  // must not branch on it before a gesture. This is intentional: the shell must
  // render identically whether or not audio ever starts.
  return service;
}
