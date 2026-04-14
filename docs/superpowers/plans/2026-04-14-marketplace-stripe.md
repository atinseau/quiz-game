# Marketplace Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe Checkout for premium question packs — backend checkout/webhook endpoints, purchase tracking, pack access policy, and frontend lock/buy UI.

**Architecture:** Backend Strapi handles checkout session creation and webhook processing. Client redirects to Stripe Checkout (no card form). TanStack Query hook for purchase state. Policy on question routes blocks access to unpurchased premium packs.

**Tech Stack:** Stripe (checkout sessions, webhooks), Strapi v5, ky, TanStack Query, React

**Spec:** `docs/superpowers/specs/2026-04-14-marketplace-stripe-design.md`

---

## File Structure

### New files (backend)

```
apps/backend/
  src/api/purchase/
    content-types/purchase/schema.json    — Purchase content-type
    routes/purchase.ts                     — factory routes
    routes/custom.ts                       — checkout, webhook, me endpoints
    controllers/purchase.ts                — checkout + webhook + me logic
    services/purchase.ts                   — factory service
  src/api/question/
    policies/check-pack-access.ts          — blocks unpurchased premium packs
    routes/question.ts                     — updated to apply policy
```

### New files (client)

```
apps/client/src/
  hooks/usePurchases.ts                    — TanStack Query hook
  lib/queries/purchases.ts                 — fetch /api/purchases/me
```

### Modified files

```
apps/backend/
  src/api/question-pack/content-types/question-pack/schema.json  — add price field
  config/middlewares.ts                    — skip Clerk auth for webhook route
  package.json                             — add stripe dependency

apps/client/src/
  types.ts                                 — add price to ApiPack
  lib/queries/packs.ts                     — map price field
  components/HomeScreen.tsx                — lock/buy UI on premium packs
  components/LandingPage.tsx               — price badge on preview packs
```

---

## Task 1: Install Stripe + Add price field to QuestionPack

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/api/question-pack/content-types/question-pack/schema.json`

- [ ] **Step 1: Install stripe in backend**

```bash
cd apps/backend && bun add stripe
```

- [ ] **Step 2: Add price field to QuestionPack schema**

Add after `stripePriceId` in the attributes:

```json
"price": {
  "type": "decimal"
}
```

- [ ] **Step 3: Regenerate types and verify**

```bash
cd apps/backend && bun run strapi ts:generate-types && bun run check-types
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/package.json apps/backend/src/api/question-pack/ apps/backend/types/ bun.lock
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): install stripe, add price field to QuestionPack"
```

---

## Task 2: Purchase Content-Type

**Files:**
- Create: `apps/backend/src/api/purchase/content-types/purchase/schema.json`
- Create: `apps/backend/src/api/purchase/routes/purchase.ts`
- Create: `apps/backend/src/api/purchase/services/purchase.ts`

- [ ] **Step 1: Create Purchase schema**

```json
{
  "kind": "collectionType",
  "collectionName": "purchases",
  "info": {
    "singularName": "purchase",
    "pluralName": "purchases",
    "displayName": "Purchase"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "player": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::player.player"
    },
    "pack": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::question-pack.question-pack"
    },
    "stripeSessionId": {
      "type": "string",
      "required": true
    },
    "stripePaymentIntentId": {
      "type": "string"
    },
    "amount": {
      "type": "integer"
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "completed", "refunded"],
      "default": "pending"
    }
  }
}
```

- [ ] **Step 2: Create factory route + service**

```ts
// routes/purchase.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreRouter("api::purchase.purchase");
```

```ts
// services/purchase.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreService("api::purchase.purchase");
```

- [ ] **Step 3: Regenerate types, verify**

```bash
cd apps/backend && bun run strapi ts:generate-types && bun run check-types
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/api/purchase/ apps/backend/types/
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): add Purchase content-type"
```

---

## Task 3: Checkout + Webhook + Me Endpoints

**Files:**
- Create: `apps/backend/src/api/purchase/routes/custom.ts`
- Create: `apps/backend/src/api/purchase/controllers/purchase.ts`
- Modify: `apps/backend/config/middlewares.ts`

- [ ] **Step 1: Create custom routes**

```ts
// apps/backend/src/api/purchase/routes/custom.ts
export default {
  routes: [
    {
      method: "POST",
      path: "/checkout",
      handler: "api::purchase.purchase.checkout",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/webhooks/stripe",
      handler: "api::purchase.purchase.stripeWebhook",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/purchases/me",
      handler: "api::purchase.purchase.me",
      config: { auth: false },
    },
  ],
};
```

- [ ] **Step 2: Create controller with checkout, webhook, me**

```ts
// apps/backend/src/api/purchase/controllers/purchase.ts
import { factories } from "@strapi/strapi";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-04-30.basil",
});

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export default factories.createCoreController(
  "api::purchase.purchase",
  ({ strapi }) => ({
    // POST /api/checkout
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

      // Find pack
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

      // Check if already purchased
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

      // Create Stripe Checkout session
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

    // POST /api/webhooks/stripe
    async stripeWebhook(ctx) {
      const sig = ctx.request.headers["stripe-signature"];
      const rawBody = ctx.request.body;

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          rawBody as string | Buffer,
          sig as string,
          WEBHOOK_SECRET,
        );
      } catch (err) {
        strapi.log.error("Stripe webhook signature verification failed:", err);
        ctx.status = 400;
        ctx.body = { error: "Invalid signature" };
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { playerDocumentId, packSlug } = session.metadata ?? {};

        if (!playerDocumentId || !packSlug) {
          strapi.log.warn("Stripe webhook: missing metadata");
          ctx.status = 200;
          ctx.body = { received: true };
          return;
        }

        // Idempotency check
        const existingPurchase = await strapi
          .documents("api::purchase.purchase")
          .findFirst({ filters: { stripeSessionId: session.id } });

        if (!existingPurchase) {
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
                    : session.payment_intent?.id ?? "",
                amount: session.amount_total ?? 0,
                status: "completed",
              },
            });
          }
        }
      }

      ctx.status = 200;
      ctx.body = { received: true };
    },

    // GET /api/purchases/me
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
        data: purchases.map((p: any) => ({
          packSlug: p.pack?.slug,
          status: p.status,
        })),
      };
    },
  }),
);
```

- [ ] **Step 3: Update middlewares to skip Clerk auth for webhook**

Read `apps/backend/config/middlewares.ts`. The Clerk auth middleware skips non-API routes but the webhook IS an API route. Update the `clerk-auth.ts` middleware to also skip `/api/webhooks/`:

In `apps/backend/src/middlewares/clerk-auth.ts`, add after the existing skip check:

```ts
// Skip webhook routes (Stripe sends its own signature, not Clerk JWT)
if (ctx.request.url.startsWith("/api/webhooks/")) {
  return next();
}
```

Also, the webhook needs raw body for signature verification. Strapi's body parser may parse it as JSON. We need to configure the body parser to give us the raw body for the webhook route. Add a middleware config or use `ctx.request.body` which Strapi may already provide as raw for non-JSON content types.

Actually, for Strapi v5 with koa body parser, the raw body is available via `ctx.request.body` when content-type is not JSON. Stripe sends JSON but we need the raw string. The simplest approach: use a custom koa middleware that captures raw body before parsing.

Alternative: configure the Strapi body parser to expose raw body. In `config/middlewares.ts`, the `strapi::body` middleware can be configured:

```ts
{
  name: "strapi::body",
  config: {
    includeUnparsed: true,
  },
},
```

This makes `ctx.request.body[Symbol.for("unparsedBody")]` available. Then in the webhook controller:

```ts
const rawBody = (ctx.request.body as any)[Symbol.for("unparsedBody")];
```

- [ ] **Step 4: Verify types**

```bash
cd apps/backend && bun run check-types
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/purchase/ apps/backend/src/middlewares/ apps/backend/config/
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): add checkout, webhook, and purchases/me endpoints"
```

---

## Task 4: Pack Access Policy

**Files:**
- Create: `apps/backend/src/api/question/policies/check-pack-access.ts`
- Modify: `apps/backend/src/api/question/routes/question.ts`

- [ ] **Step 1: Create the policy**

```ts
// apps/backend/src/api/question/policies/check-pack-access.ts
export default async (ctx, config, { strapi }) => {
  // Extract pack slug from query filters
  const packSlug =
    ctx.query?.filters?.pack?.slug?.["$eq"] ??
    ctx.query?.filters?.["pack.slug"]?.["$eq"];

  if (!packSlug) {
    // No pack filter — allow (other filtering will handle it)
    return true;
  }

  // Find the pack
  const pack = await strapi
    .documents("api::question-pack.question-pack")
    .findFirst({ filters: { slug: packSlug } });

  if (!pack) {
    ctx.status = 404;
    return false;
  }

  // Free packs are always accessible
  if (pack.isFree) {
    return true;
  }

  // Premium pack — check for purchase
  const player = ctx.state.player;
  if (!player) {
    ctx.status = 403;
    ctx.body = { error: "Authentication required for premium packs" };
    return false;
  }

  const purchase = await strapi
    .documents("api::purchase.purchase")
    .findFirst({
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
```

- [ ] **Step 2: Apply policy to question routes**

Replace the factory router with a custom config:

```ts
// apps/backend/src/api/question/routes/question.ts
import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::question.question", {
  config: {
    find: {
      policies: ["api::question.check-pack-access"],
    },
  },
});
```

- [ ] **Step 3: Verify**

```bash
cd apps/backend && bun run check-types
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/api/question/
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): add pack access policy for premium questions"
```

---

## Task 5: Client — Price in ApiPack + Purchase Hook

**Files:**
- Modify: `apps/client/src/types.ts`
- Modify: `apps/client/src/lib/queries/packs.ts`
- Create: `apps/client/src/lib/queries/purchases.ts`
- Create: `apps/client/src/hooks/usePurchases.ts`

- [ ] **Step 1: Add price to ApiPack type**

In `apps/client/src/types.ts`, add `price: number | null;` to the `ApiPack` interface.

- [ ] **Step 2: Map price in fetchPacks**

In `apps/client/src/lib/queries/packs.ts`, add `price: pack.price ?? null` to the map function.

- [ ] **Step 3: Create purchases query**

```ts
// apps/client/src/lib/queries/purchases.ts
import { api } from "../api";

export async function fetchMyPurchases(): Promise<string[]> {
  const json = await api.get("purchases/me").json<{ data: { packSlug: string }[] }>();
  return json.data.map((p) => p.packSlug);
}
```

- [ ] **Step 4: Create usePurchases hook**

```ts
// apps/client/src/hooks/usePurchases.ts
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyPurchases } from "../lib/queries/purchases";

export function usePurchases() {
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["purchases", "me"],
    queryFn: fetchMyPurchases,
    enabled: !!isSignedIn,
    initialData: [],
  });
}
```

- [ ] **Step 5: Verify and commit**

```bash
cd apps/client && bunx tsc --noEmit
git add apps/client/src/types.ts apps/client/src/lib/queries/ apps/client/src/hooks/usePurchases.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): add price to ApiPack, purchases hook"
```

---

## Task 6: HomeScreen — Lock/Buy UI

**Files:**
- Modify: `apps/client/src/components/HomeScreen.tsx`

- [ ] **Step 1: Integrate purchases into HomeScreen**

Read `apps/client/src/components/HomeScreen.tsx`. In the pack grid rendering, add purchase logic:

1. Import `usePurchases` and `api` (for checkout):
```tsx
import { usePurchases } from "../hooks/usePurchases";
import { api } from "../lib/api";
import { Lock } from "lucide-react";
```

2. In the component, get purchases:
```tsx
const { data: purchasedSlugs = [] } = usePurchases();
```

3. For each pack card, determine state:
```tsx
const isLocked = !pack.isFree && !purchasedSlugs.includes(pack.slug);
const isPurchased = !pack.isFree && purchasedSlugs.includes(pack.slug);
```

4. Update pack card UI:
- If `isLocked`: show Lock icon + price badge, onClick → call checkout
- If `isPurchased`: show "Possédé ✓" badge, onClick → select pack normally
- If `isFree`: normal behavior (existing)

5. Checkout handler:
```tsx
const handleBuy = async (packSlug: string) => {
  const { url } = await api.post("checkout", { json: { packSlug } }).json<{ url: string }>();
  window.location.href = url;
};
```

6. On pack card click:
```tsx
onClick={() => {
  if (isLocked) {
    handleBuy(pack.slug);
  } else {
    selectPack(pack);
    setStep("players");
  }
}}
```

7. Visual indicators on the card:
```tsx
{isLocked && (
  <div className="absolute top-2 right-2 flex items-center gap-1">
    <Lock className="w-3 h-3 text-white" />
    <Badge className="bg-amber-500/90 text-white border-none text-xs">
      {pack.price?.toFixed(2)}€
    </Badge>
  </div>
)}
{isPurchased && (
  <div className="absolute top-2 right-2">
    <Badge className="bg-green-500/90 text-white border-none text-xs">
      Possédé ✓
    </Badge>
  </div>
)}
```

- [ ] **Step 2: Update LandingPage preview**

Read `apps/client/src/components/LandingPage.tsx`. Add price badges on preview pack cards:

```tsx
{!pack.isFree && pack.price && (
  <p className="text-xs text-amber-300 mt-1">{pack.price.toFixed(2)}€</p>
)}
```

- [ ] **Step 3: Verify and commit**

```bash
cd apps/client && bunx tsc --noEmit
git add apps/client/src/components/HomeScreen.tsx apps/client/src/components/LandingPage.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): add lock/buy UI for premium packs"
```

---

## Task 7: Bootstrap Permissions + E2E Tests

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/client/tests/`

- [ ] **Step 1: Add public permissions for Purchase endpoints**

In `apps/backend/src/index.ts`, add the Purchase permissions to the bootstrap:

```ts
const PUBLIC_PERMISSIONS = [
  // ... existing ...
  "api::purchase.purchase.checkout",
  "api::purchase.purchase.stripeWebhook",
  "api::purchase.purchase.me",
];
```

Wait — the checkout and me endpoints require Clerk auth (ctx.state.player). They shouldn't be public in the users-permissions sense. They're `auth: false` in the route config meaning Strapi's built-in auth is disabled, but our Clerk middleware handles auth.

The webhook endpoint needs to be accessible without any auth. It's already `auth: false` and we skip Clerk for `/api/webhooks/`.

For `checkout` and `me`, they need the Clerk middleware to run (to set ctx.state.player) but don't need Strapi users-permissions. Since they're `auth: false` in route config, Strapi won't check users-permissions. The Clerk middleware runs because it's global. This should work.

- [ ] **Step 2: Run existing E2E tests**

```bash
cd apps/client && bunx playwright test --reporter=line
```

All tests should pass — the marketplace changes don't affect existing game flows (packs are still free in test data).

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add apps/backend/ apps/client/tests/
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(marketplace): finalize permissions and verify E2E"
```
