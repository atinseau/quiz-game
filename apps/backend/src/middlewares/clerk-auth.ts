import { verifyToken } from "@clerk/backend";
import type { Core } from "@strapi/strapi";

const clerkAuth: Core.MiddlewareFactory = (_config, { strapi }) => {
  return async (ctx, next) => {
    // Skip non-API routes (admin panel, uploads, etc.)
    if (!ctx.request.url.startsWith("/api/")) {
      return next();
    }

    // Skip webhook routes (Stripe sends its own signature, not Clerk JWT)
    if (ctx.request.url.startsWith("/api/webhooks/")) {
      return next();
    }

    const authHeader = ctx.request.header.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");

    // Remove the Authorization header so Strapi's users-permissions plugin
    // doesn't try to verify it as a Strapi JWT (which would fail and return 401).
    // We handle auth ourselves via Clerk.
    delete ctx.request.headers.authorization;

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
      // Token invalid/expired — don't block the request.
      // Public routes will work without ctx.state.player.
      // Protected routes check ctx.state.player themselves.
      strapi.log.warn("Clerk token verification failed:", error);
    }

    return next();
  };
};

export default clerkAuth;
