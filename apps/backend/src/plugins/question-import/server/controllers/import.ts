export default {
  async preview(ctx: any) {
    ctx.status = 501;
    ctx.body = { error: "not implemented" };
  },
  async commit(ctx: any) {
    ctx.status = 501;
    ctx.body = { error: "not implemented" };
  },
};
