import { createHash } from "node:crypto";
import OpenAI from "openai";

export interface EmbeddingService {
  embedBatch(texts: string[]): Promise<number[][]>;
}

interface EmbeddingClient {
  embeddings: {
    create(args: { model: string; input: string[] }): Promise<{
      data: Array<{ embedding: number[] }>;
    }>;
  };
}

interface Options {
  client: EmbeddingClient;
  model: string;
  cacheSize?: number;
}

export function createEmbeddingService(opts: Options): EmbeddingService {
  const cache = new Map<string, number[]>();
  const maxSize = opts.cacheSize ?? 1000;

  function cacheKey(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  function get(text: string): number[] | undefined {
    return cache.get(cacheKey(text));
  }

  function put(text: string, vec: number[]): void {
    const key = cacheKey(text);
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, vec);
  }

  return {
    async embedBatch(texts) {
      const missing: string[] = [];
      const missingSet = new Set<string>();
      for (const t of texts) {
        if (!get(t) && !missingSet.has(t)) {
          missing.push(t);
          missingSet.add(t);
        }
      }

      if (missing.length > 0) {
        const resp = await opts.client.embeddings.create({
          model: opts.model,
          input: missing,
        });
        resp.data.forEach((d, i) => put(missing[i], d.embedding));
      }

      return texts.map((t) => {
        const vec = get(t);
        if (!vec) throw new Error(`Missing embedding for text: ${t}`);
        return vec;
      });
    },
  };
}

export function createDefaultEmbeddingService(): EmbeddingService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set — cannot use question-import plugin",
    );
  }
  const client = new OpenAI({ apiKey }) as unknown as EmbeddingClient;
  return createEmbeddingService({
    client,
    model: "text-embedding-3-small",
  });
}
