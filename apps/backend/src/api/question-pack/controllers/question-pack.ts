import { factories } from "@strapi/strapi";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const VALID_TYPES = ["qcm", "vrai_faux", "texte"] as const;

interface ImportPack {
  slug?: string;
  name?: string;
  description?: string;
  icon?: string;
  gradient?: string;
}

interface ImportQuestion {
  category?: string;
  type?: string;
  question?: string;
  choices?: unknown;
  answer?: string;
}

interface ImportBody {
  pack?: ImportPack;
  questions?: ImportQuestion[];
}

interface StrapiDoc {
  documentId: string;
  slug?: string;
  packs?: StrapiDoc[];
  [key: string]: unknown;
}

function validateBody(body: ImportBody): string[] {
  const errors: string[] = [];

  if (!body.pack) {
    errors.push("pack is required");
    return errors;
  }

  if (
    !body.pack.slug ||
    typeof body.pack.slug !== "string" ||
    body.pack.slug.trim() === ""
  ) {
    errors.push("pack.slug is required and must be a non-empty string");
  }

  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push("questions must be a non-empty array");
  }

  if (Array.isArray(body.questions)) {
    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      const prefix = `questions[${i}]`;

      if (!q.category || typeof q.category !== "string") {
        errors.push(`${prefix}.category is required and must be a string`);
      }

      if (
        !q.type ||
        !VALID_TYPES.includes(q.type as (typeof VALID_TYPES)[number])
      ) {
        errors.push(`${prefix}.type must be one of: ${VALID_TYPES.join(", ")}`);
      }

      if (!q.question || typeof q.question !== "string") {
        errors.push(`${prefix}.question is required and must be a string`);
      }

      if (!q.answer || typeof q.answer !== "string") {
        errors.push(`${prefix}.answer is required and must be a string`);
      }

      if (q.type === "qcm") {
        if (
          !Array.isArray(q.choices) ||
          q.choices.length !== 4 ||
          !q.choices.every((c: unknown) => typeof c === "string")
        ) {
          errors.push(
            `${prefix}.choices must be an array of exactly 4 strings when type is qcm`,
          );
        }
      }

      if (q.type === "vrai_faux") {
        if (q.answer !== "true" && q.answer !== "false") {
          errors.push(
            `${prefix}.answer must be "true" or "false" when type is vrai_faux`,
          );
        }
      }
    }
  }

  return errors;
}

export default factories.createCoreController(
  "api::question-pack.question-pack",
  () => ({
    async importPack(ctx) {
      const body = ctx.request.body as ImportBody;

      // Validate input
      const errors = validateBody(body);

      // Check if pack exists (needed for pack.name validation)
      let existingPack: StrapiDoc | null = null;
      if (
        body.pack?.slug &&
        typeof body.pack.slug === "string" &&
        body.pack.slug.trim() !== ""
      ) {
        const found = await strapi
          .documents("api::question-pack.question-pack")
          .findFirst({ filters: { slug: body.pack.slug } });

        existingPack = found as StrapiDoc | null;

        if (
          !existingPack &&
          (!body.pack.name ||
            typeof body.pack.name !== "string" ||
            body.pack.name.trim() === "")
        ) {
          errors.push("pack.name is required when creating a new pack");
        }
      }

      if (errors.length > 0) {
        ctx.status = 400;
        ctx.body = { success: false, errors };
        return;
      }

      // After validation, pack and questions are guaranteed to exist
      const packInput = body.pack as ImportPack & { slug: string };
      const questionsInput = body.questions as ImportQuestion[];

      // Upsert pack
      let packStatus: "created" | "existing";
      let pack: StrapiDoc;

      if (existingPack) {
        pack = existingPack;
        packStatus = "existing";
      } else {
        const created = await strapi
          .documents("api::question-pack.question-pack")
          .create({
            data: {
              slug: packInput.slug,
              name: packInput.name as string,
              description: packInput.description ?? null,
              icon: packInput.icon ?? null,
              gradient: packInput.gradient ?? null,
              isFree: true,
            },
          });
        pack = created as unknown as StrapiDoc;
        packStatus = "created";
      }

      // Collect unique category names
      const uniqueCategoryNames = [
        ...new Set(questionsInput.map((q) => q.category as string)),
      ];

      // Upsert categories and link to pack
      const categorySummary: {
        name: string;
        status: "created" | "existing";
      }[] = [];
      const categoryMap = new Map<string, StrapiDoc>();

      for (const catName of uniqueCategoryNames) {
        let category: StrapiDoc | null = null;
        let catStatus: "created" | "existing";

        const found = await strapi
          .documents("api::category.category")
          .findFirst({
            filters: { name: catName },
            populate: ["packs"],
          });

        if (found) {
          category = found as unknown as StrapiDoc;
          catStatus = "existing";
        } else {
          const created = await strapi
            .documents("api::category.category")
            .create({
              data: {
                name: catName,
                slug: slugify(catName),
              },
            });
          // Re-fetch with packs populated
          const refetched = await strapi
            .documents("api::category.category")
            .findFirst({
              filters: { documentId: created.documentId },
              populate: ["packs"],
            });
          category = refetched as unknown as StrapiDoc;
          catStatus = "created";
        }

        if (category) {
          // Link category to pack if not already linked
          const linkedPackIds: string[] = (category.packs ?? []).map(
            (p) => p.documentId,
          );
          if (!linkedPackIds.includes(pack.documentId)) {
            await strapi.documents("api::category.category").update({
              documentId: category.documentId,
              data: {
                packs: [...linkedPackIds, pack.documentId],
              },
            });
          }

          categoryMap.set(catName, category);
        }

        categorySummary.push({ name: catName, status: catStatus });
      }

      // Create questions
      let createdCount = 0;

      for (const q of questionsInput) {
        const category = categoryMap.get(q.category as string);

        await strapi.documents("api::question.question").create({
          data: {
            type: q.type as "qcm" | "vrai_faux" | "texte",
            text: q.question as string,
            choices: q.type === "qcm" ? (q.choices as string[]) : null,
            answer: q.answer as string,
            category: category?.documentId,
            pack: pack.documentId,
          },
        });

        createdCount++;
      }

      ctx.status = 200;
      ctx.body = {
        success: true,
        summary: {
          pack: { slug: pack.slug, status: packStatus },
          categories: categorySummary,
          questions: { created: createdCount, total: questionsInput.length },
        },
      };
    },
  }),
);
