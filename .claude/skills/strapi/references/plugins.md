# Strapi v5 Plugins

## Installing Plugins

```bash
yarn add @strapi/plugin-graphql
```

Enable in `config/plugins.ts`:
```ts
export default { graphql: { config: { playgroundAlways: false } } };
```

Marketplace: admin Settings > Marketplace, or strapi.io/market.

## Plugin Structure

```
src/plugins/my-plugin/
├── admin/src/
│   └── index.ts            # register, bootstrap, registerTrads
├── server/
│   ├── index.ts            # register, bootstrap, destroy, config, controllers, services, routes, policies, middlewares, contentTypes
│   ├── config/index.ts
│   ├── content-types/[name]/schema.json
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── policies/
│   └── middlewares/
├── package.json
└── strapi-server.js
```

## Server API

```ts
export default {
  register({ strapi }) {
    // First lifecycle — register APIs, extend schema
  },
  bootstrap({ strapi }) {
    // After ALL plugins registered — init logic, seed data, event subscriptions
  },
  destroy({ strapi }) {
    // Cleanup on stop — close connections, timers
  },

  config: {
    default: ({ env }) => ({ myDefault: 'value', apiKey: env('MY_PLUGIN_KEY') }),
    validator(config) { if (!config.myDefault) throw new Error('required'); },
  },

  controllers: {
    myController: {
      async index(ctx) { ctx.body = await strapi.plugin('my-plugin').service('myService').find(); },
      async create(ctx) { ctx.body = await strapi.plugin('my-plugin').service('myService').create(ctx.request.body); },
    },
  },

  services: {
    myService: {
      async find() { return strapi.documents('plugin::my-plugin.my-type').findMany(); },
      async create(data) { return strapi.documents('plugin::my-plugin.my-type').create({ data }); },
    },
  },

  routes: [
    { method: 'GET', path: '/my-plugin', handler: 'myController.index', config: { policies: [], auth: false } },
    { method: 'POST', path: '/my-plugin', handler: 'myController.create', config: { policies: ['admin::isAuthenticatedAdmin'] } },
  ],

  policies: {
    'is-owner': (ctx, config, { strapi }) => ctx.state.user?.id === ctx.params.id,
  },

  middlewares: {
    'my-middleware': (config, { strapi }) => async (ctx, next) => { await next(); },
  },

  contentTypes: {
    'my-type': {
      schema: {
        kind: 'collectionType',
        collectionName: 'my_plugin_entries',
        info: { singularName: 'entry', pluralName: 'entries', displayName: 'Entry' },
        attributes: { title: { type: 'string', required: true }, content: { type: 'richtext' } },
      },
    },
  },
};
```

### Accessing Plugin APIs

```ts
strapi.plugin('my-plugin').service('myService').find();
strapi.plugin('my-plugin').controller('myController');
strapi.plugin('my-plugin').config('myDefault');
strapi.plugin('my-plugin').contentType('my-type');
```

## Admin Panel API

```ts
export default {
  register(app) {
    // Menu link
    app.addMenuLink({
      to: '/plugins/my-plugin',
      icon: MyIcon,
      intlLabel: { id: 'my-plugin.name', defaultMessage: 'My Plugin' },
      Component: () => import('./pages/App'),
      permissions: [],
    });

    // Settings link
    app.addSettingsLink('global', {
      to: '/settings/my-plugin',
      icon: SettingsIcon,
      intlLabel: { id: 'my-plugin.settings', defaultMessage: 'Settings' },
      Component: () => import('./pages/Settings'),
      permissions: [{ action: 'plugin::my-plugin.settings.read', subject: null }],
    });

    // Register custom field
    app.customFields.register({
      name: 'color',
      pluginId: 'my-plugin',
      type: 'string',
      intlLabel: { id: 'color.label', defaultMessage: 'Color' },
      intlDescription: { id: 'color.desc', defaultMessage: 'Pick a color' },
      icon: ColorIcon,
      components: { Input: () => import('./components/ColorInput') },
      options: {
        base: [{
          name: 'options.format',
          type: 'select',
          value: 'hex',
          options: [
            { key: 'hex', value: 'hex', metadatas: { intlLabel: { id: 'hex', defaultMessage: 'Hex' } } },
            { key: 'rgb', value: 'rgb', metadatas: { intlLabel: { id: 'rgb', defaultMessage: 'RGB' } } },
          ],
        }],
      },
    });
  },

  bootstrap(app) {
    // Inject into Content Manager
    app.getPlugin('content-manager').injectComponent('editView', 'right-links', {
      name: 'my-component', Component: MyComponent,
    });
    // Add Redux reducer
    app.addReducers({ myPluginReducer });
  },

  async registerTrads({ locales }) {
    return Promise.all(locales.map(async (locale) => {
      try { const data = await import(`./translations/${locale}.json`); return { data: data.default, locale }; }
      catch { return { data: {}, locale }; }
    }));
  },
};
```

### Injection Zones

| Zone | Location |
|------|----------|
| `editView.right-links` | Top-right of edit view |
| `editView.informations` | Right sidebar info panel |
| `listView.actions` | List view action buttons |
| `listView.deleteModalAdditionalInfos` | Delete confirmation |

### Admin Hooks

```ts
app.registerHook('Admin/CM/pages/ListView/inject-column-in-table', ({ displayedHeaders, layout }) => {
  return { displayedHeaders, layout };
});
```

## Extending Existing Plugins

Location: `src/extensions/[plugin-name]/`

### Override Content-Type Schema

`src/extensions/[plugin-name]/content-types/[type-name]/schema.json`

### Extend Server Logic

```ts
// src/extensions/[plugin-name]/strapi-server.ts
export default (plugin) => {
  const originalFind = plugin.controllers.myController.find;
  plugin.controllers.myController.find = async (ctx) => {
    // custom logic before
    return originalFind(ctx);
  };
  plugin.services.myService.customMethod = async () => 'custom';
  return plugin;
};
```

## Users & Permissions Plugin

### Auth Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/local` | Login: `{ identifier, password }` → JWT |
| POST | `/api/auth/local/register` | Register: `{ username, email, password }` |
| GET | `/api/users/me` | Current user (requires JWT) |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Reset with code + newPassword |
| POST | `/api/auth/change-password` | Change (authed): `{ currentPassword, password, passwordConfirmation }` |

### JWT Usage

```bash
# Login
POST /api/auth/local
{ "identifier": "user@example.com", "password": "pass123" }
# → { "jwt": "eyJ...", "user": { "id": 1, "username": "user", ... } }

# Authenticated request
GET /api/articles
Authorization: Bearer eyJ...
```

### Config

```ts
// config/plugins.ts
'users-permissions': {
  config: {
    jwt: { expiresIn: '7d' },
    register: { allowedFields: ['username', 'email', 'password'] },
  },
}
```
