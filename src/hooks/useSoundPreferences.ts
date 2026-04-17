import { useCallback, useEffect, useState } from "react";
import { SoundChoice, DndSettings, playSyntheticSound, isInDndWindow } from "@/lib/notificationSounds";

const SOUND_KEY = "notif-sound-choice";
const DND_KEY = "notif-dnd-settings";

const DEFAULT_DND: DndSettings = { enabled: false, startHour: 22, endHour: 7 };

function readSound(): SoundChoice {
  if (typeof window === "undefined") return "pop";
  const v = localStorage.getItem(SOUND_KEY) as SoundChoice | null;
  return v && ["pop", "ding", "chime", "classic"].includes(v) ? v : "pop";
}

function readDnd(): DndSettings {
  if (typeof window === "undefined") return DEFAULT_DND;
  try {
    const raw = localStorage.getItem(DND_KEY);
    if (!raw) return DEFAULT_DND;
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      startHour: Number.isFinite(parsed.startHour) ? parsed.startHour : 22,
      endHour: Number.isFinite(parsed.endHour) ? parsed.endHour : 7,
    };
  } catch {
    return DEFAULT_DND;
  }
}

export function useSoundPreferences() {
  const [sound, setSoundState] = useState<SoundChoice>(() => readSound());
  const [dnd, setDndState] = useState<DndSettings>(() => readDnd());

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === SOUND_KEY) setSoundState(readSound());
      if (e.key === DND_KEY) setDndState(readDnd());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setSound = useCallback((choice: SoundChoice) => {
    localStorage.setItem(SOUND_KEY, choice);
    setSoundState(choice);
  }, []);

  const setDnd = useCallback((next: DndSettings) => {
    localStorage.setItem(DND_KEY, JSON.stringify(next));
    setDndState(next);
  }, []);

  const isDndActive = useCallback(() => isInDndWindow(new Date(), dnd), [dnd]);

  const playPreview = useCallback((choice?: SoundChoice) => {
    playSyntheticSound(choice ?? sound);
  }, [sound]);

  return { sound, setSound, dnd, setDnd, isDndActive, playPreview };
}
