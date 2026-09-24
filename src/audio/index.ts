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
 * FMOD is explicitly not part of v1. PS-02 establishes the seam with no real
 * cues; PS-10 supplies original audio. Same-origin audio loading will require an
 * explicit privacy-check allowlist decision at that point.
 */

export type AudioBusId = "master" | "music" | "ambience" | "sfx";

export interface AudioBusLevels {
  readonly master: number;
  readonly music: number;
  readonly ambience: number;
  readonly sfx: number;
}

export type AudioCueId = "ui.select" | "ui.confirm" | "instrument.start" | "evidence.capture";

export interface AudioService {
  /** True when a real audio backend is running. False is a fully supported state. */
  readonly available: boolean;
  /** True while the service is paused (hidden tab, or an explicit pause). */
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
  play(cue: AudioCueId): void;
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
  let muted = false;

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
  let muted = false;
  let disposed = false;

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
      node.gain.value = muted && bus === "master" ? 0 : clampLevel(levels[bus]);
    });
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
    play: () => {
      // No cues exist yet (PS-10 authors them). Resolve the context lazily so
      // that merely rendering the shell does not create an audio context.
      ensureContext();
    },
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
      context = null;
      gains = null;
      if (active) {
        void active.close().catch(() => undefined);
      }
    },
  };
}

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
