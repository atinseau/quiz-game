import { create } from "zustand";

interface PlayerState {
  players: string[];
  addPlayer: (name: string) => boolean;
  removePlayer: (name: string) => void;
  resetPlayers: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  players: [],

  addPlayer: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || get().players.includes(trimmed)) return false;
    set((s) => ({ players: [...s.players, trimmed] }));
    return true;
  },

  removePlayer: (name: string) => {
    set((s) => ({ players: s.players.filter((p) => p !== name) }));
  },

  resetPlayers: () => {
    set({ players: [] });
  },
}));
