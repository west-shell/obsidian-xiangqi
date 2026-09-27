import type { Move } from "../chess";
import { isMoveCheckmate } from "../chess";

// ========== Move Sound Profiles ==========
// Pure WebAudio oscillator presets: no audio asset files (GPL-friendly,
// loads fine in mobile WebViews). Identical for every game variant.
export interface SoundTone {
  /** Base frequency in Hz */
  freq: number;
  /** Random detune range in Hz (±) so repeated plays don't sound mechanical */
  jitter?: number;
  /** Oscillator wave shape */
  type: OscillatorType;
  /** Tone duration in seconds */
  dur: number;
  /** Delay before this tone starts, in seconds (arpeggio spacing) */
  delay?: number;
  /** Per-tone gain multiplier (0–1); global volume is applied on top */
  gain?: number;
}

export type MoveSoundKind = "move" | "capture" | "checkmate";

export const MOVE_SOUNDS: Record<MoveSoundKind, SoundTone[]> = {
  move: [{ freq: 660, jitter: 60, type: "sine", dur: 0.06 }],
  capture: [
    { freq: 300, type: "triangle", dur: 0.09 },
    { freq: 150, type: "sine", dur: 0.12 },
  ],
  checkmate: [
    { freq: 523, type: "sine", dur: 0.14 },
    { freq: 659, type: "sine", dur: 0.14, delay: 0.11 },
    { freq: 784, type: "sine", dur: 0.14, delay: 0.22 },
    { freq: 1047, type: "sine", dur: 0.3, delay: 0.33 },
  ],
};

// AudioContext is created lazily on first play, which always follows a user
// gesture (autoplay policies), and resumed for iOS WebViews that start it
// in a suspended state.
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!ctor) return null;
  audioCtx = new ctor();
  return audioCtx;
}

/** Play a synthesized sound profile; volume is 0–1. */
export function playSound(kind: MoveSoundKind, volume: number): void {
  if (volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const base = ctx.currentTime;
  for (const tone of MOVE_SOUNDS[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const jitter = tone.jitter ? (Math.random() * 2 - 1) * tone.jitter : 0;
    const start = base + (tone.delay ?? 0);
    const peak = Math.max(0.0001, volume * (tone.gain ?? 1) * 0.18);

    osc.type = tone.type;
    osc.frequency.value = tone.freq + jitter;
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}

/** Play the matching sound for a move; volume is 0–1. */
export function playMoveSound(move: Move, volume: number): void {
  const kind: MoveSoundKind = isMoveCheckmate(move)
    ? "checkmate"
    : move.captured
      ? "capture"
      : "move";
  playSound(kind, volume);
}
