import { beforeEach, describe, expect, test } from "bun:test";

const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    for (const k in storage) delete storage[k];
  },
  length: 0,
  key: () => null,
};

import type { ApiPack } from "../types";
import { usePackStore } from "./packStore";

const fakePack: ApiPack = {
  documentId: "doc-1",
  slug: "pack-1",
  name: "Pack 1",
  description: "desc",
  icon: "🎯",
  gradient: "from-blue-500 to-blue-700",
  isFree: true,
  published: true,
  displayOrder: 0,
  questionCount: 10,
  price: null,
};

describe("packStore", () => {
  beforeEach(() => {
    localStorage.clear();
    usePackStore.setState({
      selectedPack: null,
      completedSlugs: [],
    });
  });

  test("selectPack sets selectedPack", () => {
    const { selectPack } = usePackStore.getState();
    selectPack(fakePack);
    expect(usePackStore.getState().selectedPack).toEqual(fakePack);
  });

  test("markCompleted adds slug to completedSlugs and persists to localStorage", () => {
    const { markCompleted } = usePackStore.getState();
    markCompleted("pack-1");

    expect(usePackStore.getState().completedSlugs).toContain("pack-1");
    expect(
      JSON.parse(localStorage.getItem("quiz-completed-packs") ?? "[]"),
    ).toContain("pack-1");
  });

  test("markCompleted does not duplicate", () => {
    const { markCompleted } = usePackStore.getState();
    markCompleted("pack-1");
    markCompleted("pack-1");

    expect(
      usePackStore.getState().completedSlugs.filter((c) => c === "pack-1")
        .length,
    ).toBe(1);
  });

  test("reset clears selectedPack", () => {
    const { selectPack, markCompleted, reset } = usePackStore.getState();
    selectPack(fakePack);
    markCompleted("pack-2");
    reset();

    expect(usePackStore.getState().selectedPack).toBeNull();
  });
});
