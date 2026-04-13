import { beforeEach, describe, expect, test } from "bun:test";

const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { for (const k in storage) delete storage[k]; },
  length: 0,
  key: () => null,
};

// Import after mocking localStorage
import { usePackStore } from "./packStore";

describe("packStore", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset store state
    usePackStore.setState({
      selectedChunk: null,
      finishedChunks: [],
    });
  });

  test("selectChunk sets selectedChunk", () => {
    const { selectChunk } = usePackStore.getState();
    selectChunk("chunk-1");
    expect(usePackStore.getState().selectedChunk).toBe("chunk-1");
  });

  test("markFinished adds chunk to finishedChunks and persists to localStorage", () => {
    const { markFinished } = usePackStore.getState();
    markFinished("chunk-1");

    expect(usePackStore.getState().finishedChunks).toContain("chunk-1");
    expect(JSON.parse(localStorage.getItem("quiz-finished-chunks") ?? "[]")).toContain("chunk-1");
  });

  test("markFinished does not duplicate", () => {
    const { markFinished } = usePackStore.getState();
    markFinished("chunk-1");
    markFinished("chunk-1");

    expect(usePackStore.getState().finishedChunks.filter((c) => c === "chunk-1").length).toBe(1);
  });

  test("reset clears selectedChunk but keeps finishedChunks", () => {
    const { selectChunk, markFinished, reset } = usePackStore.getState();
    selectChunk("chunk-1");
    markFinished("chunk-2");
    reset();

    expect(usePackStore.getState().selectedChunk).toBeNull();
    expect(usePackStore.getState().finishedChunks).toContain("chunk-2");
  });
});
