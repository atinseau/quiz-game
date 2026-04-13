import { create } from "zustand";
import type { Gender, Player } from "../types";

interface PlayerState {
  players: Player[];
  addPlayer: (name: string, gender: Gender) => boolean;
  removePlayer: (name: string) => void;
  resetPlayers: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  players: [],

  addPlayer: (name: string, gender: Gender) => {
    const trimmed = name.trim();
    if (!trimmed || get().players.some((p) => p.name === trimmed)) return false;
    set((s) => ({ players: [...s.players, { name: trimmed, gender }] }));
    return true;
  },

  removePlayer: (name: string) => {
    set((s) => ({ players: s.players.filter((p) => p.name !== name) }));
  },

  resetPlayers: () => {
    set({ players: [] });
  },
}));
