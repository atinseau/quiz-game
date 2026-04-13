# Strapi Backend + Clerk Auth — Design Spec

## Goal

Add a Strapi v5 backend to the quiz-app monorepo with Clerk-based authentication for end-users. Users authenticate via Clerk on the React frontend; the backend validates Clerk JWTs and maintains a Player content-type for game data.

## Architecture

```
apps/
├── client/          # React frontend (Bun.serve, port 3000)
│   └── ClerkProvider wraps app, provides sign-in/sign-up UI and JWT
│
└── backend/         # Strapi v5 (port 1337)
    └── Global middleware validates Clerk JWT, syncs Player on-demand
```

### Request Flow

1. User signs in via Clerk UI (React components)
2. Frontend gets JWT: `useAuth().getToken()`
3. Frontend sends `Authorization: Bearer <clerk-jwt>` to Strapi API
4. Strapi middleware decodes JWT via `@clerk/backend` (JWKS verification)
5. Middleware looks up Player by `clerkId` — creates if missing (on-demand sync)
6. Player attached to `ctx.state.player` for downstream controllers
7. Routes without a token pass through (public access)

## Content-Type: Player

| Attribute | Type | Constraints |
|-----------|------|-------------|
| clerkId | string | unique, required |
| email | string | unique, required |
| username | string | required |

- No password, no roles — Clerk handles auth
- Player exists purely to attach game data (scores, packs, XP in future)
- Created automatically on first authenticated API request

## Clerk Middleware (Backend)

Location: `src/middlewares/clerk-auth.ts`

Registered globally in `config/middlewares.ts`.

Behavior:
- Reads `Authorization: Bearer <token>` header
- If no token → pass through (public route)
- Verifies JWT via `@clerk/backend` `verifyToken()` using Clerk JWKS
- Extracts `sub` (clerkId), `email`, `username` from JWT claims
- Queries Player content-type: `findMany({ filters: { clerkId } })`
- If not found → creates Player with clerkId, email, username
- Sets `ctx.state.player` with the Player document
- On verification failure → 401 Unauthorized

## Frontend Changes

- Install `@clerk/clerk-react`
- Wrap app in `<ClerkProvider publishableKey={...}>`
- Add sign-in / sign-up pages or modal (Clerk components)
- Protect routes that need auth with `<SignedIn>` / `<SignedOut>`
- Helper/hook to add Clerk JWT to fetch requests targeting Strapi

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `CLERK_PUBLISHABLE_KEY` | Client (.env) | Clerk frontend SDK |
| `CLERK_SECRET_KEY` | Backend (.env) | Verify Clerk JWTs server-side |

## Strapi Setup

- Create project with `npx create-strapi@latest apps/backend` (TypeScript, SQLite for dev)
- Disable default Users & Permissions auth for API routes — Clerk replaces it
- Admin panel stays default email/password (for content management)
- Player content-type created via schema.json (not Content-type Builder)

## Out of Scope

- Clerk webhooks (not needed with on-demand sync)
- SSO for Strapi admin panel
- XP, levels, scores, packs (future content-types)
- Multiplayer / WebSocket
- Stripe / marketplace
