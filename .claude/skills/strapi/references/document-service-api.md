# Strapi v5 Document Service API

Replaces Entity Service API from v4. Server-side API for CRUD on documents.

## Access

```ts
strapi.documents('api::restaurant.restaurant')
```

## Methods

### findOne

```ts
const doc = await strapi.documents('api::restaurant.restaurant').findOne({
  documentId: 'abc123',
  fields: ['name', 'description'],
  populate: ['category'],
  locale: 'en',       // optional, default locale if omitted
  status: 'published', // optional, draft by default
});
```

### findFirst

```ts
const doc = await strapi.documents('api::restaurant.restaurant').findFirst({
  filters: { name: { $contains: 'pizza' } },
  populate: '*',
});
```

### findMany

```ts
const docs = await strapi.documents('api::restaurant.restaurant').findMany({
  filters: { rating: { $gte: 4 } },
  sort: [{ name: 'asc' }],
  populate: ['category'],
  fields: ['name', 'rating'],
  limit: 10,
  start: 0,
  locale: 'en',
  status: 'published',
});
```

### create

```ts
const doc = await strapi.documents('api::restaurant.restaurant').create({
  data: { name: 'New Restaurant', rating: 5 },
  locale: 'en',       // optional
  status: 'published', // creates and publishes in one step
  populate: ['category'],
});
```

### update

```ts
const doc = await strapi.documents('api::restaurant.restaurant').update({
  documentId: 'abc123',
  data: { name: 'Updated Name' },
  locale: 'en',
  status: 'published', // updates and publishes
  populate: '*',
});
```

### delete

```ts
const result = await strapi.documents('api::restaurant.restaurant').delete({
  documentId: 'abc123',
  locale: 'en', // deletes specific locale, omit to delete all locales
});
```

### publish

```ts
await strapi.documents('api::restaurant.restaurant').publish({
  documentId: 'abc123',
  locale: 'en', // optional
});
```

### unpublish

```ts
await strapi.documents('api::restaurant.restaurant').unpublish({
  documentId: 'abc123',
  locale: 'en',
});
```

### discardDraft

```ts
await strapi.documents('api::restaurant.restaurant').discardDraft({
  documentId: 'abc123',
  locale: 'en',
});
```

### count

```ts
const total = await strapi.documents('api::restaurant.restaurant').count({
  filters: { rating: { $gte: 3 } },
  locale: 'en',
  status: 'published',
});
```

## Common Parameters

| Param | Type | Description |
|-------|------|-------------|
| `documentId` | string | 24-char unique identifier |
| `filters` | object | Same operators as REST API ($eq, $in, $contains, etc.) |
| `fields` | string[] | Select specific fields |
| `populate` | string[] \| object \| '*' | Populate relations/components |
| `sort` | string \| object[] | e.g. `'name:asc'` or `[{ name: 'asc' }]` |
| `limit` | number | Max results |
| `start` | number | Offset |
| `locale` | string | Locale code (requires i18n) |
| `status` | 'draft' \| 'published' | Draft by default in Document Service |
| `data` | object | Fields to create/update |

## Populate Syntax

```ts
// All 1 level
populate: '*'

// Specific fields
populate: ['author', 'categories']

// Nested with options
populate: {
  author: { fields: ['name'], populate: ['avatar'] },
  categories: { filters: { active: true } },
}
```

## Filter Operators

Same as REST: `$eq`, `$eqi`, `$ne`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$notIn`, `$contains`, `$notContains`, `$startsWith`, `$endsWith`, `$null`, `$notNull`, `$between`, `$or`, `$and`, `$not` (+ case-insensitive `i` variants).

```ts
// Logical operators
filters: { $or: [{ title: 'A' }, { title: 'B' }] }
filters: { title: { $not: { $contains: 'draft' } } }
```

## Document Service Middlewares

Extend behavior before/after any method:

```ts
// In src/index.ts register()
strapi.documents.use((context, next) => {
  // context.action: 'findOne' | 'findMany' | 'create' | 'update' | 'delete' | ...
  // context.uid: 'api::restaurant.restaurant'
  // context.params: method parameters
  console.log(`${context.action} on ${context.uid}`);
  const result = await next();
  // modify result if needed
  return result;
});
```

Context includes: `action`, `params`, `uid`, `contentType`.
