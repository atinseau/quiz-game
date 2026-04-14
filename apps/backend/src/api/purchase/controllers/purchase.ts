import { factories } from "@strapi/strapi";
import Stripe from "stripe";
import type { Session } from "stripe/cjs/resources/Checkout/Sessions.js";
import type { Event } from "stripe/cjs/resources/Events.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export default factories.createCoreController(
  "api::purchase.purchase",
  ({ strapi }) => ({
    async checkout(ctx) {
      const player = ctx.state.player;
      if (!player) {
        ctx.status = 401;
        ctx.body = { error: "Authentication required" };
        return;
      }

      const { packSlug } = ctx.request.body as { packSlug?: string };
      if (!packSlug) {
        ctx.status = 400;
        ctx.body = { error: "packSlug is required" };
        return;
      }

      const pack = await strapi
        .documents("api::question-pack.question-pack")
        .findFirst({ filters: { slug: packSlug } });

      if (!pack) {
        ctx.status = 404;
        ctx.body = { error: "Pack not found" };
        return;
      }

      if (pack.isFree) {
        ctx.status = 400;
        ctx.body = { error: "This pack is free" };
        return;
      }

      if (!pack.stripePriceId) {
        ctx.status = 400;
        ctx.body = { error: "Pack not configured for purchase" };
        return;
      }

      const existing = await strapi
        .documents("api::purchase.purchase")
        .findFirst({
          filters: {
            player: { documentId: player.documentId },
            pack: { documentId: pack.documentId },
            status: "completed",
          },
        });

      if (existing) {
        ctx.status = 400;
        ctx.body = { error: "Pack already purchased" };
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: pack.stripePriceId, quantity: 1 }],
        success_url: `${FRONTEND_URL}/play/solo?success=true`,
        cancel_url: `${FRONTEND_URL}/play/solo?canceled=true`,
        metadata: {
          playerDocumentId: player.documentId,
          packSlug: pack.slug,
        },
      });

      ctx.body = { url: session.url };
    },

    async stripeWebhook(ctx) {
      const sig = ctx.request.headers["stripe-signature"] as string;

      // For Strapi v5 with koa, we need the raw body for signature verification.
      // Try multiple approaches to get it.
      let rawBody: string | Buffer;
      const body = ctx.request.body;
      if (typeof body === "string") {
        rawBody = body;
      } else if (Buffer.isBuffer(body)) {
        rawBody = body;
      } else if (
        body &&
        typeof body === "object" &&
        Symbol.for("unparsedBody") in body
      ) {
        rawBody = (body as any)[Symbol.for("unparsedBody")];
      } else {
        rawBody = JSON.stringify(body);
      }

      let event: Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
      } catch (err) {
        strapi.log.error("Stripe webhook signature failed:", err);
        ctx.status = 400;
        ctx.body = { error: "Invalid signature" };
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Session;
        const { playerDocumentId, packSlug } = session.metadata ?? {};

        if (playerDocumentId && packSlug) {
          // Idempotency
          const exists = await strapi
            .documents("api::purchase.purchase")
            .findFirst({ filters: { stripeSessionId: session.id } });

          if (!exists) {
            const pack = await strapi
              .documents("api::question-pack.question-pack")
              .findFirst({ filters: { slug: packSlug } });

            if (pack) {
              await strapi.documents("api::purchase.purchase").create({
                data: {
                  player: playerDocumentId,
                  pack: pack.documentId,
                  stripeSessionId: session.id,
                  stripePaymentIntentId:
                    typeof session.payment_intent === "string"
                      ? session.payment_intent
                      : "",
                  amount: session.amount_total ?? 0,
                  status: "completed",
                },
              });
            }
          }
        }
      }

      ctx.status = 200;
      ctx.body = { received: true };
    },

    async me(ctx) {
      const player = ctx.state.player;
      if (!player) {
        ctx.status = 401;
        ctx.body = { error: "Authentication required" };
        return;
      }

      const purchases = await strapi
        .documents("api::purchase.purchase")
        .findMany({
          filters: {
            player: { documentId: player.documentId },
            status: "completed",
          },
          populate: ["pack"],
        });

      ctx.body = {
        data: (purchases as any[]).map((p) => ({
          packSlug: p.pack?.slug,
          status: p.status,
        })),
      };
    },
  }),
);
