import { verifyToken } from "@clerk/backend";

export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const authHeader = ctx.request.header.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");

    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      const clerkId = verified.sub;
      const email = verified.email as string | undefined;
      const username =
        (verified.username as string | undefined) ||
        (verified.email as string | undefined) ||
        clerkId;

      const existing = await strapi.documents("api::player.player").findFirst({
        filters: { clerkId },
      });

      if (existing) {
        ctx.state.player = existing;
      } else {
        const created = await strapi.documents("api::player.player").create({
          data: {
            clerkId,
            email: email || `${clerkId}@clerk.user`,
            username: username || clerkId,
          },
        });
        ctx.state.player = created;
      }
    } catch (error) {
      strapi.log.error("Clerk token verification failed:", error);
      ctx.status = 401;
      ctx.body = { error: "Invalid or expired token" };
      return;
    }

    return next();
  };
};
