# Strapi v5 REST API Reference

## Endpoints

### Collection Types

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/:pluralApiId` | List documents |
| POST | `/api/:pluralApiId` | Create document |
| GET | `/api/:pluralApiId/:documentId` | Get one document |
| PUT | `/api/:pluralApiId/:documentId` | Update document |
| DELETE | `/api/:pluralApiId/:documentId` | Delete document |

### Single Types

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/:singularApiId` | Get document |
| PUT | `/api/:singularApiId` | Update/Create |
| DELETE | `/api/:singularApiId` | Delete |

`:singularApiId`/`:pluralApiId` from content-type `info.singularName`/`info.pluralName`. Components have no endpoints. Upload API at `/api/upload`.

## Response Format (v5 — Flattened)

```json
// Single
{ "data": { "id": 1, "documentId": "abc123...", "title": "My Article", "createdAt": "...", "updatedAt": "...", "publishedAt": "..." }, "meta": {} }

// List
{ "data": [{ "id": 1, "documentId": "abc123...", "title": "Article 1" }], "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 4, "total": 100 } } }

// Error
{ "data": null, "error": { "status": 400, "name": "ValidationError", "message": "...", "details": {} } }
```

**v5 breaking**: No more `data.attributes` nesting. Access `data.title` directly. Use `documentId` (24-char string) not `id`.

## Authentication

```
Authorization: Bearer <api-token-or-jwt>
```

All content-types private by default. Permissions via admin: Settings > Users & Permissions > Roles. API tokens: Settings > API Tokens.

## Filters — `?filters[field][operator]=value`

| Operator | Description |
|----------|-------------|
| `$eq` / `$eqi` | Equal / case-insensitive |
| `$ne` / `$nei` | Not equal / case-insensitive |
| `$lt` / `$lte` | Less than / ≤ |
| `$gt` / `$gte` | Greater than / ≥ |
| `$in` / `$notIn` | In array / not in array |
| `$contains` / `$notContains` | Contains / not (case-sensitive) |
| `$containsi` / `$notContainsi` | Contains / not (case-insensitive) |
| `$startsWith` / `$startsWithi` | Starts with / case-insensitive |
| `$endsWith` / `$endsWithi` | Ends with / case-insensitive |
| `$null` / `$notNull` | Is / not null |
| `$between` | Between two values |
| `$or` / `$and` / `$not` | Logical operators (nestable) |

Multiple filters implicitly combined with `$and`.

### Using `qs` Library (Recommended)

```js
const qs = require('qs');

// Simple
qs.stringify({ filters: { username: { $eq: 'John' } } }, { encodeValuesOnly: true });
// → filters[username][$eq]=John

// IN
qs.stringify({ filters: { id: { $in: [3, 6, 8] } } }, { encodeValuesOnly: true });

// OR
qs.stringify({ filters: { $or: [{ title: { $contains: 'hello' } }, { rating: { $gte: 4 } }] } }, { encodeValuesOnly: true });

// Nested AND + OR + NOT
qs.stringify({
  filters: {
    $and: [
      { $not: { averagePrice: { $gte: 20 } } },
      { $or: [{ name: { $eq: 'Pizzeria' } }, { name: { $startsWith: 'Pizza' } }] },
    ],
  },
}, { encodeValuesOnly: true });

// Deep filtering on relation
qs.stringify({ filters: { category: { name: { $eq: 'Italian' } } } }, { encodeValuesOnly: true });
```

## Populate

**Default**: NOTHING populated. Must explicitly populate relations, media, components, dynamic zones.

| Use Case | Syntax |
|----------|--------|
| All 1 level | `populate=*` |
| Specific | `populate[0]=author` |
| Multiple | `populate[0]=author&populate[1]=categories` |
| Nested | `populate[author][populate][0]=avatar` |
| With fields | `populate[author][fields][0]=name` |
| With filters | `populate[categories][filters][active][$eq]=true` |
| With sort | `populate[categories][sort][0]=name:asc` |
| Dynamic zones | `populate[blocks][on][shared.hero][populate]=*` |

```js
// Nested populate with field selection
qs.stringify({
  populate: {
    author: { fields: ['name', 'email'], populate: { avatar: { fields: ['url'] } } },
    categories: { filters: { active: true }, sort: ['name:asc'] },
  },
});

// Dynamic zone
qs.stringify({
  populate: {
    blocks: {
      on: {
        'shared.hero': { populate: '*' },
        'shared.cta': { fields: ['title', 'url'] },
      },
    },
  },
});
```

`find` permission required on populated content-types. `populate=deep` plugins NOT recommended. Large populate lists bounded by `arrayLimit` (default 100, configurable on `strapi::query` middleware).

## Field Selection — `?fields[0]=name&fields[1]=title`

Returns only specified scalar fields. Cannot select relation/media/component fields (use populate).

Default returned: string, text, richtext, enumeration, email, password, uid, dates, numbers, boolean, array, JSON.

## Sort — `?sort[0]=title:asc&sort[1]=rating:desc`

Default: `:asc`. Multiple fields in array. Descending: `:desc`.

## Pagination

**By page:**

| Param | Default |
|-------|---------|
| `pagination[page]` | 1 |
| `pagination[pageSize]` | 25 |

**By offset:**

| Param | Default |
|-------|---------|
| `pagination[start]` | 0 |
| `pagination[limit]` | 25 |

Cannot mix methods. Configurable: `config/api.ts` → `rest.defaultLimit`, `rest.maxLimit` (default 100).

Response meta: `{ pagination: { page, pageSize, pageCount, total } }`.

## Locale — `?locale=fr`

Requires i18n on content-type. Returns entries for specified locale.

## Status — `?status=draft` or `?status=published`

Requires Draft & Publish. REST **default returns published**.

## Create / Update

### Create

```bash
POST /api/restaurants
Content-Type: application/json
{ "data": { "name": "New Restaurant", "description": "Great place", "rating": 5 } }
```

### Update

```bash
PUT /api/restaurants/:documentId
Content-Type: application/json
{ "data": { "name": "Updated Name" } }
```

### Relations — Connect / Disconnect / Set

```json
// Connect (add)
{ "data": { "categories": { "connect": [{ "documentId": "abc" }, { "documentId": "def" }] } } }

// Disconnect (remove)
{ "data": { "categories": { "disconnect": [{ "documentId": "abc" }] } } }

// Set (replace all)
{ "data": { "categories": { "set": [{ "documentId": "abc" }] } } }

// Combined
{ "data": { "categories": { "connect": [{ "documentId": "new1" }], "disconnect": [{ "documentId": "old1" }] } } }

// Positional ordering
{ "data": { "categories": { "connect": [
  { "documentId": "abc", "position": { "before": "def" } },
  { "documentId": "ghi", "position": { "after": "abc" } },
  { "documentId": "jkl", "position": { "start": true } },
  { "documentId": "mno", "position": { "end": true } }
] } } }
```

Behavior: `connect` adds (many-to-many) or replaces (one-to-one, many-to-one). `set` replaces all.

## Upload API

```bash
# Upload file(s)
POST /api/upload
Content-Type: multipart/form-data
files: <file>

# With metadata
POST /api/upload
files: <file>
fileInfo: {"name":"photo","alternativeText":"Alt text","caption":"Caption"}

# Upload and link to entry field
POST /api/upload
files: <file>
ref: "api::restaurant.restaurant"
refId: "<documentId>"
field: "cover"
```

## Strapi Client Library

Official JS client for simplified REST interactions:

```js
import { strapiClient } from '@strapi/client';
const client = strapiClient({ baseURL: 'http://localhost:1337/api', auth: { token: 'your-token' } });
const restaurants = await client.collection('restaurants').find({ filters: { rating: { $gte: 4 } } });
```
