import { describe, expect, test } from "bun:test";
import { createRoom, deleteRoom, getRoom } from "./rooms";
import type { WsData } from "./types";

function fakeWs(data: WsData) {
  return {
    data,
    send: () => {},
    close: () => {},
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any;
}

describe("deleteRoom", () => {
  test("removes the room and clears playerToRoom index", () => {
    const ws = fakeWs({
      clerkId: "u1",
      username: "Alice",
      gender: "homme",
    });
    const room = createRoom(ws);
    expect(getRoom(room.code)).toBeDefined();

    deleteRoom(room.code);

    expect(getRoom(room.code)).toBeUndefined();
  });

  test("is a no-op on unknown code", () => {
    expect(() => deleteRoom("ZZZZZZ")).not.toThrow();
  });
});
