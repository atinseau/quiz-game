# Strapi v5 Plugins

## Installing Plugins

```bash
# From npm
yarn add @strapi/plugin-graphql
# or bun add @strapi/plugin-graphql

# Enable in config/plugins.ts
export default { graphql: { config: { playgroundAlways: false } } };
```

Marketplace: browse in admin (Settings > Marketplace) or strapi.io/market.

## Plugin Structure

```
src/plugins/my-plugin/
├── admin/
│   └── src/
│       └── index.ts        # register, bootstrap, registerTrads
├── server/
│   ├── index.ts            # Main entry: register, bootstrap, destroy
│   ├── config/
│   │   └── index.ts        # default config + validator
│   ├── content-types/
│   │   └── my-type/
│   │       └── schema.json
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── policies/
│   └── middlewares/
├── package.json
└── strapi-server.js        # Server entry (can re-export from server/)
```

## Server API

Entry file exports:

```ts
export default {
  register({ strapi }) {
    // Called during bootstrap, register new APIs/features
  },
  bootstrap({ strapi }) {
    // Called after all plugins registered, run init logic
  },
  destroy({ strapi }) {
    // Cleanup on server stop
  },
  config: {
    default: { myDefault: 'value' },
    validator(config) {
      if (!config.myDefault) throw new Error('myDefault required');
    },
  },
  controllers: { myController: { index(ctx) { ctx.body = 'ok'; } } },
  services: { myService: { find() { return []; } } },
  routes: [
    { method: 'GET', path: '/my-plugin', handler: 'myController.index', config: { policies: [] } },
  ],
  policies: {},
  middlewares: {},
  contentTypes: {},
};
```

Access plugin services: `strapi.plugin('my-plugin').service('myService').find()`

## Admin Panel API

```ts
export default {
  register(app) {
    // Add menu links
    app.addMenuLink({
      to: '/plugins/my-plugin',
      icon: MyIcon,
      intlLabel: { id: 'my-plugin.name', defaultMessage: 'My Plugin' },
      Component: () => import('./pages/App'),
      permissions: [],
    });

    // Add settings link
    app.addSettingsLink('global', {
      to: '/settings/my-plugin',
      icon: MyIcon,
      intlLabel: { id: 'my-plugin.settings', defaultMessage: 'Settings' },
      Component: () => import('./pages/Settings'),
      permissions: [],
    });
  },

  bootstrap(app) {
    // Injection zones: inject components into admin
    app.getPlugin('content-manager').injectComponent('editView', 'right-links', {
      name: 'my-component',
      Component: MyComponent,
    });
  },

  async registerTrads({ locales }) {
    // Load translations
    return Promise.all(
      locales.map(async (locale) => {
        const data = await import(`./translations/${locale}.json`);
        return { data, locale };
      })
    );
  },
};
```

## GraphQL Plugin

Install: `yarn add @strapi/plugin-graphql`

Config in `config/plugins.ts`:
```ts
graphql: {
  config: {
    endpoint: '/graphql',
    playgroundAlways: false,
    defaultLimit: 25,
    maxLimit: 100,
    apolloServer: { /* Apollo Server options */ },
  },
}
```

Auto-generates queries/mutations per content-type (Shadow CRUD).

### Custom Resolvers

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

### Disable Shadow CRUD for a type

```ts
extensionService.shadowCRUD('api::restaurant.restaurant').disable();
// Or disable specific actions:
extensionService.shadowCRUD('api::restaurant.restaurant').disableAction('create');
```

### GraphQL Middlewares

```ts
extensionService.use(({ strapi }) => ({
  resolversConfig: {
    'Query.restaurants': {
      middlewares: [
        async (next, parent, args, context, info) => {
          const result = await next(parent, args, context, info);
          // modify result
          return result;
        },
      ],
      auth: false, // make public
      policies: ['is-admin'],
    },
  },
}));
```
