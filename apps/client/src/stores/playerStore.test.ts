import { beforeEach, expect, test } from "bun:test";
import { usePlayerStore } from "./playerStore";

beforeEach(() => {
  usePlayerStore.setState({ players: [] });
});

test("addPlayer adds a player and returns true", () => {
  const result = usePlayerStore.getState().addPlayer("Alice", "femme");
  expect(result).toBe(true);
  expect(usePlayerStore.getState().players).toEqual([
    { name: "Alice", gender: "femme" },
  ]);
});

test("addPlayer trims whitespace", () => {
  const result = usePlayerStore.getState().addPlayer("  Bob  ", "homme");
  expect(result).toBe(true);
  expect(usePlayerStore.getState().players).toEqual([
    { name: "Bob", gender: "homme" },
  ]);
});

test("addPlayer rejects empty string", () => {
  const result = usePlayerStore.getState().addPlayer("   ", "homme");
  expect(result).toBe(false);
  expect(usePlayerStore.getState().players).toEqual([]);
});

test("addPlayer rejects duplicate name", () => {
  usePlayerStore.getState().addPlayer("Alice", "femme");
  const result = usePlayerStore.getState().addPlayer("Alice", "homme");
  expect(result).toBe(false);
  expect(usePlayerStore.getState().players).toEqual([
    { name: "Alice", gender: "femme" },
  ]);
});

test("removePlayer removes a player", () => {
  usePlayerStore.getState().addPlayer("Alice", "femme");
  usePlayerStore.getState().addPlayer("Bob", "homme");
  usePlayerStore.getState().removePlayer("Alice");
  expect(usePlayerStore.getState().players).toEqual([
    { name: "Bob", gender: "homme" },
  ]);
});

test("resetPlayers clears all players", () => {
  usePlayerStore.getState().addPlayer("Alice", "femme");
  usePlayerStore.getState().addPlayer("Bob", "homme");
  usePlayerStore.getState().resetPlayers();
  expect(usePlayerStore.getState().players).toEqual([]);
});
