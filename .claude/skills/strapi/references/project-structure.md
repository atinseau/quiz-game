# Strapi v5 Project Structure

## Directory Tree (TypeScript)

```
├── .strapi/client/        # Auto-generated bundler files
├── config/                # All configuration files
│   ├── admin.ts           # Admin panel config
│   ├── api.ts             # API config (REST defaults, pagination)
│   ├── cron-tasks.ts      # Cron job definitions
│   ├── database.ts        # DB connection (SQLite/Postgres/MySQL)
│   ├── middlewares.ts      # Global middleware stack (ordered array)
│   ├── plugins.ts         # Plugin enable/disable/config
│   ├── server.ts          # Host, port, URL, proxy, cron toggle
│   ├── features.ts        # Future flags (experimental)
│   └── typescript.ts      # TS autogenerate types option
├── database/migrations/   # DB migrations
├── dist/                  # Compiled JS output
│   └── build/             # Compiled admin panel
├── public/uploads/        # Uploaded files (local provider)
├── src/
│   ├── admin/             # Admin panel customization
│   │   ├── app.example.tsx
│   │   ├── extensions/    # Extend admin UI
│   │   └── tsconfig.json
│   ├── api/               # Business logic per API
│   │   └── [api-name]/
│   │       ├── content-types/[name]/
│   │       │   ├── schema.json    # Content-type schema
│   │       │   └── lifecycles.ts  # Lifecycle hooks
│   │       ├── controllers/
│   │       ├── middlewares/
│   │       ├── policies/
│   │       ├── routes/
│   │       ├── services/
│   │       └── index.ts
│   ├── components/        # Reusable components
│   │   └── [category]/
│   │       └── [component].json
│   ├── extensions/        # Extend installed plugins
│   │   └── [plugin-name]/
│   │       ├── content-types/[name]/schema.json
│   │       └── strapi-server.js
│   ├── middlewares/        # Global custom middlewares
│   ├── plugins/            # Local plugins
│   │   └── [plugin-name]/
│   │       ├── admin/src/
│   │       └── server/
│   └── index.ts            # App bootstrap/register hooks
├── .env
├── package.json
└── tsconfig.json
```

## Key Conventions

- **Content-type UID**: `api::restaurant.restaurant` (api::[apiName].[contentTypeName])
- **Plugin UID**: `plugin::myplugin.mytype`
- **API ID singular/plural**: defined in schema.json `info.singularName`/`info.pluralName`
- REST routes auto-generated: `GET /api/:pluralApiId`
- Config files export functions receiving `{ env }` helper

## TypeScript

- Default for new projects (--quickstart)
- `tsconfig.json` at root (server) + `src/admin/tsconfig.json` (admin)
- Compiled output in `dist/`
- Generate types: `strapi ts:generate-types`
- Auto-generate on restart: set `config/typescript.ts` → `autogenerate: true`

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| HOST | Server listen address | 0.0.0.0 |
| PORT | Server port | 1337 |
| APP_KEYS | Session/cookie signing keys | auto |
| API_TOKEN_SALT | API token salt | auto |
| ADMIN_JWT_SECRET | Admin JWT secret | auto |
| JWT_SECRET | Users & Permissions JWT | auto |
| TRANSFER_TOKEN_SALT | Data transfer tokens | auto |
| DATABASE_CLIENT | DB client (sqlite/postgres/mysql) | sqlite |
| DATABASE_FILENAME | SQLite file path | .tmp/data.db |
| NODE_ENV | production enables specific behaviors | development |
| STRAPI_TELEMETRY_DISABLED | Disable telemetry | false |

`env()` helper casts values: `env('PORT', 1337)`, `env.int()`, `env.bool()`, `env.json()`, `env.array()`.

Per-environment configs: `config/env/{environment}/` overrides base config.
