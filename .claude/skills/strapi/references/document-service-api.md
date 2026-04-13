# Strapi v5 Document Service API

Replaces Entity Service API from v4. Server-side API for CRUD on documents.

Documents identified by `documentId` (24-char alphanumeric string), not `id`.

## Access

```ts
strapi.documents('api::restaurant.restaurant')
```

## Methods

### findOne

```ts
const doc = await strapi.documents('api::restaurant.restaurant').findOne({
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm',
  fields: ['name', 'description'],
  populate: ['category'],
  locale: 'en',        // optional, default locale if omitted
  status: 'published',  // optional, draft by default
});
// Returns: document object or null
```

### findFirst

```ts
const doc = await strapi.documents('api::restaurant.restaurant').findFirst({
  filters: { name: { $contains: 'pizza' } },
  populate: '*',
  locale: 'fr',
  status: 'published',
});
// Returns: first matching document or null
```

### findMany

```ts
const docs = await strapi.documents('api::restaurant.restaurant').findMany({
  filters: { rating: { $gte: 4 } },
  sort: [{ name: 'asc' }],       // or 'name:asc'
  populate: ['category'],
  fields: ['name', 'rating'],
  limit: 10,
  start: 0,
  locale: 'en',
  status: 'published',
});
// Returns: array of documents
```

### create

```ts
const doc = await strapi.documents('api::restaurant.restaurant').create({
  data: {
    name: 'New Restaurant',
    rating: 5,
    category: { connect: [{ documentId: 'catId' }] },
  },
  locale: 'en',
  status: 'published',  // creates AND publishes in one step
  populate: ['category'],
});
```

### update

```ts
const doc = await strapi.documents('api::restaurant.restaurant').update({
  documentId: 'abc123',
  data: {
    name: 'Updated Name',
    categories: { connect: [{ documentId: 'new1' }], disconnect: [{ documentId: 'old1' }] },
  },
  locale: 'en',
  status: 'published',
  populate: '*',
});
```

### delete

```ts
// Delete all locales
await strapi.documents('api::restaurant.restaurant').delete({ documentId: 'abc123' });

// Delete specific locale only
await strapi.documents('api::restaurant.restaurant').delete({ documentId: 'abc123', locale: 'fr' });
```

### publish / unpublish / discardDraft

```ts
await strapi.documents('api::restaurant.restaurant').publish({ documentId: 'abc123', locale: 'en' });
await strapi.documents('api::restaurant.restaurant').unpublish({ documentId: 'abc123', locale: 'en' });
await strapi.documents('api::restaurant.restaurant').discardDraft({ documentId: 'abc123', locale: 'en' });
```

`discardDraft`: reverts draft to match the currently published version.

### count

```ts
const total = await strapi.documents('api::restaurant.restaurant').count({
  filters: { rating: { $gte: 3 } },
  locale: 'en',
  status: 'published',
});
```

**Note**: `status: 'draft'` counts all docs (published always have draft counterpart).

## Parameters Reference

| Param | Type | Description | Methods |
|-------|------|-------------|---------|
| `documentId` | string | 24-char unique ID | findOne, update, delete, publish, unpublish, discardDraft |
| `data` | object | Fields to create/update (+ relation connect/disconnect/set) | create, update |
| `filters` | object | Filter operators | findFirst, findMany, count |
| `fields` | string[] | Select specific scalar fields | findOne, findFirst, findMany |
| `populate` | string[] \| object \| '*' | Populate relations/components | all |
| `sort` | string \| object[] | e.g. `'name:asc'` or `[{ name: 'asc' }]` | findMany |
| `limit` | number | Max results | findMany |
| `start` | number | Offset | findMany |
| `locale` | string | Locale code (requires i18n enabled) | all |
| `status` | 'draft' \| 'published' | **Draft by default** | all read + create/update |

## Populate Syntax

```ts
populate: '*'                                    // all 1 level
populate: ['author', 'categories']              // specific
populate: {                                      // nested with options
  author: { fields: ['name', 'email'], populate: ['avatar'] },
  categories: { filters: { active: true }, sort: ['name:asc'], populate: { articles: { fields: ['title'] } } },
}
```

`find` permission required on populated content-types.

## Filter Operators

Same as REST: `$eq`, `$eqi`, `$ne`, `$nei`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$notIn`, `$contains`, `$notContains`, `$containsi`, `$notContainsi`, `$startsWith`, `$startsWithi`, `$endsWith`, `$endsWithi`, `$null`, `$notNull`, `$between`, `$or`, `$and`, `$not`.

```ts
// Shorthand: equality
filters: { title: 'Hello World' }
// Shorthand: IN
filters: { title: ['Hello', 'Hola'] }
// Logical
filters: { $or: [{ title: { $contains: 'hello' } }, { rating: { $gte: 4 } }] }
// Nested NOT
filters: { title: { $not: { $contains: 'draft' } } }
// Deep filter on relation
filters: { category: { name: { $eq: 'Italian' } } }
```

## Sort

```ts
sort: 'title:asc'                      // single, asc default
sort: 'title:desc'                     // descending
sort: [{ title: 'asc' }, { rating: 'desc' }]  // multiple
sort: ['title:asc', 'rating:desc']     // string array form
```

## Locale

```ts
// Create for locale
await strapi.documents('api::x.x').create({ data: { name: 'Nom' }, locale: 'fr' });

// Find all in locale
await strapi.documents('api::x.x').findMany({ locale: 'fr' });

// Update locale version
await strapi.documents('api::x.x').update({ documentId: 'abc', data: { name: 'Nouveau' }, locale: 'fr' });

// Delete specific locale (keep others)
await strapi.documents('api::x.x').delete({ documentId: 'abc', locale: 'fr' });

// Publish locale
await strapi.documents('api::x.x').publish({ documentId: 'abc', locale: 'fr' });
```

Default locale: `en` unless changed. No locale param = default locale.

## Document Service Middlewares

Extend behavior before/after any method:

```ts
// In src/index.ts register() or bootstrap()
strapi.documents.use(async (context, next) => {
  console.log(`${context.action} on ${context.uid}`, context.params);
  const result = await next();
  return result;
});
```

### Context

| Property | Type | Description |
|----------|------|-------------|
| `action` | string | `findOne`, `findMany`, `create`, `update`, `delete`, `publish`, `unpublish`, `discardDraft`, `count` |
| `uid` | string | Content-type UID |
| `contentType` | object | Full content-type schema |
| `params` | object | Method parameters |

### Examples

```ts
// Auto-set author
strapi.documents.use(async (ctx, next) => {
  if (ctx.action === 'create' && ctx.uid === 'api::article.article') {
    ctx.params.data.author = getCurrentUserId();
  }
  return next();
});

// Performance logging
strapi.documents.use(async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  strapi.log.debug(`[DocService] ${ctx.action} ${ctx.uid} ${Date.now() - start}ms`);
  return result;
});

// Filter results
strapi.documents.use(async (ctx, next) => {
  const result = await next();
  if (ctx.action === 'findMany' && ctx.uid === 'api::restaurant.restaurant') {
    return result.filter(r => r.approved);
  }
  return result;
});
```

## Query Engine API (Low-Level)

Direct DB access. Bypasses Document Service (no drafts, no locale handling, no middlewares):

```ts
// CRUD
await strapi.db.query('api::article.article').findMany({ where: { title: { $contains: 'hello' } }, orderBy: { title: 'asc' }, limit: 10, offset: 0, select: ['id', 'title'], populate: { category: true } });
await strapi.db.query('api::article.article').findOne({ where: { id: 1 } });
await strapi.db.query('api::article.article').create({ data: { title: 'New' } });
await strapi.db.query('api::article.article').update({ where: { id: 1 }, data: { title: 'Updated' } });
await strapi.db.query('api::article.article').delete({ where: { id: 1 } });
await strapi.db.query('api::article.article').count({ where: { published: true } });

// Bulk (ONLY at Query Engine level, not Document Service)
await strapi.db.query('api::article.article').createMany({ data: [...] });
await strapi.db.query('api::article.article').updateMany({ where: {}, data: {} });
await strapi.db.query('api::article.article').deleteMany({ where: {} });
```

**Use Document Service for normal operations.** Query Engine for bulk/performance-critical or direct DB access.
