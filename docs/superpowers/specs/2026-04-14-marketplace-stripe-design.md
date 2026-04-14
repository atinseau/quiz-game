# Marketplace Stripe — Design

> Version: 1.0 — 14 avril 2026

## Objectif

Permettre la vente de packs de questions premium via Stripe Checkout. Les 14 packs existants restent gratuits. Les packs premium sont créés dans Strapi, liés à un produit Stripe, et achetés via redirect Stripe Checkout.

---

## Flow d'achat

```
Admin:
  1. Crée pack dans Strapi (published: false)
  2. Importe les questions (endpoint import)
  3. Crée produit + prix dans Stripe dashboard
  4. Dans Strapi: isFree: false, stripePriceId: price_xxx, price: 2.99
  5. published: true → visible côté client

Utilisateur:
  1. Voit le pack avec 🔒 + "2,99€" dans la grille
  2. Clique → client POST /api/checkout { packSlug }
  3. Backend vérifie (pack existe, pas gratuit, pas déjà acheté)
  4. Backend crée Stripe Checkout session avec stripePriceId
  5. Client redirige vers URL Stripe
  6. Utilisateur paie
  7. Stripe redirige vers /play/solo?success=true
  8. Webhook Stripe → backend crée Purchase (status: completed)
  9. Refresh → pack déverrouillé (badge "Possédé ✓")
```

---

## Backend Strapi

### Content-type Purchase

```
Purchase
├── player: relation (many-to-one → Player, required)
├── pack: relation (many-to-one → QuestionPack, required)
├── stripeSessionId: string (required)
├── stripePaymentIntentId: string
├── amount: integer (centimes)
├── status: enumeration ["pending", "completed", "refunded"]
└── createdAt (auto)
```

### Champ ajouté à QuestionPack

`price: decimal` (nullable) — le prix en euros affiché côté client. Null pour les packs gratuits.

### Endpoints

**`POST /api/checkout`**
- Auth : Clerk JWT requis (ctx.state.player)
- Body : `{ packSlug: string }`
- Logique :
  1. Trouver le pack par slug, vérifier `isFree === false` et `stripePriceId` existe
  2. Vérifier qu'un Purchase (completed) n'existe pas déjà pour ce player + pack
  3. Créer une session Stripe Checkout :
     ```ts
     const session = await stripe.checkout.sessions.create({
       mode: "payment",
       line_items: [{ price: pack.stripePriceId, quantity: 1 }],
       success_url: `${frontendUrl}/play/solo?success=true`,
       cancel_url: `${frontendUrl}/play/solo?canceled=true`,
       metadata: { playerDocumentId: player.documentId, packSlug: pack.slug },
     });
     ```
  4. Retourner `{ url: session.url }`
- Réponse : `{ url: "https://checkout.stripe.com/..." }`

**`POST /api/webhooks/stripe`**
- Auth : Aucune (Stripe n'envoie pas de JWT). Route exclue du middleware Clerk.
- Signature : Vérifiée via `stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)`
- Événement `checkout.session.completed` :
  1. Extraire `metadata.playerDocumentId` et `metadata.packSlug`
  2. Vérifier idempotence : un Purchase avec ce `stripeSessionId` existe déjà ?
  3. Si non → créer Purchase (status: completed, amount, stripeSessionId, stripePaymentIntentId)
- Réponse : 200 OK immédiat

**`GET /api/purchases/me`**
- Auth : Clerk JWT requis
- Retourne : liste des Purchase du joueur connecté avec le slug du pack
- Réponse : `{ data: [{ packSlug: "geographie", status: "completed" }] }`

### Policy : accès questions pack payant

Policy `check-pack-access` appliquée sur la route `find` de Question :
- Extraire le `filters[pack][slug][$eq]` de la query
- Si le pack est `isFree: true` → laisser passer
- Si `isFree: false` → vérifier qu'un Purchase (completed) existe pour `ctx.state.player` + ce pack
- Sinon → 403

---

## Sécurité

- **Données carte** : jamais sur notre serveur. Stripe Checkout héberge le formulaire. Compliance PCI SAQ A.
- **Webhook signature** : `stripe.webhooks.constructEvent()` avec `STRIPE_WEBHOOK_SECRET`
- **Idempotence** : vérifier `stripeSessionId` unique avant de créer un Purchase
- **Réponse rapide** : webhook handler retourne 200 en moins de 5s
- **Clés en env vars** :
  - `STRIPE_SECRET_KEY` → backend `.env`
  - `STRIPE_WEBHOOK_SECRET` → backend `.env`
  - `PUBLIC_STRIPE_PUBLISHABLE_KEY` → client `.env` (safe, publique)
- **Route webhook exclue de Clerk auth** : Stripe n'envoie pas de JWT

---

## Frontend

### Grille de packs (HomeScreen)

Chaque pack card affiche un état basé sur `isFree` + `purchases` :

| État | Visuel | Clic |
|------|--------|------|
| Gratuit | Normal (comme aujourd'hui) | Sélectionne le pack |
| Premium non acheté | 🔒 + badge "2,99€" | Redirect Stripe Checkout |
| Premium acheté | Badge "Possédé ✓" (vert) | Sélectionne le pack |

### Hook `usePurchases()`

```ts
// src/hooks/usePurchases.ts
export function usePurchases() {
  return useQuery({
    queryKey: ["purchases", "me"],
    queryFn: () => api.get("purchases/me").json(),
    enabled: !!isSignedIn,
  });
}
```

Retourne la liste des slugs de packs achetés. Le HomeScreen combine `usePacks()` + `usePurchases()` pour déterminer l'état de chaque pack.

### Flow checkout côté client

Quand l'utilisateur clique sur un pack premium non acheté :
1. Appel `api.post("checkout", { json: { packSlug } }).json()`
2. Récupère `{ url }` de la réponse
3. `window.location.href = url` → redirect vers Stripe

---

## Fichiers

### Nouveaux (backend)

| Fichier | Rôle |
|---------|------|
| `src/api/purchase/content-types/purchase/schema.json` | Schema Purchase |
| `src/api/purchase/routes/purchase.ts` | Routes factory |
| `src/api/purchase/routes/custom.ts` | Routes custom (checkout, webhook, me) |
| `src/api/purchase/controllers/purchase.ts` | Checkout + webhook + me |
| `src/api/purchase/services/purchase.ts` | Service factory |
| `src/api/question/policies/check-pack-access.ts` | Policy accès pack payant |
| `src/api/question/routes/question.ts` | Mise à jour pour appliquer la policy |

### Modifiés (backend)

| Fichier | Changement |
|---------|------------|
| `src/api/question-pack/content-types/question-pack/schema.json` | Ajouter champ `price` |
| `config/middlewares.ts` | Exclure `/api/webhooks/stripe` du middleware Clerk |

### Nouveaux (client)

| Fichier | Rôle |
|---------|------|
| `src/hooks/usePurchases.ts` | TanStack Query hook |
| `src/lib/queries/purchases.ts` | Fetch purchases/me |

### Modifiés (client)

| Fichier | Changement |
|---------|------------|
| `src/components/HomeScreen.tsx` | Cadenas, badge prix, clic → checkout |
| `src/components/LandingPage.tsx` | Badge prix sur packs preview |

### Dépendances

| Package | Où | Usage |
|---------|-----|-------|
| `stripe` | backend | API Stripe (Checkout sessions, webhooks) |

---

## Hors scope

- Stripe Elements (formulaire inline) — on utilise Checkout redirect
- Remboursements — admin Stripe dashboard, pas dans l'app
- Abonnements — paiement unique seulement
- Bundles de packs — à l'unité uniquement
