import { MAX_COMBO } from "../types";

/** Fisher-Yates shuffle (returns new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    // biome-ignore lint/style/noNonNullAssertion: bounds guaranteed by loop
    a[i] = a[j]!;
    // biome-ignore lint/style/noNonNullAssertion: bounds guaranteed by loop
    a[j] = tmp!;
  }
  return a;
}

/** Increment combo, clamped to MAX_COMBO. */
export function clampCombo(current: number): number {
  return Math.min(current + 1, MAX_COMBO);
}
