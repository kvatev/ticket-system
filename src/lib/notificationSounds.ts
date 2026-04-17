// Synthesized notification sounds using Web Audio API.
// No external mp3 files needed — generated on the fly.

export type SoundChoice = "pop" | "ding" | "chime" | "classic";

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.25,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + startAt + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.05);
}

export function playSyntheticSound(choice: SoundChoice) {
  if (choice === "classic") {
    // Fall back to mp3 file
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
    return;
  }

  const ctx = getCtx();
  if (!ctx) return;

  switch (choice) {
    case "pop":
      // Quick Messenger-like "bloop"
      tone(ctx, 520, 0, 0.08, "sine", 0.3);
      tone(ctx, 880, 0.05, 0.12, "sine", 0.25);
      break;
    case "ding":
      // Bright bell ding
      tone(ctx, 1318, 0, 0.4, "triangle", 0.25);
      tone(ctx, 1760, 0, 0.3, "sine", 0.15);
      break;
    case "chime":
      // Three-note ascending chime
      tone(ctx, 660, 0, 0.25, "sine", 0.22);
      tone(ctx, 880, 0.12, 0.25, "sine", 0.22);
      tone(ctx, 1175, 0.24, 0.4, "sine", 0.22);
      break;
  }
}

// ---------- Do Not Disturb helpers ----------

export interface DndSettings {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number;   // 0-23
}

export function isInDndWindow(now: Date, dnd: DndSettings): boolean {
  if (!dnd.enabled) return false;
  const h = now.getHours();
  const { startHour, endHour } = dnd;
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    // Same-day window, e.g. 13 → 18
    return h >= startHour && h < endHour;
  }
  // Overnight window, e.g. 22 → 7
  return h >= startHour || h < endHour;
}
