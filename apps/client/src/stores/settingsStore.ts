import { create } from "zustand";

const STORAGE_KEY = "quiz-muted";

interface SettingsState {
  muted: boolean;
  toggleMute: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  muted: localStorage.getItem(STORAGE_KEY) === "true",

  toggleMute: () => {
    const next = !get().muted;
    localStorage.setItem(STORAGE_KEY, String(next));
    set({ muted: next });
  },
}));
