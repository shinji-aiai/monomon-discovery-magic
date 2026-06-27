import { settingsStore } from "./settings";

/**
 * Web Audio API でやさしい効果音を生成します。
 * 音源ファイルなしで動作し、設定でオン／オフできます。
 * 将来、実際の音源ファイルに差し替える場合も、
 * 同じ playSound() インターフェースのまま拡張できます。
 */

type SoundName = "button" | "scan" | "discover" | "save";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  audio: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.12,
) {
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + start);
  env.gain.setValueAtTime(0.0001, audio.currentTime + start);
  env.gain.exponentialRampToValueAtTime(gain, audio.currentTime + start + 0.02);
  env.gain.exponentialRampToValueAtTime(
    0.0001,
    audio.currentTime + start + duration,
  );
  osc.connect(env);
  env.connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.02);
}

const RECIPES: Record<SoundName, (a: AudioContext) => void> = {
  button: (a) => tone(a, 660, 0, 0.12, "sine", 0.08),
  scan: (a) => {
    tone(a, 440, 0, 0.5, "triangle", 0.05);
    tone(a, 560, 0.08, 0.5, "sine", 0.04);
  },
  discover: (a) => {
    tone(a, 523, 0, 0.18, "sine", 0.1); // C
    tone(a, 659, 0.12, 0.18, "sine", 0.1); // E
    tone(a, 784, 0.24, 0.28, "sine", 0.11); // G
    tone(a, 1047, 0.36, 0.4, "sine", 0.09); // C
  },
  save: (a) => {
    tone(a, 587, 0, 0.14, "sine", 0.09);
    tone(a, 880, 0.1, 0.22, "sine", 0.09);
  },
};

export function playSound(name: SoundName) {
  try {
    if (!settingsStore.get().sound) return;
    const audio = getCtx();
    if (!audio) return;
    RECIPES[name](audio);
  } catch {
    /* 無音で握りつぶす */
  }
}

export function haptic(pattern: number | number[] = 12) {
  try {
    if (!settingsStore.get().haptics) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* noop */
  }
}

/** ボタン共通: 軽い音 + 軽い振動 */
export function tap() {
  playSound("button");
  haptic(10);
}
