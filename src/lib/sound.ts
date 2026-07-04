import { settingsStore } from "./settings";

/**
 * Web Audio API でやさしい効果音を生成します。
 * 音源ファイルなしで動作し、設定でオン／オフできます。
 * 将来、実際の音源ファイルに差し替える場合も、
 * 同じ playSound() インターフェースのまま拡張できます。
 */

type SoundName =
  | "button"
  | "scan"
  | "discover"
  | "save"
  | "heartbeat"
  | "sparkle"
  | "fanfare";

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

/* ===================== BGM（やさしい環境音） ===================== */
/**
 * 音源ファイルなしで、ゆったりとした優しいBGMを生成します。
 * ペンタトニックの音をふんわり鳴らし続けるアンビエント。
 * 将来、本物の楽曲ファイルに差し替える場合も startBgm/stopBgm のまま拡張できます。
 */

let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmGain: GainNode | null = null;
let bgmStep = 0;

// やわらかいペンタトニック（C メジャー系）
const BGM_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 659.25, 587.33];

function bgmVoice(audio: AudioContext, freq: number, gain: number) {
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  env.gain.setValueAtTime(0.0001, audio.currentTime);
  env.gain.exponentialRampToValueAtTime(gain, audio.currentTime + 0.8);
  env.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 3.4);
  osc.connect(env);
  env.connect(bgmGain ?? audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 3.6);
}

export function startBgm() {
  if (typeof window === "undefined") return;
  if (!settingsStore.get().bgm) return;
  if (bgmTimer) return;
  const audio = getCtx();
  if (!audio) return;
  if (!bgmGain) {
    bgmGain = audio.createGain();
    bgmGain.gain.value = 0.5; // 全体を控えめに
    bgmGain.connect(audio.destination);
  }
  const playNext = () => {
    const a = getCtx();
    if (!a || !settingsStore.get().bgm) return;
    const note = BGM_NOTES[bgmStep % BGM_NOTES.length];
    bgmVoice(a, note, 0.035);
    // たまにオクターブ下の低音を重ねて温かみを出す
    if (bgmStep % 4 === 0) bgmVoice(a, note / 2, 0.02);
    bgmStep++;
  };
  playNext();
  bgmTimer = setInterval(playNext, 2600);
}

export function stopBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

/** 設定に合わせてBGMの再生/停止を同期します。 */
export function syncBgm() {
  if (settingsStore.get().bgm) startBgm();
  else stopBgm();
}

/**
 * リロード後もBGMを復帰できるよう、最初のユーザー操作を1度だけ待ちます
 * （ブラウザはユーザー操作なしに音を鳴らせないため）。
 */
export function initBgmAutoResume() {
  if (typeof window === "undefined") return;
  const onFirst = () => {
    syncBgm();
    window.removeEventListener("pointerdown", onFirst);
    window.removeEventListener("keydown", onFirst);
  };
  window.addEventListener("pointerdown", onFirst, { once: true });
  window.addEventListener("keydown", onFirst, { once: true });
}
