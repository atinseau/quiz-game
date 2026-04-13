# Strapi v5 REST API Reference

## Endpoints

**Collection types:**

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/:pluralApiId` | List documents |
| POST | `/api/:pluralApiId` | Create document |
| GET | `/api/:pluralApiId/:documentId` | Get one document |
| PUT | `/api/:pluralApiId/:documentId` | Update document |
| DELETE | `/api/:pluralApiId/:documentId` | Delete document |

**Single types:**

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/:singularApiId` | Get document |
| PUT | `/api/:singularApiId` | Update/Create |
| DELETE | `/api/:singularApiId` | Delete |

## Response Format (v5 — flattened)

```json
{
  "data": {
    "id": 1,
    "documentId": "abc123def456...",
    "title": "My Article",
    "createdAt": "...",
    "updatedAt": "...",
    "publishedAt": "..."
  },
  "meta": {}
}
```

List response: `data` is array, `meta.pagination` included.
**v5 breaking change**: attributes no longer nested under `data.attributes`. Access `data.title` directly.
Documents use `documentId` (24-char string), not `id`.

## Authentication

```
Authorization: Bearer <api-token-or-jwt>
```

All content-types private by default. Set permissions in admin or use API tokens.

## Filters — `?filters[field][operator]=value`

| Operator | Description |
|----------|-------------|
| `$eq` / `$eqi` | Equal / case-insensitive |
| `$ne` / `$nei` | Not equal / case-insensitive |
| `$lt` / `$lte` | Less than / ≤ |
| `$gt` / `$gte` | Greater than / ≥ |
| `$in` / `$notIn` | In array / not in array |
| `$contains` / `$notContains` | Contains / not (+ `i` variants) |
| `$startsWith` / `$endsWith` | Starts/ends with (+ `i` variants) |
| `$null` / `$notNull` | Is/not null |
| `$between` | Between two values |
| `$or` / `$and` / `$not` | Logical operators (nestable) |

```js
// Using qs library (recommended)
const query = qs.stringify({
  filters: {
    $or: [
      { title: { $contains: 'hello' } },
      { rating: { $gte: 4 } },
    ],
  },
}, { encodeValuesOnly: true });
// GET /api/articles?${query}
```

Multiple filters implicitly combined with `$and`.

## Populate — `?populate=*` or nested

| Use Case | Syntax |
|----------|--------|
| All relations 1 level | `populate=*` |
| Specific field | `populate[0]=author` |
| Nested | `populate[author][populate][0]=avatar` |
| With field selection | `populate[author][fields][0]=name` |
| With filters | `populate[author][filters][name][$eq]=John` |
| Dynamic zones | `populate[blocks][on][shared.hero][populate]=*` |

**Default**: nothing populated. Must explicitly populate relations, media, components, dynamic zones.
`find` permission required on populated content-types.

## Field Selection — `?fields[0]=name&fields[1]=title`

Only returns specified scalar fields. Cannot select relation/media/component fields (use populate).

## Sort — `?sort[0]=title:asc&sort[1]=rating:desc`

Default order: `:asc` (can omit). Multiple sort fields in array.

## Pagination

**By page (default):**
```
?pagination[page]=1&pagination[pageSize]=25
```

**By offset:**
```
?pagination[start]=0&pagination[limit]=25
```

Response includes:
```json
"meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 4, "total": 100 } }
```

Defaults: `pageSize=25`, `maxLimit=100` (configurable in `config/api.ts`).

## Locale — `?locale=fr`

Requires i18n enabled on content-type. Returns entries for specified locale.

## Status — `?status=draft` or `?status=published`

Requires Draft & Publish enabled. Default: returns published content via REST.

## Relations Management (Create/Update)

**Connect/disconnect/set** in request body:
```json
{
  "data": {
    "categories": {
      "connect": [{ "documentId": "abc123" }],
      "disconnect": [{ "documentId": "def456" }]
    }
  }
}
```

Or set directly:
```json
{ "data": { "categories": { "set": [{ "documentId": "abc123" }] } } }
```

With positional ordering:
```json
{ "connect": [{ "documentId": "abc", "position": { "before": "def" } }] }
```
