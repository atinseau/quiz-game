# Strapi v5 GraphQL API

## Setup

```bash
yarn add @strapi/plugin-graphql
```

Config in `config/plugins.ts`:
```ts
export default {
  graphql: {
    config: {
      endpoint: '/graphql',
      playgroundAlways: false,
      shadowCRUD: true,         // auto-generate queries/mutations per content-type
      subscriptions: false,
      maxLimit: -1,             // -1 = unlimited
      defaultLimit: 25,
      apolloServer: {},         // Apollo Server options
      v4CompatibilityMode: false,
    },
  },
};
```

Playground accessible at `/graphql` in development.

**Limitations**:
- No media upload via GraphQL — use REST `POST /upload` then link via mutation
- `documentId` only (no numeric `id` in GraphQL)
- `pageInfo` only works at top-level, not on nested relations

## Auto-Generated Queries (Shadow CRUD)

For a "Restaurant" content-type (`singularApiId: restaurant`, `pluralApiId: restaurants`):

### Fetch Single Document

```graphql
{
  restaurant(documentId: "a1b2c3d4e5d6f7g8h9i0jkl") {
    documentId
    name
    description
  }
}
```

### Fetch Multiple Documents (Flat)

```graphql
{
  restaurants {
    documentId
    name
    description
  }
}
```

### Fetch Multiple Documents (Relay-style with pagination)

```graphql
{
  restaurants_connection {
    nodes {
      documentId
      name
    }
    pageInfo {
      page
      pageSize
      pageCount
      total
    }
  }
}
```

### Fetch Relations

```graphql
{
  restaurants {
    documentId
    name
    categories {      # many-to-many
      documentId
      name
    }
  }
}

# Relay-style for relations
{
  restaurants_connection {
    nodes {
      documentId
      name
      categories_connection {
        nodes {
          documentId
          name
        }
      }
    }
    pageInfo { page pageSize pageCount total }
  }
}
```

### Fetch Media Fields

```graphql
{
  restaurants {
    cover { url alternativeText }
    images_connection {  # multiple media
      nodes { documentId url }
    }
  }
}
```

### Fetch Components

```graphql
{
  restaurants {
    closingPeriod {     # component
      label
      start_date
      end_date
    }
  }
}
```

### Fetch Dynamic Zones (fragments required)

```graphql
{
  restaurants {
    dz {
      __typename
      ... on ComponentDefaultClosingperiod {
        label
      }
      ... on ComponentDefaultHero {
        title
        image { url }
      }
    }
  }
}
```

### Fetch Draft / Published

```graphql
query {
  restaurants(status: DRAFT) {
    documentId
    name
    publishedAt  # null for drafts
  }
}

query {
  restaurants(status: PUBLISHED) {
    documentId
    name
    publishedAt
  }
}
```

## Mutations

### Create

```graphql
mutation {
  createRestaurant(data: {
    name: "Pizzeria"
    description: "Best pizza"
  }) {
    documentId
    name
  }
}

# With relations (pass documentIds)
mutation {
  createCategory(data: {
    Name: "Italian"
    restaurants: ["docId1", "docId2"]
  }) {
    documentId
    Name
    restaurants { documentId name }
  }
}
```

### Update

```graphql
mutation {
  updateRestaurant(
    documentId: "abc123"
    data: { name: "New Name" }
  ) {
    documentId
    name
  }
}

# Update relations
mutation {
  updateRestaurant(
    documentId: "abc123"
    data: { categories: ["catDocId1"] }
  ) {
    documentId
    categories { documentId Name }
  }
}
```

### Delete

```graphql
mutation {
  deleteRestaurant(documentId: "abc123") {
    documentId
  }
}
```

### Media File Mutations (use numeric `id`, NOT `documentId`)

```graphql
# Update media metadata
mutation {
  updateUploadFile(id: 3, info: { alternativeText: "New alt" }) {
    documentId url alternativeText
  }
}

# Delete media
mutation {
  deleteUploadFile(id: 4) { documentId }
}
```

Get media `id` from REST API (populates return both `id` and `documentId`) or from admin Media Library.

## Filters

Syntax: `filters: { field: { operator: value } }`

### All Operators

| Operator | Description |
|----------|-------------|
| `eq` / `eqi` | Equal / case-insensitive |
| `ne` / `nei` | Not equal / case-insensitive |
| `lt` / `lte` | Less than / ≤ |
| `gt` / `gte` | Greater than / ≥ |
| `in` / `notIn` | In array / not in array |
| `contains` / `notContains` | Contains / not (case sensitive) |
| `containsi` / `notContainsi` | Contains / not (case insensitive) |
| `startsWith` / `endsWith` | Starts/ends with |
| `null` / `notNull` | Is/not null |
| `between` | Between two values |
| `and` / `or` / `not` | Logical operators (nestable) |

### Filter Examples

```graphql
# Simple filter
{ restaurants(filters: { name: { eq: "Biscotte" } }) { name } }

# Multiple conditions (implicit AND)
{ restaurants(filters: { category: { eq: "pizza" }, averagePrice: { lt: 20 } }) { name } }

# OR
{ restaurants(filters: { or: [
  { category: { eq: "pizza" } }
  { category: { eq: "burger" } }
] }) { name } }

# Nested AND + OR + NOT
{ restaurants(filters: {
  and: [
    { not: { averagePrice: { gte: 20 } } }
    { or: [
      { name: { startsWith: "Pizza" } }
      { name: { containsi: "italian" } }
    ] }
  ]
}) { name averagePrice } }

# Between
{ restaurants(filters: { averagePrice: { between: [10, 30] } }) { name } }

# Null check
{ restaurants(filters: { description: { null: true } }) { name } }
```

## Sorting

```graphql
# Single field
{ restaurants(sort: "name") { name } }

# Descending
{ restaurants(sort: "averagePrice:desc") { name averagePrice } }

# Multiple fields
{ restaurants(sort: ["name:asc", "averagePrice:desc"]) { name averagePrice } }
```

## Pagination

### By Page

```graphql
{
  restaurants_connection(pagination: { page: 1, pageSize: 10 }) {
    nodes { documentId name }
    pageInfo { page pageSize pageCount total }
  }
}
```

### By Offset

```graphql
{
  restaurants_connection(pagination: { start: 10, limit: 19 }) {
    nodes { documentId name }
    pageInfo { page pageSize pageCount total }
  }
}
```

Defaults: `pageSize=10`. Configurable via `graphql.config.defaultLimit` and `graphql.config.maxLimit`.

## Aggregations (Relay-style only)

```graphql
# Count
{ restaurants_connection(filters: { takeAway: { eq: true } }) {
  aggregate { count }
} }

# Multiple metrics
{ restaurants_connection {
  aggregate {
    count
    avg { delivery_time }
    sum { revenue }
    min { price_range }
    max { price_range }
  }
} }

# Group by
{ restaurants_connection {
  aggregate {
    groupBy {
      categories {
        key
        connection { aggregate { count } }
      }
    }
  }
} }

# With pagination (aggregate covers full dataset, nodes follow pagination)
{ restaurants_connection(
  pagination: { page: 2, pageSize: 5 }
  sort: "name:asc"
) {
  nodes { documentId name rating }
  pageInfo { page pageSize total }
  aggregate { count avg { rating } }
} }
```

Supported operators: `count` (all types), `avg`/`sum` (numbers), `min`/`max` (numbers + dates), `groupBy` (scalars + relations).

## Internationalization (i18n)

```graphql
# Fetch all in French
{ restaurants(locale: "fr") { documentId name locale } }

# Fetch one in French
{ restaurant(documentId: "abc", locale: "fr") { name locale } }

# Create for locale
mutation {
  createRestaurant(data: { name: "Brasserie" }, locale: "fr") {
    documentId name locale
  }
}

# Update locale
mutation {
  updateRestaurant(documentId: "abc", data: { description: "Nouveau" }, locale: "fr") {
    documentId locale
  }
}

# Delete locale version
mutation {
  deleteRestaurant(documentId: "abc", locale: "fr") { documentId }
}
```

## Custom Resolvers

```ts
// src/index.ts
export default {
  register({ strapi }) {
    const extensionService = strapi.plugin('graphql').service('extension');

    extensionService.use(({ nexus }) => ({
      types: [
        nexus.extendType({
          type: 'Query',
          definition(t) {
            t.field('restaurantsByChef', {
              type: 'RestaurantEntityResponseCollection',
              args: { chefId: nexus.nonNull('ID') },
              resolve: async (parent, args) => {
                return strapi.documents('api::restaurant.restaurant').findMany({
                  filters: { chef: { id: args.chefId } },
                });
              },
            });
          },
        }),
      ],
    }));
  },
};
```

### Disable Shadow CRUD

```ts
extensionService.shadowCRUD('api::restaurant.restaurant').disable();
extensionService.shadowCRUD('api::restaurant.restaurant').disableAction('create');
extensionService.shadowCRUD('api::restaurant.restaurant').disableAction('delete');
```

### GraphQL Middlewares & Policies

```ts
extensionService.use(({ strapi }) => ({
  resolversConfig: {
    'Query.restaurants': {
      auth: false,                    // make public
      policies: ['is-admin'],
      middlewares: [
        async (next, parent, args, context, info) => {
          const result = await next(parent, args, context, info);
          // transform result
          return result;
        },
      ],
    },
    'Mutation.createRestaurant': {
      auth: { scope: ['api::restaurant.restaurant.create'] },
      policies: ['global::is-authenticated'],
    },
  },
}));
```
