import type { GameState } from "../types";

const STATE_KEY = "quiz-state";
const FINISHED_KEY = "quiz-finished-chunks";

export function saveGameState(state: GameState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function loadGameState(): GameState | null {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  localStorage.removeItem(STATE_KEY);
}

export function getFinishedChunks(): string[] {
  return JSON.parse(localStorage.getItem(FINISHED_KEY) || "[]") as string[];
}

export function markChunkFinished(chunkFile: string): void {
  const finished = getFinishedChunks();
  if (!finished.includes(chunkFile)) {
    finished.push(chunkFile);
    localStorage.setItem(FINISHED_KEY, JSON.stringify(finished));
  }
}
