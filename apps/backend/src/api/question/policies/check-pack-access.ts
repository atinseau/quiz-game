export default async (ctx, _config, { strapi }) => {
  const packSlug =
    // biome-ignore lint/complexity/useLiteralKeys: $eq is not a valid identifier
    ctx.query?.filters?.pack?.slug?.["$eq"] ??
    // biome-ignore lint/complexity/useLiteralKeys: $eq is not a valid identifier
    ctx.query?.filters?.["pack.slug"]?.["$eq"];

  if (!packSlug) return true;

  const pack = await strapi
    .documents("api::question-pack.question-pack")
    .findFirst({ filters: { slug: packSlug } });

  if (!pack) {
    ctx.status = 404;
    return false;
  }

  if (pack.isFree) return true;

  const player = ctx.state.player;
  if (!player) {
    ctx.status = 403;
    ctx.body = { error: "Authentication required for premium packs" };
    return false;
  }

  const purchase = await strapi.documents("api::purchase.purchase").findFirst({
    filters: {
      player: { documentId: player.documentId },
      pack: { documentId: pack.documentId },
      status: "completed",
    },
  });

  if (!purchase) {
    ctx.status = 403;
    ctx.body = { error: "Pack not purchased" };
    return false;
  }

  return true;
};
