# Strapi v5 Configuration Reference

All config files export `({ env }) => ({})`. Per-environment overrides: `config/env/{environment}/`.

`env()` helpers: `env('VAR', default)`, `env.int()`, `env.bool()`, `env.json()`, `env.array()`.

## Database — `config/database.ts`

Supported: PostgreSQL (17+), MySQL (8.4+), MariaDB (11.4+), SQLite 3. **No MongoDB. No cloud-native DBs (Aurora, Cloud SQL).**

```ts
export default ({ env }) => ({
  connection: {
    client: 'postgres', // 'sqlite' | 'mysql' | 'postgres'
    connection: {
      connectionString: env('DATABASE_URL'),  // overrides host/port/db if set
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', ''),
      ssl: env.bool('DATABASE_SSL', false) && {
        rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
      },
      schema: 'public', // PostgreSQL only
    },
    pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    acquireConnectionTimeout: 60000,
    debug: false,
  },
  settings: { forceMigration: false },
});
```

### SQLite

```ts
connection: { client: 'sqlite', connection: { filename: env('DATABASE_FILENAME', '.tmp/data.db') }, useNullAsDefault: true }
```

### MySQL

```ts
connection: {
  client: 'mysql',
  connection: { host: env('DATABASE_HOST', 'localhost'), port: env.int('DATABASE_PORT', 3306), database: env('DATABASE_NAME', 'strapi'), user: env('DATABASE_USERNAME', 'strapi'), password: env('DATABASE_PASSWORD', '') },
}
```

**Client mapping**: `sqlite` → `better-sqlite3`, `mysql` → `mysql2`, `postgres` → `pg`.

## Server — `config/server.ts`

```ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', ''),           // public-facing URL (required for reset password, OAuth, etc.)
  app: { keys: env.array('APP_KEYS') }, // session signing keys (REQUIRED)
  socket: '/tmp/nginx.socket',          // optional: Unix socket
  emitErrors: false,                    // emit errors to Koa for custom handlers
  proxy: {
    global: env('GLOBAL_PROXY'),        // forward proxy for all external requests
    koa: true,                          // trust proxy headers (X-Forwarded-*)
    fetch: env('HTTP_PROXY'),           // proxy for strapi.fetch() (licenses, telemetry, webhooks)
    http: env('HTTP_PROXY'),
    https: env('HTTPS_PROXY'),
  },
  cron: {
    enabled: env.bool('CRON_ENABLED', false),
    tasks: require('./cron-tasks'),
  },
  dirs: { public: './public' },
  webhooks: {
    defaultHeaders: { Authorization: `Bearer ${env('WEBHOOK_TOKEN')}` },
  },
  http: {
    serverOptions: { requestTimeout: 330000 }, // ms, increase for large uploads
  },
});
```

**Caution**: Changes require `strapi build` to rebuild admin.

## Admin Panel — `config/admin.ts`

```ts
export default ({ env }) => ({
  url: '/admin',                       // admin path (e.g. '/dashboard')
  host: 'localhost',
  port: 8000,
  autoOpen: true,                      // open browser on start
  serveAdminPanel: true,               // set false for API-only deployment
  watchIgnoreFiles: [],
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    events: { onConnectionSuccess(e) {}, onConnectionError(e) {} },
  },
  apiToken: { salt: env('API_TOKEN_SALT') },
  transfer: { token: { salt: env('TRANSFER_TOKEN_SALT') } },
  flags: { nps: true, promoteEE: true },
});
```

UI config (tutorials, notifications, theme): `src/admin/app.tsx`, NOT `config/admin.ts`.

## API — `config/api.ts`

```ts
export default ({ env }) => ({
  responses: {
    privateAttributes: ['_v', 'id', 'created_at'], // stripped from ALL API responses
  },
  rest: {
    prefix: '/api',         // REST prefix (default '/api')
    defaultLimit: 25,
    maxLimit: 100,          // if maxLimit < defaultLimit, maxLimit is used
    strictParams: true,     // reject unknown query/body params
  },
  documents: {
    strictParams: true,     // reject unknown params in strapi.documents() calls
  },
});
```

## Middlewares — `config/middlewares.ts`

**Ordered array** — execution order matters.

```ts
export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

### Built-in Middleware Configuration

```ts
// Security (Helmet) — CSP, XSS protection, etc.
{
  name: 'strapi::security',
  config: {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", 'https:'],
        'img-src': ["'self'", 'data:', 'blob:', 'cdn.example.com'],
        'media-src': ["'self'", 'data:', 'blob:', 'cdn.example.com'],
        upgradeInsecureRequests: null,  // disable in dev
      },
    },
  },
},

// CORS
{
  name: 'strapi::cors',
  config: {
    origin: ['http://localhost:3000', 'https://myapp.com'],  // or '*'
    headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    keepHeaderOnError: true,
  },
},

// Body parser — adjust for large file uploads
{
  name: 'strapi::body',
  config: {
    formLimit: '256mb',
    jsonLimit: '256mb',
    textLimit: '256mb',
    formidable: { maxFileSize: 250 * 1024 * 1024 },  // 250MB
  },
},

// Powered-by header
{ name: 'strapi::poweredBy', config: { poweredBy: 'My Company' } },
```

### Adding Custom Middleware

```ts
'global::my-middleware',                                      // by name (from src/middlewares/)
{ name: 'global::my-middleware', config: { foo: 'bar' } },   // with config
{ resolve: '../some-dir/custom-middleware', config: {} },     // by path
{ name: 'my-npm-package', config: {} },                      // npm module
```

## Plugins — `config/plugins.ts`

```ts
export default ({ env }) => ({
  i18n: true,                          // enable with defaults
  graphql: { config: { endpoint: '/graphql', playgroundAlways: false, defaultLimit: 25, maxLimit: 100 } },
  'my-plugin': { enabled: true, resolve: './src/plugins/my-plugin', config: { option: 'value' } },
  'unwanted-plugin': { enabled: false },  // disable

  // Upload (Media Library) config
  upload: {
    config: {
      provider: 'aws-s3',  // or 'cloudinary' or default local
      providerOptions: {
        baseUrl: env('CDN_URL'),
        s3Options: {
          credentials: { accessKeyId: env('AWS_ACCESS_KEY_ID'), secretAccessKey: env('AWS_ACCESS_SECRET') },
          region: env('AWS_REGION'),
          params: { Bucket: env('AWS_BUCKET') },
        },
      },
      sizeLimit: 250 * 1024 * 1024,  // 250MB
      breakpoints: { xlarge: 1920, large: 1000, medium: 750, small: 500, xsmall: 64 },
      security: { allowedTypes: ['image/*', 'application/*'], deniedTypes: ['application/x-sh'] },
    },
  },

  // Users & Permissions
  'users-permissions': {
    config: { jwt: { expiresIn: '7d' }, register: { allowedFields: ['username', 'email', 'password'] } },
  },
});
```

### Media Library Providers

**Local** (default): `public/uploads/`. Configure `localServer` options (koa-static, maxage).

**S3**: `@strapi/provider-upload-aws-s3` — supports S3-compatible services (Cloudflare R2, Scaleway, MinIO).

**Cloudinary**: `@strapi/provider-upload-cloudinary`

```ts
upload: { config: { provider: 'cloudinary', providerOptions: { cloud_name: env('CLOUDINARY_NAME'), api_key: env('CLOUDINARY_KEY'), api_secret: env('CLOUDINARY_SECRET') } } }
```

**Important**: Add provider CDN domain to `strapi::security` CSP `img-src` and `media-src`.

### Responsive Images

When enabled (admin setting): generates large (1000px), medium (750px), small (500px). Custom breakpoints in `upload.config.breakpoints`. Only applies to new uploads.

### Upload Size & Timeout

Match all these for large file support:
1. `upload.config.sizeLimit` (bytes)
2. `strapi::body` → `formidable.maxFileSize`
3. `server.http.serverOptions.requestTimeout` (default 330000ms)
4. Upstream proxy (nginx `client_max_body_size`, etc.)

### File Security

MIME type validated from content (not extension). Use `allowedTypes`/`deniedTypes` with glob patterns (`image/*`, `application/pdf`).

## Cron Jobs — `config/cron-tasks.ts`

Enable: `config/server.ts` → `cron: { enabled: true }`. Powered by `node-schedule`.

```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    └ day of week (0-7, 0/7 = Sun)
│    │    │    │    └───── month (1-12)
│    │    │    └────────── day of month (1-31)
│    │    └─────────────── hour (0-23)
│    └──────────────────── minute (0-59)
└───────────────────────── second (0-59, OPTIONAL)
```

```ts
// Object format
export default {
  myJob: {
    task: ({ strapi }) => { /* send emails, cleanup, backup */ },
    options: { rule: '0 0 1 * * 1', tz: 'America/New_York' },
  },
};

// Key format
export default {
  '0 0 1 * * 1': ({ strapi }) => { /* Every Monday 1am */ },
};

// One-time execution
export default {
  oneTimeJob: {
    task: ({ strapi }) => { /* ... */ },
    options: { rule: new Date(Date.now() + 60000) }, // run once in 1 min
  },
};
```

Dynamic cron: `strapi.cron.add({})`, `strapi.cron.remove('name')`.

## Features — `config/features.ts`

```ts
export default ({ env }) => ({
  future: {
    experimental_firstPublishedAt: env.bool('STRAPI_FUTURE_EXPERIMENTAL_FIRST_PUBLISHED_AT', false),
  },
});
```

Runtime check: `strapi.future.isEnabled('experimental_firstPublishedAt')`.

Via env: `.env` → `STRAPI_FUTURE_EXPERIMENTAL_FIRST_PUBLISHED_AT=true`.

**Warning**: experimental features may break, change, or be removed.
