# Strapi v5 Configuration Reference

## Database — `config/database.ts`

Supported: PostgreSQL (17+), MySQL (8.4+), MariaDB (11.4+), SQLite 3. No MongoDB.

```ts
export default ({ env }) => ({
  connection: {
    client: 'postgres', // 'sqlite' | 'mysql' | 'postgres'
    connection: {
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', ''),
      ssl: env.bool('DATABASE_SSL', false) && { rejectUnauthorized: false },
    },
    pool: { min: 2, max: 10 },
    debug: false,
  },
  settings: {
    forceMigration: false, // auto run migrations on start
  },
});
```

SQLite shorthand:
```ts
connection: { client: 'sqlite', connection: { filename: env('DATABASE_FILENAME', '.tmp/data.db') }, useNullAsDefault: true }
```

## Server — `config/server.ts`

```ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', ''),        // public URL, enables proxy
  app: { keys: env.array('APP_KEYS') },
  proxy: { koa: true },              // trust proxy headers
  cron: { enabled: true, tasks: require('./cron-tasks') },
  dirs: { public: './public' },
  webhooks: { defaultHeaders: { Authorization: `Bearer ${env('WEBHOOK_TOKEN')}` } },
});
```

## Admin Panel — `config/admin.ts`

```ts
export default ({ env }) => ({
  url: '/admin',                      // admin path
  host: 'localhost',
  port: 8000,
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    events: { onConnectionSuccess(e) {}, onConnectionError(e) {} },
  },
  apiToken: { salt: env('API_TOKEN_SALT') },
  transfer: { token: { salt: env('TRANSFER_TOKEN_SALT') } },
  autoOpen: true,
  serveAdminPanel: true,
  watchIgnoreFiles: [],
  flags: { nps: true, promoteEE: true },
});
```

## API — `config/api.ts`

```ts
export default ({ env }) => ({
  responses: { privateAttributes: ['_v', 'id', 'created_at'] },
  rest: {
    prefix: '/api',
    defaultLimit: 25,
    maxLimit: 100,
    strictParams: true, // reject unknown query params
  },
  documents: {
    strictParams: true, // reject unknown params in Document Service calls
  },
});
```

## Middlewares — `config/middlewares.ts`

Ordered array controls execution. Built-in prefixed `strapi::`:

```ts
export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',    // helmet config
  'strapi::cors',        // { origin: ['*'], headers: [...] }
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',        // { multipart: true, formLimit: '256kb', jsonLimit: '1mb' }
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // Custom:
  'global::my-middleware',
  { name: 'strapi::security', config: { contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'cdn.example.com'] } } } },
  { resolve: './src/middlewares/custom', config: { foo: 'bar' } },
];
```

## Plugins — `config/plugins.ts`

```ts
export default ({ env }) => ({
  i18n: true,                         // enable with defaults
  graphql: { config: { playgroundAlways: false } },
  'my-plugin': { enabled: true, resolve: './src/plugins/my-plugin', config: {} },
  'other-plugin': { enabled: false }, // disable installed plugin
});
```

## Cron Jobs — `config/cron-tasks.ts`

Enable in server config: `cron: { enabled: true }`. Uses node-schedule format.

```ts
export default {
  myJob: {
    task: ({ strapi }) => { /* logic */ },
    options: {
      rule: '0 0 1 * * 1', // sec min hr dom mon dow
      tz: 'America/New_York',
    },
  },
};
```

## Media Library Providers

Default: local (`public/uploads/`).

**S3**: `@strapi/provider-upload-aws-s3`
```ts
// config/plugins.ts
upload: {
  config: {
    provider: 'aws-s3',
    providerOptions: {
      baseUrl: env('CDN_URL'),
      s3Options: {
        credentials: { accessKeyId: env('AWS_ACCESS_KEY_ID'), secretAccessKey: env('AWS_ACCESS_SECRET') },
        region: env('AWS_REGION'),
        params: { Bucket: env('AWS_BUCKET') },
      },
    },
  },
}
```

**Cloudinary**: `@strapi/provider-upload-cloudinary`
```ts
upload: {
  config: {
    provider: 'cloudinary',
    providerOptions: { cloud_name: env('CLOUDINARY_NAME'), api_key: env('CLOUDINARY_KEY'), api_secret: env('CLOUDINARY_SECRET') },
  },
}
```

Add provider domain to `strapi::security` middleware CSP `img-src`.

## Features / Future Flags — `config/features.ts`

```ts
export default ({ env }) => ({
  future: {
    experimental_firstPublishedAt: env.bool('STRAPI_FUTURE_EXPERIMENTAL_FIRST_PUBLISHED_AT', false),
  },
});
```

Check at runtime: `strapi.future.isEnabled('contentReleases')`.
