import { beforeEach, expect, test } from "bun:test";
import { usePlayerStore } from "./playerStore";

beforeEach(() => {
  usePlayerStore.setState({ players: [] });
});

test("addPlayer adds a player and returns true", () => {
  const result = usePlayerStore.getState().addPlayer("Alice");
  expect(result).toBe(true);
  expect(usePlayerStore.getState().players).toEqual(["Alice"]);
});

test("addPlayer trims whitespace", () => {
  const result = usePlayerStore.getState().addPlayer("  Bob  ");
  expect(result).toBe(true);
  expect(usePlayerStore.getState().players).toEqual(["Bob"]);
});

test("addPlayer rejects empty string", () => {
  const result = usePlayerStore.getState().addPlayer("   ");
  expect(result).toBe(false);
  expect(usePlayerStore.getState().players).toEqual([]);
});

test("addPlayer rejects duplicate name", () => {
  usePlayerStore.getState().addPlayer("Alice");
  const result = usePlayerStore.getState().addPlayer("Alice");
  expect(result).toBe(false);
  expect(usePlayerStore.getState().players).toEqual(["Alice"]);
});

test("removePlayer removes a player", () => {
  usePlayerStore.getState().addPlayer("Alice");
  usePlayerStore.getState().addPlayer("Bob");
  usePlayerStore.getState().removePlayer("Alice");
  expect(usePlayerStore.getState().players).toEqual(["Bob"]);
});

test("resetPlayers clears all players", () => {
  usePlayerStore.getState().addPlayer("Alice");
  usePlayerStore.getState().addPlayer("Bob");
  usePlayerStore.getState().resetPlayers();
  expect(usePlayerStore.getState().players).toEqual([]);
});
