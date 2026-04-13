# Strapi v5 Content Types & Models

## Schema Format

Located at `src/api/[apiName]/content-types/[name]/schema.json`:

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
    "draftAndPublish": true
  },
  "pluginOptions": {
    "i18n": { "localized": true }
  },
  "attributes": {
    "name": { "type": "string", "required": true, "maxLength": 100 },
    "description": { "type": "richtext" },
    "rating": { "type": "integer", "min": 0, "max": 5 },
    "cover": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "category": { "type": "relation", "relation": "manyToOne", "target": "api::category.category", "inversedBy": "restaurants" },
    "tags": { "type": "relation", "relation": "manyToMany", "target": "api::tag.tag" },
    "seo": { "type": "component", "component": "shared.seo", "required": false },
    "blocks": { "type": "dynamiczone", "components": ["shared.hero", "shared.cta"] }
  }
}
```

`kind`: `collectionType` (multiple entries) | `singleType` (one entry).

## Attribute Types

| Type | Options |
|------|---------|
| `string` | minLength, maxLength, regex, unique, default |
| `text` | minLength, maxLength |
| `richtext` | — |
| `blocks` | Strapi's block editor (structured JSON) |
| `integer` | min, max, unique, default |
| `biginteger` | min, max, unique |
| `float` | min, max |
| `decimal` | min, max |
| `boolean` | default |
| `date` | — |
| `time` | — |
| `datetime` | — |
| `timestamp` | — |
| `email` | minLength, maxLength, unique |
| `password` | minLength, maxLength |
| `enumeration` | enum: ['val1', 'val2'], default |
| `json` | — |
| `uid` | targetField, options (generates slug from field) |
| `media` | multiple, allowedTypes: ['images','files','videos','audios'] |
| `relation` | see Relations below |
| `component` | component (uid), repeatable, required, min, max |
| `dynamiczone` | components: ['uid1', 'uid2'], min, max |

Common options on most types: `required`, `unique`, `private`, `configurable`, `default`, `pluginOptions`.

## Relations

| Relation | Schema |
|----------|--------|
| oneToOne | `{ relation: "oneToOne", target: "api::x.x" }` |
| oneToMany | `{ relation: "oneToMany", target: "api::x.x", mappedBy: "field" }` |
| manyToOne | `{ relation: "manyToOne", target: "api::x.x", inversedBy: "field" }` |
| manyToMany | `{ relation: "manyToMany", target: "api::x.x", inversedBy: "field" }` |
| morphToOne | `{ relation: "morphToOne" }` |
| morphToMany | `{ relation: "morphToMany" }` |

Bidirectional: use `inversedBy`/`mappedBy` pair on both sides.

## Components

Stored in `src/components/[category]/[name].json`:
```json
{
  "collectionName": "components_shared_seos",
  "info": { "displayName": "Seo", "icon": "search", "description": "" },
  "attributes": {
    "metaTitle": { "type": "string", "required": true },
    "metaDescription": { "type": "text" }
  }
}
```

Referenced as `"component": "shared.seo"`. Can be `repeatable: true`.

## Dynamic Zones

Array of allowed component UIDs. Content editors pick which component to add per entry.

## Draft & Publish

Enabled per content-type: `options.draftAndPublish: true` (default).

- All entries created as drafts (`publishedAt: null`)
- Publish: sets `publishedAt` timestamp
- Unpublish: reverts to draft
- Discard draft: revert draft changes, keep published version
- REST: `?status=draft` or `?status=published` (default returns draft in Document Service, published in REST)
- Document Service: `status: 'published'` parameter

## Internationalization (i18n)

Enable per content-type: `pluginOptions.i18n.localized: true`.

- Each document can have versions per locale
- Default locale: `en` (configurable in admin)
- Per-field localization: `pluginOptions.i18n.localized: true` on attribute
- REST: `?locale=fr`
- Document Service: `locale: 'fr'` parameter

## Lifecycle Hooks

File: `src/api/[apiName]/content-types/[name]/lifecycles.ts`

```ts
export default {
  beforeCreate(event) { /* event.params, event.model, event.state */ },
  afterCreate(event) { /* event.result, event.params */ },
  beforeUpdate(event) {},
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

Available hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeFindOne`, `afterFindOne`, `beforeFindMany`, `afterFindMany`, `beforeCount`, `afterCount`.

`event` object: `{ params, model, state, result (after hooks only) }`.
