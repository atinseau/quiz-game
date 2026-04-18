import { createHash } from "node:crypto";

const DIM = 1536;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function hashToSeed(text: string): number {
  const h = createHash("sha256").update(text).digest();
  return h.readUInt32LE(0);
}

function vectorFromSeed(seed: number): number[] {
  const rand = seededRandom(seed);
  const vec: number[] = new Array(DIM);
  for (let i = 0; i < DIM; i++) vec[i] = rand() * 2 - 1;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

/**
 * Returns a unit vector derived from the text.
 * Identical texts → identical vectors.
 */
export function mockEmbed(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  return vectorFromSeed(hashToSeed(normalized));
}

/**
 * Returns a controlled blend of two seeds so test cases can craft
 * predictable cosine similarities.
 */
export function blendedEmbed(
  baseText: string,
  other: string,
  weight: number,
): number[] {
  const a = mockEmbed(baseText);
  const b = mockEmbed(other);
  const mixed = a.map((v, i) => v * weight + b[i] * (1 - weight));
  const norm = Math.sqrt(mixed.reduce((s, v) => s + v * v, 0));
  return mixed.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
