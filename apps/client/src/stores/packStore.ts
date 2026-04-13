import { create } from "zustand";

const FINISHED_KEY = "quiz-finished-chunks";

function loadFinished(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FINISHED_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

interface PackState {
  selectedChunk: string | null;
  finishedChunks: string[];
  selectChunk: (chunk: string) => void;
  markFinished: (chunk: string) => void;
  reset: () => void;
}

export const usePackStore = create<PackState>((set, get) => ({
  selectedChunk: null,
  finishedChunks: loadFinished(),

  selectChunk: (chunk: string) => {
    set({ selectedChunk: chunk });
  },

  markFinished: (chunk: string) => {
    const current = get().finishedChunks;
    if (current.includes(chunk)) return;
    const updated = [...current, chunk];
    localStorage.setItem(FINISHED_KEY, JSON.stringify(updated));
    set({ finishedChunks: updated });
  },

  reset: () => {
    set({ selectedChunk: null, finishedChunks: loadFinished() });
  },
}));
