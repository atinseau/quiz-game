/**
 * Join names with commas and a final "et" — "Alice", "Alice et Bob", "Alice, Bob et Carol".
 * Originally local to petit-buveur.ts ; now shared so the client can format the same way
 * as the server when rendering personalized drink alerts.
 */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/**
 * Capitalize the first character. Used to render `action` strings as standalone
 * lines ("Boire une gorgée") while keeping them lowercase in code.
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
