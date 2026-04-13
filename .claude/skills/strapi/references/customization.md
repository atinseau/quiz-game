# Strapi v5 Backend Customization

## Controllers

Location: `src/api/[apiName]/controllers/[name].ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::restaurant.restaurant', ({ strapi }) => ({
  // Custom action
  async exampleAction(ctx) {
    ctx.body = 'ok';
  },

  // Wrap core action (keeps core logic)
  async find(ctx) {
    ctx.query = { ...ctx.query, locale: 'en' };
    const { data, meta } = await super.find(ctx);
    meta.date = Date.now();
    return { data, meta };
  },

  // Replace core action (with sanitization)
  async find(ctx) {
    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi.service('api::restaurant.restaurant').find(sanitizedQuery);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },
}));
```

**Always sanitize**: use `validateQuery()`, `sanitizeQuery()`, `sanitizeOutput()` when overriding core actions.

## Services

Location: `src/api/[apiName]/services/[name].ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::restaurant.restaurant', ({ strapi }) => ({
  async exampleService(...args) { return { okay: true }; },

  // Wrap core
  async find(...args) {
    const { results, pagination } = await super.find(...args);
    results.forEach(r => { r.counter = 1; });
    return { results, pagination };
  },

  // Replace core
  async findOne(documentId, params = {}) {
    return strapi.documents('api::restaurant.restaurant').findOne({
      documentId,
      ...super.getFetchParams(params),
    });
  },
}));
```

## Routes

Location: `src/api/[apiName]/routes/[name].ts`

### Core Router (auto-generated CRUD)

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::restaurant.restaurant', {
  prefix: '',
  only: ['find', 'findOne'],      // whitelist
  except: [],                      // blacklist
  config: {
    find: { auth: false, policies: [], middlewares: [] },
    findOne: {},
    create: {},
    update: {},
    delete: {},
  },
});
```

### Custom Router

```ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/restaurants/featured',
      handler: 'restaurant.featured',
      config: {
        auth: false,
        policies: ['is-admin'],
        middlewares: ['api::restaurant.my-middleware'],
      },
    },
  ],
};
```

## Policies

Location: `src/policies/` (global) or `src/api/[apiName]/policies/`

```ts
// src/policies/is-authenticated.ts
export default (policyContext, config, { strapi }) => {
  if (policyContext.state.user) return true;
  return false; // blocks request
};
```

Usage in routes:
- Global: `'global::is-authenticated'`
- API: `'api::restaurant.is-owner'`
- Plugin: `'plugin::users-permissions.isAuthenticated'`

Policies receive `config` from route definition:
```ts
config: { find: { policies: [{ name: 'my-policy', config: { role: 'admin' } }] } }
```

## Middlewares

3 types: **Global** (config/middlewares.ts), **Route-level**, **Document Service**.

### Route Middleware

Location: `src/api/[apiName]/middlewares/` or `src/middlewares/`

```ts
// src/middlewares/my-timer.ts
export default (config, { strapi }) => {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    ctx.set('X-Response-Time', `${Date.now() - start}ms`);
  };
};
```

Usage in route config: `middlewares: ['global::my-timer']`

Naming: `global::name`, `api::apiName.name`, `plugin::pluginName.name`

## Webhooks

Config in `config/server.ts`:
```ts
webhooks: {
  defaultHeaders: { Authorization: `Bearer ${env('WEBHOOK_TOKEN')}` },
}
```

- Configured via admin panel (Settings > Webhooks)
- Triggered on content CRUD events
- User content-type excluded (privacy)
- Verify signatures with HMAC for security
- For User events, use lifecycle hooks instead

## Model Lifecycles

File: `src/api/[apiName]/content-types/[name]/lifecycles.ts`

Hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeFindOne`, `afterFindOne`, `beforeFindMany`, `afterFindMany`, `beforeCount`, `afterCount`.

```ts
export default {
  async beforeCreate(event) {
    const { data } = event.params;
    data.slug = slugify(data.title);
  },
  async afterCreate(event) {
    const { result } = event;
    await strapi.service('api::email.email').send(result);
  },
};
```

## Admin Panel Customization

File: `src/admin/app.tsx`

```ts
export default {
  config: {
    locales: ['fr', 'es'],
    tutorials: false,
    notifications: { releases: false },
    theme: { light: {}, dark: {} },
  },
  bootstrap(app) {
    // injection zones, reducers, hooks
  },
  register(app) {
    // menu links, settings links
  },
};
```

Logos: `src/admin/extensions/` — replace login/menu logos (SVG recommended).
Homepage: customizable widgets since v5.13.0.
