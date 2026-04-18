import { test, expect, describe } from "bun:test";
import { createEmbeddingService } from "../../src/plugins/question-import/server/services/embeddings";

function makeFakeClient(returnVec: (t: string) => number[] = (t) => [t.length, 0, 0]) {
  const calls: string[][] = [];
  return {
    calls,
    embeddings: {
      create: async ({ input }: { input: string[] }) => {
        calls.push(input);
        return {
          data: input.map((t) => ({ embedding: returnVec(t) })),
        };
      },
    },
  };
}

describe("embeddings service", () => {
  test("batches all texts in a single API call", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    const result = await svc.embedBatch(["a", "b", "c"]);
    expect(client.calls.length).toBe(1);
    expect(client.calls[0]).toEqual(["a", "b", "c"]);
    expect(result.length).toBe(3);
  });

  test("cache hits skip the API", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    await svc.embedBatch(["hello"]);
    await svc.embedBatch(["hello"]);
    expect(client.calls.length).toBe(1);
  });

  test("partial cache hit → only missing texts sent", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    await svc.embedBatch(["a", "b"]);
    await svc.embedBatch(["b", "c", "a"]);
    expect(client.calls[1]).toEqual(["c"]);
  });

  test("preserves order of input in result", async () => {
    const client = makeFakeClient((t) => [t.charCodeAt(0), 0, 0]);
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    const [va, vb] = await svc.embedBatch(["a", "b"]);
    expect(va[0]).toBe("a".charCodeAt(0));
    expect(vb[0]).toBe("b".charCodeAt(0));
  });

  test("throws when OpenAI client errors", async () => {
    const client = {
      embeddings: {
        create: async () => {
          throw new Error("rate limit");
        },
      },
    };
    const svc = createEmbeddingService({ client: client as any, model: "test" });
    expect(svc.embedBatch(["x"])).rejects.toThrow("rate limit");
  });

  test("LRU: bumps recency on hit, evicts least-recently-used", async () => {
    const client = makeFakeClient();
    const svc = createEmbeddingService({
      client: client as any,
      model: "test",
      cacheSize: 2,
    });
    await svc.embedBatch(["a"]); // cache = [a]
    await svc.embedBatch(["b"]); // cache = [a, b]
    await svc.embedBatch(["a"]); // hit; LRU order = [b, a] (b oldest)
    await svc.embedBatch(["c"]); // evict b (oldest after bump), cache = [a, c]

    // Now request "a" again — should be cache hit
    const before = client.calls.length;
    await svc.embedBatch(["a"]);
    expect(client.calls.length).toBe(before); // no new call

    // Request "b" — should trigger a new call since it was evicted
    await svc.embedBatch(["b"]);
    expect(client.calls.length).toBe(before + 1);
  });
});
