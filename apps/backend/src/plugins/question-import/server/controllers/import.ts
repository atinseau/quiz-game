import { createDefaultEmbeddingService } from "../services/embeddings";
import { createKnnSearcher, runCommit, runPreview } from "../services/import";

const MODEL = "text-embedding-3-small";

declare const strapi: any;

async function handleWithErrorMapping(
  ctx: any,
  op: string,
  run: () => Promise<unknown>,
) {
  try {
    const result = await run();
    ctx.body = result;
  } catch (err) {
    const details = (err as any).details;
    if (details) {
      ctx.status = 400;
      ctx.body = { success: false, errors: details };
      return;
    }
    strapi.log.error(`[question-import] ${op} failed`, err);
    ctx.status = 500;
    ctx.body = { success: false, error: (err as Error).message };
  }
}

export default {
  async preview(ctx: any) {
    await handleWithErrorMapping(ctx, "preview", async () => {
      const embeddings = createDefaultEmbeddingService();
      const knn = createKnnSearcher(strapi.db.connection);
      return runPreview(ctx.request.body as any, {
        embeddings,
        knn,
        model: MODEL,
      });
    });
  },

  async commit(ctx: any) {
    await handleWithErrorMapping(ctx, "commit", async () => {
      const embeddings = createDefaultEmbeddingService();
      const knn = createKnnSearcher(strapi.db.connection);
      const summary = await runCommit(ctx.request.body as any, {
        strapi,
        embeddings,
        knn,
      });
      return { success: true, summary };
    });
  },
};
