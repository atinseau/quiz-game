import { create } from "zustand";
import type { ApiPack } from "../types";

const STORAGE_KEY = "quiz-completed-packs";

function loadCompletedSlugs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

interface PackState {
  selectedPack: ApiPack | null;
  completedSlugs: string[];
  selectPack: (pack: ApiPack) => void;
  markCompleted: (slug: string) => void;
  reset: () => void;
}

export const usePackStore = create<PackState>((set, get) => ({
  selectedPack: null,
  completedSlugs: loadCompletedSlugs(),

  selectPack: (pack) => set({ selectedPack: pack }),

  markCompleted: (slug) => {
    const current = get().completedSlugs;
    if (current.includes(slug)) return;
    const updated = [...current, slug];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    set({ completedSlugs: updated });
  },

  reset: () => set({ selectedPack: null }),
}));
