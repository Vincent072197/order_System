// Synthesized notification sounds (Web Audio) — no audio files, no licensing.
// Each preset is a short pattern of tones. Used by the orders board so staff
// can pick the new-order alert they like; the choice persists per device.

export type SoundId = "single" | "double" | "chime" | "dingdong";

export const SOUND_PRESETS: { id: SoundId; label: string }[] = [
  { id: "single", label: "單嗶" },
  { id: "double", label: "雙嗶" },
  { id: "chime", label: "上升鈴" },
  { id: "dingdong", label: "叮咚" },
];

export const DEFAULT_SOUND: SoundId = "single";
export const SOUND_STORAGE_KEY = "ordersys.notifySound";

export function isSoundId(v: unknown): v is SoundId {
  return SOUND_PRESETS.some((p) => p.id === v);
}

// One enveloped tone starting `start` seconds from now.
function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playSound(ctx: AudioContext, id: SoundId): void {
  switch (id) {
    case "double":
      tone(ctx, 880, 0, 0.15);
      tone(ctx, 880, 0.2, 0.15);
      break;
    case "chime":
      tone(ctx, 660, 0, 0.15);
      tone(ctx, 880, 0.15, 0.15);
      tone(ctx, 1175, 0.3, 0.3);
      break;
    case "dingdong":
      tone(ctx, 988, 0, 0.25);
      tone(ctx, 740, 0.25, 0.4);
      break;
    case "single":
    default:
      tone(ctx, 880, 0, 0.35);
  }
}
