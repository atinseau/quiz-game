import type { GameState } from "../types";

const STATE_KEY = "quiz-state";
const COMPLETED_KEY = "quiz-completed-packs";

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

export function getCompletedSlugs(): string[] {
  return JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]") as string[];
}

export function markPackCompleted(slug: string): void {
  const completed = getCompletedSlugs();
  if (!completed.includes(slug)) {
    completed.push(slug);
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
  }
}
