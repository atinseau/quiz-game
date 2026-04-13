---
name: strapi
description: Use when building, configuring, customizing, or debugging a Strapi v5 CMS project — content-types, REST/GraphQL APIs, Document Service, controllers, services, routes, plugins, deployment, or migration from v4
---

# Strapi v5 CMS

Headless CMS — Node.js, TypeScript, REST + GraphQL APIs, admin panel.

## Quick Reference

| Task | Key Info |
|------|----------|
| Create project | `npx create-strapi@latest my-project` |
| Dev server | `strapi develop` (auto-reload) |
| Prod | `strapi build && NODE_ENV=production strapi start` |
| Generate types | `strapi ts:generate-types` |
| Content-type UID | `api::restaurant.restaurant` |
| Document ID | `documentId` (24-char string, NOT `id`) |
| REST base | `GET/POST/PUT/DELETE /api/:pluralApiId` |
| Default nothing populated | Must use `?populate=*` or specify fields |
| Draft & Publish | Default draft; `?status=published` for REST |
| i18n | `?locale=fr` for REST; `locale: 'fr'` for Doc Service |

## Architecture

```
Request → Global Middlewares → Route → Route Middlewares → Policies → Controller → Service → Document Service → Query Engine → DB
```

- **Controllers**: handle request/response, call services
- **Services**: business logic, call Document Service
- **Document Service API**: CRUD abstraction (replaces v4 Entity Service)
- **Routes**: map URLs to controllers, attach policies/middlewares
- **Policies**: authorize/block before controller
- **Middlewares**: transform request/response at global or route level

## Factory Pattern

All customization uses factory functions:

```ts
import { factories } from '@strapi/strapi';
factories.createCoreController('api::restaurant.restaurant', ({ strapi }) => ({ /* overrides */ }));
factories.createCoreService('api::restaurant.restaurant', ({ strapi }) => ({ /* overrides */ }));
factories.createCoreRouter('api::restaurant.restaurant', { /* config */ });
```

Override methods: replace entirely, or call `super.find(ctx)` to wrap core logic.

**Always sanitize** in controllers: `this.sanitizeQuery(ctx)`, `this.sanitizeOutput(results, ctx)`.

## Document Service (Server-Side CRUD)

```ts
const docs = await strapi.documents('api::restaurant.restaurant').findMany({
  filters: { rating: { $gte: 4 } },
  populate: ['category'],
  sort: [{ name: 'asc' }],
  limit: 10,
  locale: 'en',
  status: 'published',
});
```

Methods: `findOne`, `findFirst`, `findMany`, `create`, `update`, `delete`, `publish`, `unpublish`, `discardDraft`, `count`.

## REST API Essentials

- Filters: `?filters[field][$operator]=value` — operators: $eq, $ne, $lt, $gt, $in, $contains, $or, $and, $not, etc.
- Populate: `?populate=*` (1 level all) or `?populate[author][fields][0]=name`
- Sort: `?sort[0]=title:asc`
- Pagination: `?pagination[page]=1&pagination[pageSize]=25`
- Use `qs` library to build complex queries
- Response: `{ data: {...}, meta: { pagination: {...} } }` — flat (no `.attributes`)

## Content-Type Schema

```json
{
  "kind": "collectionType",
  "info": { "singularName": "restaurant", "pluralName": "restaurants", "displayName": "Restaurant" },
  "options": { "draftAndPublish": true },
  "pluginOptions": { "i18n": { "localized": true } },
  "attributes": {
    "name": { "type": "string", "required": true },
    "category": { "type": "relation", "relation": "manyToOne", "target": "api::category.category" },
    "blocks": { "type": "dynamiczone", "components": ["shared.hero"] }
  }
}
```

Attribute types: string, text, richtext, blocks, integer, float, decimal, boolean, date, datetime, email, enumeration, json, uid, media, relation, component, dynamiczone.

Relations: oneToOne, oneToMany, manyToOne, manyToMany (+ morphTo variants). Use `inversedBy`/`mappedBy`.

## Config Files Summary

| File | Purpose |
|------|---------|
| `config/database.ts` | DB connection (client, host, port, credentials, pool) |
| `config/server.ts` | Host, port, URL, proxy, cron, webhooks |
| `config/admin.ts` | Admin URL/port, JWT secret, API token salt |
| `config/api.ts` | REST prefix, pagination defaults, strictParams |
| `config/middlewares.ts` | Ordered middleware stack |
| `config/plugins.ts` | Enable/disable/configure plugins |
| `config/cron-tasks.ts` | Scheduled tasks (node-schedule) |
| `config/features.ts` | Future/experimental flags |

All export `({ env }) => ({})`. Per-environment: `config/env/{environment}/`.

## Common Patterns

**Custom endpoint:**
```ts
// routes: { method: 'GET', path: '/custom', handler: 'myController.custom' }
// controller: async custom(ctx) { ctx.body = await strapi.service('api::x.x').find(); }
```

**Lifecycle hook:**
```ts
// src/api/article/content-types/article/lifecycles.ts
export default { beforeCreate(event) { event.params.data.slug = slugify(event.params.data.title); } };
```

**Policy:**
```ts
export default (ctx, config, { strapi }) => { return !!ctx.state.user; };
```

**Document Service middleware:**
```ts
strapi.documents.use(async (ctx, next) => { console.log(ctx.action, ctx.uid); return next(); });
```

## References

Detailed docs in `references/` folder:

| File | Content |
|------|---------|
| project-structure.md | Directory tree, env vars, TS config |
| configuration.md | All config files with code examples |
| content-types.md | Schema format, attributes, relations, lifecycles, i18n, draft/publish |
| rest-api.md | Endpoints, filters, populate, sort, pagination, auth |
| document-service-api.md | All methods, params, middlewares |
| customization.md | Controllers, services, routes, policies, middlewares, webhooks, admin |
| graphql-api.md | Full GraphQL reference: queries, mutations, filters, aggregations, i18n, custom resolvers |
| plugins.md | Plugin structure, server/admin APIs, custom fields, Users & Permissions |
| deployment-cli.md | All CLI commands with flags, export/import/transfer, deployment checklist, v4→v5 migration |
