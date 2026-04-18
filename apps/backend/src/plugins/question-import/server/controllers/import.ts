import { runPreview, runCommit, createKnnSearcher } from "../services/import";
import { createDefaultEmbeddingService } from "../services/embeddings";

const MODEL = "text-embedding-3-small";

declare const strapi: any;

export default {
  async preview(ctx: any) {
    try {
      const embeddings = createDefaultEmbeddingService();
      const knn = createKnnSearcher(strapi.db.connection);
      const result = await runPreview(ctx.request.body as any, {
        embeddings,
        knn,
        model: MODEL,
      });
      ctx.body = result;
    } catch (err) {
      const details = (err as any).details;
      if (details) {
        ctx.status = 400;
        ctx.body = { success: false, errors: details };
        return;
      }
      strapi.log.error("[question-import] preview failed", err);
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },

  async commit(ctx: any) {
    try {
      const embeddings = createDefaultEmbeddingService();
      const knn = createKnnSearcher(strapi.db.connection);
      const summary = await runCommit(ctx.request.body as any, {
        strapi,
        embeddings,
        knn,
      });
      ctx.body = { success: true, summary };
    } catch (err) {
      const details = (err as any).details;
      if (details) {
        ctx.status = 400;
        ctx.body = { success: false, errors: details };
        return;
      }
      strapi.log.error("[question-import] commit failed", err);
      ctx.status = 500;
      ctx.body = { success: false, error: (err as Error).message };
    }
  },
};
