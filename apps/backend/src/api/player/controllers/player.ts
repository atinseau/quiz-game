import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::player.player", () => ({
  async me(ctx: any) {
    if (!ctx.state.player) {
      return ctx.unauthorized("No valid Clerk token provided");
    }
    return ctx.send({ data: ctx.state.player });
  },
}));
