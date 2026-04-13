import type { Core } from "@strapi/strapi";

const PUBLIC_PERMISSIONS = [
  "api::question-pack.question-pack.find",
  "api::question-pack.question-pack.findOne",
  "api::question.question.find",
  "api::question.question.findOne",
  "api::category.category.find",
  "api::category.category.findOne",
];

async function ensurePublicPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi
    .documents("plugin::users-permissions.role")
    .findFirst({
      filters: { type: "public" },
      populate: ["permissions"],
    });

  if (!publicRole) {
    strapi.log.warn("Public role not found — skipping permission setup");
    return;
  }

  const existing = new Set(
    ((publicRole as any).permissions ?? []).map((p: any) => p.action),
  );

  for (const action of PUBLIC_PERMISSIONS) {
    if (existing.has(action)) continue;
    await strapi
      .documents("plugin::users-permissions.permission")
      .create({ data: { action, role: publicRole.documentId } });
    strapi.log.info(`[bootstrap] Granted public permission: ${action}`);
  }
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensurePublicPermissions(strapi);
  },
};
