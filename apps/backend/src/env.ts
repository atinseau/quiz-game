/// <reference types="bun-types" />

/**
 * Reads a required environment variable via Bun.env.
 * Throws immediately with a clear message if the variable is absent or empty.
 * No default fallback — callers must ensure the variable is set.
 */
export function requireEnv(name: string): string {
  const value = Bun.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
