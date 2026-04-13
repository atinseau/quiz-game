# Strapi v5 Content Types & Models

## Schema Location

- Content-types: `src/api/[apiName]/content-types/[name]/schema.json`
- Components: `src/components/[category]/[name].json`
- Lifecycle hooks: `src/api/[apiName]/content-types/[name]/lifecycles.ts`

## Schema Structure

```json
{
  "kind": "collectionType",
  "collectionName": "restaurants",
  "info": {
    "singularName": "restaurant",
    "pluralName": "restaurants",
    "displayName": "Restaurant",
    "description": ""
  },
  "options": {
    "draftAndPublish": true,
    "privateAttributes": ["id", "createdAt"],
    "populateCreatorFields": false
  },
  "pluginOptions": {
    "i18n": { "localized": true },
    "content-manager": { "visible": true },
    "content-type-builder": { "visible": true }
  },
  "attributes": {}
}
```

- `kind`: `collectionType` (multiple entries) | `singleType` (one entry)
- `collectionName`: database table name override
- `singularName`/`pluralName`: kebab-case, used for API routes (`/api/:pluralName`)
- `draftAndPublish`: default `true` (false if created from CLI)
- `populateCreatorFields`: include `createdBy`/`updatedBy` in REST responses

## Attribute Types Reference

### String Types

| Type | Options |
|------|---------|
| `string` | minLength, maxLength, regex, unique, default |
| `text` | minLength, maxLength |
| `richtext` | — (legacy Markdown editor) |
| `blocks` | — (Strapi block editor, structured JSON output) |
| `email` | minLength, maxLength, unique |
| `password` | minLength, maxLength (always private) |
| `enumeration` | `enum: ['val1', 'val2']`, default, `enumName` |
| `uid` | `targetField` (auto-slug from field), regex: `/^[A-Za-z0-9-_.~]*$/` |

### Number Types

| Type | Options |
|------|---------|
| `integer` | min, max, unique, default |
| `biginteger` | min, max, unique |
| `float` | min, max |
| `decimal` | min, max |

### Date Types

| Type | Format |
|------|--------|
| `date` | YYYY-MM-DD |
| `time` | HH:mm:ss.SSS |
| `datetime` | ISO 8601 |
| `timestamp` | Unix timestamp |

### Other Types

| Type | Options |
|------|---------|
| `boolean` | default |
| `json` | — (arbitrary JSON) |

### Common Validation Options (all types)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `required` | boolean | false | Field must have a value |
| `unique` | boolean | false | Value must be unique across entries |
| `private` | boolean | false | Hidden from API responses |
| `configurable` | boolean | true | Editable in Content-type Builder |
| `default` | any | — | Default value |
| `min` | number | — | Minimum value (numbers) or min length |
| `max` | number | — | Maximum value (numbers) or max length |
| `minLength` | number | — | Minimum character length (strings) |
| `maxLength` | number | — | Maximum character length (strings) |

### UID Type

```json
{
  "slug": {
    "type": "uid",
    "targetField": "title"
  }
}
```

Auto-generates URL-safe identifier from `targetField`. Pattern: `/^[A-Za-z0-9-_.~]*$/`.

## Database Column Settings (Advanced)

Override Knex.js column settings directly:

```json
{
  "title": {
    "type": "string",
    "column": {
      "unique": true,
      "defaultTo": "Untitled",
      "notNullable": true
    }
  },
  "rating": {
    "type": "decimal",
    "column": {
      "type": "decimal",
      "args": [6, 1]
    }
  }
}
```

| Column Option | Type | Description |
|---------------|------|-------------|
| `name` | string | Override column name in DB |
| `defaultTo` | string | DB-level default |
| `notNullable` | boolean | DB-level NOT NULL (applies even to drafts) |
| `unsigned` | boolean | Numbers only: remove negative, double max |
| `unique` | boolean | DB-level unique (published only with D&P) |
| `type` | string | Override DB column type |
| `args` | array | Arguments for Knex type function |

**Draft & Publish + unique caveat**: DB unique constraint only checked at publish time. Drafts can have duplicates. Add lifecycle hook validation if you need draft uniqueness.

## Relations

| Relation | Owner Side | Inverse Side |
|----------|-----------|--------------|
| One-to-One (unidirectional) | `{ relation: "oneToOne", target: "api::x.x" }` | — |
| One-to-One (bidirectional) | `{ relation: "oneToOne", target: "api::x.x", inversedBy: "field" }` | `{ relation: "oneToOne", target: "api::y.y", mappedBy: "field" }` |
| One-to-Many | `{ relation: "oneToMany", target: "api::x.x", mappedBy: "field" }` | Many-to-One side |
| Many-to-One | `{ relation: "manyToOne", target: "api::x.x", inversedBy: "field" }` | One-to-Many side |
| Many-to-Many (unidirectional) | `{ relation: "manyToMany", target: "api::x.x" }` | — |
| Many-to-Many (bidirectional) | `{ relation: "manyToMany", target: "api::x.x", inversedBy: "field" }` | `{ relation: "manyToMany", target: "api::y.y", mappedBy: "field" }` |

**Rules**: `inversedBy` on owning side, `mappedBy` on inverse side. One-to-Many always bidirectional (paired with Many-to-One).

### Full Relation Examples

```json
// Article → Category (Many-to-One, bidirectional)
// article/schema.json
"category": {
  "type": "relation",
  "relation": "manyToOne",
  "target": "api::category.category",
  "inversedBy": "articles"
}
// category/schema.json
"articles": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::article.article",
  "mappedBy": "category"
}

// Article ↔ Tag (Many-to-Many, bidirectional)
// article/schema.json
"tags": {
  "type": "relation",
  "relation": "manyToMany",
  "target": "api::tag.tag",
  "inversedBy": "articles"
}
// tag/schema.json
"articles": {
  "type": "relation",
  "relation": "manyToMany",
  "target": "api::article.article",
  "mappedBy": "tags"
}

// Person → Plants (One-to-Many)
// person/schema.json
"plants": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::plant.plant",
  "mappedBy": "owner"
}
// plant/schema.json
"owner": {
  "type": "relation",
  "relation": "manyToOne",
  "target": "api::person.person",
  "inversedBy": "plants"
}
```

## Media Fields

```json
"cover": {
  "type": "media",
  "multiple": false,
  "allowedTypes": ["images"]
}
"gallery": {
  "type": "media",
  "multiple": true,
  "allowedTypes": ["images", "files", "videos", "audios"]
}
```

Supported: JPEG, PNG, GIF, SVG, TIFF, ICO, DVU, MPEG, MP4, MOV, WMV, AVI, FLV, MP3, WAV, OGG, CSV, ZIP, PDF, XLS/XLSX, JSON.

## Components

```json
// src/components/shared/seo.json
{
  "collectionName": "components_shared_seos",
  "info": { "displayName": "Seo", "icon": "search" },
  "attributes": {
    "metaTitle": { "type": "string", "required": true },
    "metaDescription": { "type": "text" }
  }
}

// Usage in content-type (single)
"seo": { "type": "component", "component": "shared.seo", "required": false }

// Usage repeatable
"features": { "type": "component", "component": "shared.feature", "repeatable": true, "min": 1, "max": 10 }
```

## Dynamic Zones

```json
"blocks": {
  "type": "dynamiczone",
  "components": ["shared.hero", "shared.cta", "shared.gallery"],
  "min": 1,
  "max": 20
}
```

Content editors choose which component to add per slot. Queried with `__typename` in GraphQL, with `on` syntax in REST populate.

## Custom Fields

```json
"color": {
  "type": "customField",
  "customField": "plugin::color-picker.color",
  "options": { "format": "hex" }
}
```

Format: `plugin::plugin-name.field-name` or `global::field-name`. Custom fields are registered via plugin Admin Panel API or in `src/admin/app.tsx`.

## Plugin Options per Attribute

```json
"name": {
  "type": "string",
  "pluginOptions": {
    "i18n": { "localized": true }
  }
}
```

| Plugin | Option | Effect |
|--------|--------|--------|
| i18n | `localized: true` | Per-locale content for this field |
| content-manager | `visible: false` | Hide field in Content Manager |
| content-type-builder | `visible: false` | Hide in Content-type Builder |

## Draft & Publish

- Enabled per content-type: `options.draftAndPublish: true`
- All entries start as drafts (`publishedAt: null`)
- Actions: publish, unpublish, discard draft (revert draft to published state)
- **REST default**: returns published content; `?status=draft` for drafts
- **Document Service default**: returns drafts; `status: 'published'` for published
- Published docs always have a draft counterpart
- Modified drafts show "Modified" status in admin

## Lifecycle Hooks

### Declarative (per content-type)

```ts
// src/api/article/content-types/article/lifecycles.ts
export default {
  beforeCreate(event) {
    const { data, where, select, populate } = event.params;
    event.params.data.slug = slugify(data.title);
  },
  afterCreate(event) {
    const { result, params } = event;
    // send notification, sync external system, etc.
  },
  beforeUpdate(event) {
    // modify data before save
  },
  afterUpdate(event) {},
  beforeDelete(event) {},
  afterDelete(event) {},
  beforeFindOne(event) {},
  afterFindOne(event) {},
  beforeFindMany(event) {},
  afterFindMany(event) {},
  beforeCount(event) {},
  afterCount(event) {},
};
```

### Programmatic (global subscriber)

```ts
// src/index.ts
export default {
  async bootstrap({ strapi }) {
    strapi.db.lifecycles.subscribe({
      models: ['api::article.article'], // optional, omit for all models
      beforeCreate(event) {
        event.state = 'myState'; // share state between before/after
      },
      afterCreate(event) {
        if (event.state === 'myState') { /* ... */ }
        const { result, params } = event;
      },
    });

    // Generic subscriber (all events, all models)
    strapi.db.lifecycles.subscribe((event) => {
      if (event.action === 'beforeCreate') { /* ... */ }
    });
  },
};
```

### Event Object

| Key | Type | Description |
|-----|------|-------------|
| `action` | string | Lifecycle event name |
| `model` | string | Content-type UID |
| `params` | object | `{ data, where, select, populate }` |
| `result` | object | Only in `after*` hooks |
| `state` | object | Shared between before/after of same operation |

### All Available Events

`beforeCreate`, `afterCreate`, `beforeCreateMany`, `afterCreateMany`, `beforeUpdate`, `afterUpdate`, `beforeUpdateMany`, `afterUpdateMany`, `beforeDelete`, `afterDelete`, `beforeDeleteMany`, `afterDeleteMany`, `beforeCount`, `afterCount`, `beforeFindOne`, `afterFindOne`, `beforeFindMany`, `afterFindMany`.

**Note**: `*Many` bulk events never fired by Document Service API — only by direct Query Engine. Lifecycle hooks not triggered when using Knex directly.
