# Strapi v5 Backend Customization

## Architecture Flow

```
Request → Global Middlewares → Route → Route Middlewares → Policies → Controller → Service → Document Service → Query Engine → DB
```

## Controllers

Location: `src/api/[apiName]/controllers/[name].ts`

### Factory Pattern

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::restaurant.restaurant', ({ strapi }) => ({
  // Method 1: Custom action (new endpoint)
  async exampleAction(ctx) {
    try { ctx.body = 'ok'; }
    catch (err) { ctx.body = err; }
  },

  // Method 2: Wrap core action (extend behavior, keep core logic)
  async find(ctx) {
    ctx.query = { ...ctx.query, locale: 'en' };
    const { data, meta } = await super.find(ctx);
    meta.date = Date.now();
    return { data, meta };
  },

  // Method 3: Replace core action (full control, MUST sanitize)
  async find(ctx) {
    // Optional: throw on invalid/unauthorized query params
    await this.validateQuery(ctx);
    // Required: strip unauthorized query params
    const sanitizedQueryParams = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi.service('api::restaurant.restaurant').find(sanitizedQueryParams);
    // Required: strip private fields from output
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },
}));
```

### Sanitization Methods (CRITICAL)

| Method | Purpose | When |
|--------|---------|------|
| `this.validateQuery(ctx)` | Throws on invalid/unauthorized params | Optional, before query |
| `this.sanitizeQuery(ctx)` | Strips unauthorized query params | **Always** when overriding find/findOne |
| `this.sanitizeOutput(data, ctx)` | Strips private fields from response | **Always** before returning data |
| `this.transformResponse(data, meta)` | Wraps data in standard response format | When replacing core action |

### Core Controller Actions

| Action | Route | Description |
|--------|-------|-------------|
| `find` | GET /api/:plural | List documents |
| `findOne` | GET /api/:plural/:documentId | Get single document |
| `create` | POST /api/:plural | Create document |
| `update` | PUT /api/:plural/:documentId | Update document |
| `delete` | DELETE /api/:plural/:documentId | Delete document |

Generate with CLI: `strapi generate` → controller.

## Services

Location: `src/api/[apiName]/services/[name].ts`

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::restaurant.restaurant', ({ strapi }) => ({
  // Custom service method
  async exampleService(...args) {
    return { okay: true };
  },

  // Wrap core service
  async find(...args) {
    const { results, pagination } = await super.find(...args);
    results.forEach(r => { r.counter = 1; });
    return { results, pagination };
  },

  // Replace core service
  async findOne(documentId, params = {}) {
    return strapi.documents('api::restaurant.restaurant').findOne({
      documentId,
      ...super.getFetchParams(params),
    });
  },
}));
```

Services contain business logic. Controllers should be thin, delegating to services.

## Routes

Location: `src/api/[apiName]/routes/[name].ts`

### Core Router

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::restaurant.restaurant', {
  prefix: '',           // custom prefix for all routes
  only: ['find', 'findOne'],  // whitelist (anything else ignored)
  except: [],                  // blacklist (opposite of only)
  config: {
    find: {
      auth: false,       // make public (no auth)
      policies: [],
      middlewares: [],
    },
    findOne: {},
    create: {},
    update: {},
    delete: {},
  },
});
```

**Tip**: If you only override controller actions (find, findOne, etc.), you don't need to change routes — core routes already point to those handlers.

### Custom Router

```ts
// src/api/restaurant/routes/01-custom-restaurant.ts
// Prefix with 01- to load BEFORE core routes (alphabetical order)
import type { Core } from '@strapi/strapi';

const config: Core.RouterConfig = {
  type: 'content-api',  // uses /api prefix, content-type permissions
  routes: [
    {
      method: 'GET',
      path: '/restaurants/featured',
      handler: 'api::restaurant.restaurant.featured',
      config: {
        auth: false,
        policies: ['global::is-admin'],
        middlewares: ['api::restaurant.my-middleware'],
      },
    },
    {
      method: 'POST',
      path: '/restaurants/:id/review',
      handler: 'api::restaurant.restaurant.review',
    },
    {
      // URL params with regex validation
      method: 'GET',
      path: '/restaurants/:category([a-z]+)',
      handler: 'api::restaurant.restaurant.findByCategory',
    },
    {
      // Regex for numeric params
      method: 'GET',
      path: '/restaurants/:region(\\d{2}|\\d{3})/:id',
      handler: 'api::restaurant.restaurant.findOneByRegion',
    },
  ],
};
export default config;
```

**Route loading**: files loaded alphabetically. Name custom files with `01-` prefix to load before core.

**Handler format**: `api::<api-name>.<controllerName>.<actionName>` (fully qualified, recommended) or `<controllerName>.<actionName>` (legacy). Plugin: `plugin::<plugin-name>.<controllerName>.<actionName>`.

### Route Config

| Option | Type | Description |
|--------|------|-------------|
| `auth` | boolean/object | `false` = public, default = protected |
| `policies` | array | Names, objects `{name, config}`, or inline `(policyCtx, config, {strapi}) => bool` |
| `middlewares` | array | Names, objects `{name, config}`, or inline `(ctx, next) => {}` |

### Policies in Routes

```ts
config: {
  find: {
    policies: [
      'global::is-authenticated',                              // global
      'api::restaurant.is-owner',                              // API scope
      'plugin::users-permissions.isAuthenticated',             // plugin
      { name: 'api::restaurant.is-role', config: { role: 'admin' } }, // with config
      (policyContext, config, { strapi }) => true,             // inline
    ],
  },
}
```

### Middlewares in Routes

```ts
config: {
  find: {
    middlewares: [
      'global::my-timer',
      { name: 'api::restaurant.logger', config: { verbose: true } },
      (ctx, next) => { console.log('hit!'); return next(); },  // inline
    ],
  },
}
```

### Custom Content API Parameters

Register extra query/body params validated by Strapi's strict mode:

```ts
// src/index.ts
export default {
  register({ strapi }) {
    strapi.contentAPI.addQueryParams({
      search: {
        schema: (z) => z.string().max(200).optional(),
        matchRoute: (route) => route.path.includes('articles'), // optional filter
      },
    });
    strapi.contentAPI.addInputParams({
      clientMutationId: {
        schema: (z) => z.string().max(100).optional(),
      },
    });
  },
};
```

Enable `rest.strictParams: true` in `config/api.ts`. Reserved names (`filters`, `sort`, `fields`, `id`, `documentId`) cannot be registered.

## Policies

Location: `src/policies/` (global) or `src/api/[apiName]/policies/`

```ts
// src/policies/is-authenticated.ts
export default (policyContext, config, { strapi }) => {
  if (policyContext.state.user) return true;
  return false; // blocks request (returns 403)
};

// With config
// src/api/restaurant/policies/is-role.ts
export default (policyContext, config, { strapi }) => {
  return policyContext.state.user.role.code === config.role;
};
```

`policyContext` wraps Koa's `ctx` with extra logic for both REST and GraphQL compatibility.

### Naming Convention

| Scope | Format |
|-------|--------|
| Global | `global::policy-name` |
| API | `api::api-name.policy-name` |
| Plugin | `plugin::plugin-name.policy-name` |

List all: `strapi policies:list`

## Middlewares

3 types in Strapi:
1. **Global middlewares**: `config/middlewares.ts` (entire app, ordered array)
2. **Route middlewares**: attached to specific routes
3. **Document Service middlewares**: `strapi.documents.use()`

### Route Middleware Implementation

```ts
// src/middlewares/my-timer.ts (global) or src/api/[apiName]/middlewares/
export default (config, { strapi }) => {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    ctx.set('X-Response-Time', `${Date.now() - start}ms`);
  };
};
```

### Naming Convention

| Scope | Format |
|-------|--------|
| Global (application) | `global::middleware-name` |
| API level | `api::api-name.middleware-name` |
| Plugin | `plugin::plugin-name.middleware-name` |

Global middlewares must be added to `config/middlewares.ts` to be loaded. API/plugin middlewares are auto-loaded from their directories.

List all: `strapi middlewares:list`

## Webhooks

Config in `config/server.ts`:
```ts
webhooks: {
  defaultHeaders: { Authorization: `Bearer ${env('WEBHOOK_TOKEN')}` },
}
```

- Triggered on content CRUD events (create, update, delete, publish, unpublish)
- **Excluded**: User content-type (privacy). Use lifecycle hooks for User events.
- Configure endpoints in admin: Settings > Webhooks
- Security: send auth headers + verify HMAC signatures

```ts
// Verify webhook HMAC (receiver side)
const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const timestamp = req.headers['x-webhook-timestamp'];
const expected = crypto.createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Invalid');
```

## Admin Panel Customization

File: `src/admin/app.tsx`

```ts
export default {
  config: {
    locales: ['fr', 'es', 'de'],
    tutorials: false,                    // disable tutorial videos
    notifications: { releases: false },  // disable release notifications
    theme: {
      light: { /* override light theme tokens */ },
      dark: { /* override dark theme tokens */ },
    },
  },
  bootstrap(app) {
    // Injection zones
    app.getPlugin('content-manager').injectComponent('editView', 'right-links', {
      name: 'my-component', Component: MyComponent,
    });
  },
  register(app) {
    app.addMenuLink({ to: '/plugins/custom', icon: Icon, intlLabel: { id: 'custom', defaultMessage: 'Custom' }, Component: () => import('./pages/Custom') });
  },
};
```

### Logos

Place in `src/admin/extensions/`. SVG recommended. Provide light/dark variants.

### Homepage Widgets

Available since v5.13.0. Default: profile, entries, statistics. Custom widgets via app config.

## Strapi Global Object

Available in controllers, services, lifecycles, bootstrap:

```ts
strapi.documents('api::x.x')      // Document Service API
strapi.service('api::x.x')        // Get service
strapi.controller('api::x.x')     // Get controller
strapi.contentType('api::x.x')    // Get content-type schema
strapi.contentTypes                // All content-types
strapi.components                  // All components
strapi.plugin('name')             // Get plugin
strapi.plugin('name').service('s') // Plugin service
strapi.db.query('api::x.x')      // Query Engine (low-level DB)
strapi.config.get('server.host')  // Read config value
strapi.log.info('message')       // Logger (info, warn, error, debug)
strapi.cron.add({})               // Add dynamic cron job
strapi.dirs.public                // Public directory path
strapi.dirs.app.root              // App root path
```
