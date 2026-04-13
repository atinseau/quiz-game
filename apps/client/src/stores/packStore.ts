import { create } from "zustand";
import { fetchPacks } from "../lib/api";
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
  packs: ApiPack[];
  selectedPack: ApiPack | null;
  completedSlugs: string[];
  loading: boolean;
  loadPacks: () => Promise<void>;
  selectPack: (pack: ApiPack) => void;
  markCompleted: (slug: string) => void;
  reset: () => void;
}

export const usePackStore = create<PackState>((set, get) => ({
  packs: [],
  selectedPack: null,
  completedSlugs: loadCompletedSlugs(),
  loading: false,

  loadPacks: async () => {
    if (get().packs.length > 0) return;
    set({ loading: true });
    try {
      const packs = await fetchPacks();
      set({ packs, loading: false });
    } catch (e) {
      console.error("Failed to load packs:", e);
      set({ loading: false });
    }
  },

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
