/**
 * Audio cue inventory (PS-10).
 *
 * docs/TECHNICAL_DESIGN.md §9 defines the seam: buses, mute, autoplay handling,
 * and the rules. Two of those rules are about content rather than plumbing, and
 * this file is where they are met:
 *
 *  - "Every essential audio cue has a non-audio equivalent (visual and, where it
 *    carries information, semantic text). No required information is audio-only."
 *  - "Audio must not advance mission state."
 *
 * WHY CUES ARE SYNTHESISED AND SHIP ZERO BYTES
 * The cues are built from oscillators and noise at play time rather than loaded
 * from files. That keeps the product free of any sampled, licensed, or extracted
 * audio, which is what docs/ASSET_PROVENANCE.md requires; it means there is no
 * audio decoder, no loader, and no new runtime dependency; and it means the
 * "small/bounded/optional" requirement is true by construction rather than by
 * measurement. Each cue still carries a provenance record in
 * `src/assets/provenanceManifest.json`, because the policy requires audio to be
 * present in the manifest even when it has no bytes.
 *
 * WHY NOTHING HERE IMPORTS THE DOMAIN
 * The "audio must not advance mission state" rule is not enforced by comment.
 * This module imports nothing from `src/domain` or `src/ui`, so there is no
 * path by which a cue could reach mission state, and
 * `tests/audio/cueInventory.test.ts` fails the build if one is ever added.
 * A cue is a fact about sound; what it *means* is the UI's business, and the
 * UI already renders the same information visually.
 *
 * Reduced motion has no effect here. Sound is not animation, and a learner who
 * asked for less movement has not asked for less audio — mute is the control
 * for that, and it defaults to on (see `DEFAULT_MUTED`).
 */

import type { AudioBusId } from "./index";

export type AudioCueId =
  | "ui.select"
  | "ui.confirm"
  | "instrument.start"
  | "instrument.stop"
  | "evidence.capture"
  | "evidence.rejected"
  | "claim.submitted"
  | "mission.complete"
  | "ambience.survey";

/**
 * Builds one cue into a live audio graph.
 *
 * Implementations must only touch the AudioNodes they are given. There is no
 * return value to carry information back out, which is the point: a cue cannot
 * report anything to the game.
 */
export type CueSynth = (context: AudioContext, output: AudioNode, startAt: number) => void;

export interface CueDefinition {
  readonly bus: AudioBusId;
  /** True when the cue reports something the learner needs to know. */
  readonly essential: boolean;
  /**
   * The non-audio equivalent, as a stable id the UI knows how to render.
   * Required for every cue; an essential cue without one is a contract breach.
   */
  readonly nonAudioEquivalent: string;
  /** Human-readable description, used by the accessibility mapping. */
  readonly description: string;
  /** Looping cues are started and stopped rather than fired once. */
  readonly loop: boolean;
  readonly synth: CueSynth;
}

// --- small helpers ---------------------------------------------------------

/** A single enveloped oscillator voice. */
function tone(
  context: AudioContext,
  output: AudioNode,
  startAt: number,
  {
    frequency,
    duration,
    peak,
    type = "sine",
    attack = 0.005,
    detune = 0,
  }: {
    frequency: number;
    duration: number;
    peak: number;
    type?: OscillatorType;
    attack?: number;
    detune?: number;
  },
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (detune !== 0) osc.detune.setValueAtTime(detune, startAt);
  // A short attack avoids the click a hard start produces, which is the kind of
  // artefact that makes an interface feel cheap.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(output);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** A short burst of filtered noise, for percussive texture. */
function noiseBurst(
  context: AudioContext,
  output: AudioNode,
  startAt: number,
  { duration, peak, frequency }: { duration: number; peak: number; frequency: number },
): void {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic pseudo-noise: the same cue sounds the same every time, which
  // matters because a cue that changes on every press reads as noise, not feedback.
  let seed = 0x2f6e2b1;
  for (let i = 0; i < frameCount; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequency, startAt);
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(startAt);
  source.stop(startAt + duration + 0.02);
}

// --- the inventory ---------------------------------------------------------

/**
 * Every cue the product can make.
 *
 * The `nonAudioEquivalent` on each row is the concrete answer to A-10: what the
 * learner sees instead. None of them is "nothing".
 */
export const CUE_INVENTORY: Readonly<Record<AudioCueId, CueDefinition>> = {
  "ui.select": {
    bus: "sfx",
    essential: false,
    nonAudioEquivalent: "focus-ring",
    description: "A soft tick when a control is selected. Purely optional feedback.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 880, duration: 0.06, peak: 0.05, type: "triangle" });
    },
  },

  "ui.confirm": {
    bus: "sfx",
    essential: false,
    nonAudioEquivalent: "aria-live-status",
    description: "A two-note rise confirming an action. The status region says the same thing.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 523.25, duration: 0.09, peak: 0.06, type: "sine" });
      tone(context, output, at + 0.07, { frequency: 784, duration: 0.14, peak: 0.05, type: "sine" });
    },
  },

  "instrument.start": {
    bus: "sfx",
    essential: true,
    nonAudioEquivalent: "observation-active-indicator",
    description:
      "The instrument beginning a reading. The observation status indicator and its text carry the same fact, so nothing depends on hearing it.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 220, duration: 0.22, peak: 0.08, type: "sine" });
      noiseBurst(context, output, at, { duration: 0.18, peak: 0.03, frequency: 1400 });
    },
  },

  "instrument.stop": {
    bus: "sfx",
    essential: true,
    nonAudioEquivalent: "reading-value-in-notebook",
    description:
      "The reading finishing. The measured value appears in the notebook with its unit and source.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 330, duration: 0.12, peak: 0.06, type: "sine" });
      tone(context, output, at + 0.05, { frequency: 247, duration: 0.16, peak: 0.05, type: "sine" });
    },
  },

  "evidence.capture": {
    bus: "sfx",
    essential: true,
    nonAudioEquivalent: "evidence-notebook-entry",
    description:
      "Evidence recorded. A new named row appears in the notebook listing the body, attribute, value, and source.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 659.25, duration: 0.1, peak: 0.07, type: "sine" });
      tone(context, output, at + 0.06, { frequency: 987.77, duration: 0.18, peak: 0.05, type: "sine" });
    },
  },

  "evidence.rejected": {
    bus: "sfx",
    essential: true,
    nonAudioEquivalent: "evidence-rejection-message",
    description:
      "Evidence declined, with a visible message saying why. The reason is never audible only.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 196, duration: 0.16, peak: 0.08, type: "square" });
      tone(context, output, at + 0.08, { frequency: 155.56, duration: 0.2, peak: 0.06, type: "square" });
    },
  },

  "claim.submitted": {
    bus: "sfx",
    essential: true,
    nonAudioEquivalent: "claim-verdict-text",
    description:
      "A claim submitted for evaluation. The verdict is rendered as text with its reasons.",
    loop: false,
    synth: (context, output, at) => {
      tone(context, output, at, { frequency: 392, duration: 0.12, peak: 0.07, type: "triangle" });
      tone(context, output, at + 0.07, { frequency: 523.25, duration: 0.12, peak: 0.06, type: "triangle" });
      tone(context, output, at + 0.14, { frequency: 659.25, duration: 0.22, peak: 0.05, type: "triangle" });
    },
  },

  "mission.complete": {
    bus: "sfx",
    essential: true,
    nonAudioEquivalent: "completion-summary",
    description:
      "A mission finishing. The completion summary states the verdict, what was measured, and what was cited.",
    loop: false,
    synth: (context, output, at) => {
      const notes = [392, 523.25, 659.25, 783.99];
      notes.forEach((frequency, index) => {
        tone(context, output, at + index * 0.11, {
          frequency,
          duration: 0.32,
          peak: 0.07,
          type: "sine",
        });
      });
    },
  },

  "ambience.survey": {
    bus: "ambience",
    essential: false,
    nonAudioEquivalent: "none-required-not-information",
    description:
      "A quiet, slow bed so silence is not the default texture. Carries no information, so it has nothing to make equivalent; the renderer status and the notebook are unaffected by it.",
    loop: true,
    synth: (context, output, at) => {
      // Two barely-detuned low sines plus a slow tremolo: enough to stop the
      // room feeling dead, quiet enough to sit under a dense data tool.
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.03, at + 2.5);
      gain.connect(output);
      for (const frequency of [55, 82.4]) {
        const osc = context.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, at);
        const voiceGain = context.createGain();
        voiceGain.gain.setValueAtTime(0.5, at);
        osc.connect(voiceGain);
        voiceGain.connect(gain);
        osc.start(at);
      }
      const lfo = context.createOscillator();
      lfo.frequency.setValueAtTime(0.07, at);
      const lfoGain = context.createGain();
      lfoGain.gain.setValueAtTime(0.012, at);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start(at);
    },
  },
};

export const ALL_CUE_IDS: readonly AudioCueId[] = Object.keys(CUE_INVENTORY) as AudioCueId[];

export function isAudioCueId(value: string): value is AudioCueId {
  return Object.prototype.hasOwnProperty.call(CUE_INVENTORY, value);
}

export function cueDefinition(cue: AudioCueId): CueDefinition {
  return CUE_INVENTORY[cue];
}
