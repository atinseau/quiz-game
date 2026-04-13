# Strapi v5 Deployment & CLI

## CLI Commands

| Command | Description |
|---------|-------------|
| `strapi develop` / `strapi dev` | Start dev server with auto-reload |
| `strapi start` | Start production server (requires prior build) |
| `strapi build` | Build admin panel |
| `strapi generate` | Interactive generator (content-type, controller, service, policy, middleware, plugin, api) |
| `strapi ts:generate-types` | Generate TS types from content-types |
| `strapi routes:list` | List all registered routes |
| `strapi policies:list` | List all registered policies |
| `strapi middlewares:list` | List all registered middlewares |
| `strapi content-types:list` | List all content-types |
| `strapi hooks:list` | List all hooks |
| `strapi services:list` | List all services |
| `strapi controllers:list` | List all controllers |
| `strapi admin:create-user` | Create admin user (interactive) |
| `strapi admin:reset-user-password` | Reset admin password |
| `strapi configuration:dump -f dump.json` | Export config to file |
| `strapi configuration:restore -f dump.json` | Restore config from file |
| `strapi transfer` | Transfer data between Strapi instances |
| `strapi import` | Import data from file |
| `strapi export` | Export data to file |
| `strapi version` | Show Strapi version |
| `strapi telemetry:disable` | Disable telemetry |

Flags: `--watch-admin` (rebuild admin on changes), `--browser=false` (no auto-open), `--bundler=webpack|vite`.

## Deployment Checklist

1. **Build admin**: `NODE_ENV=production strapi build`
2. **Start**: `NODE_ENV=production strapi start`
3. **Database**: use PostgreSQL/MySQL in production (not SQLite)
4. **Environment variables**: set all secrets (APP_KEYS, JWT_SECRET, API_TOKEN_SALT, etc.)
5. **Media**: configure S3/Cloudinary provider (not local uploads for multi-instance)
6. **Proxy**: configure `url` in server config, enable `proxy.koa: true`
7. **Admin path**: optionally change from `/admin` for security
8. **CORS**: configure allowed origins in middleware config

### Minimum Server Requirements

- Node.js: v18 or v20
- npm >= 6, yarn supported
- Typical: 1 CPU, 1GB RAM minimum (2GB+ recommended)

## v4 to v5 Migration

### Key Breaking Changes

| Area | v4 | v5 |
|------|----|----|
| Document identifier | `id` (integer) | `documentId` (24-char string) |
| API layer | Entity Service API | Document Service API |
| Response format | `data.attributes.title` | `data.title` (flattened) |
| Content API | REST + custom | REST + GraphQL (same patterns) |
| Factories import | `const { factories } = require('@strapi/strapi')` | `import { factories } from '@strapi/strapi'` |
| Default project | JavaScript | TypeScript |

### Migration Steps

1. **Upgrade dependencies**: update all `@strapi/*` packages to v5
2. **Run codemods**: Strapi provides automated codemods for common changes
3. **Update Entity Service → Document Service**: replace `strapi.entityService` with `strapi.documents()`
4. **Update response handling**: remove `.attributes` nesting
5. **Update queries**: `id` → `documentId` for content operations
6. **Update relations**: use new connect/disconnect/set syntax
7. **Test thoroughly**: all custom controllers, services, lifecycles

### Resources

- Migration guide: docs.strapi.io/cms/migration/v4-to-v5/step-by-step
- Breaking changes: docs.strapi.io/cms/migration/v4-to-v5/breaking-changes
- v4 support until April 2026

## API Tokens

Types:
- **Read-only**: GET requests only
- **Full access**: all CRUD operations
- **Custom**: granular per content-type and action

Created in admin: Settings > API Tokens. Set expiration (7/30/90 days or unlimited).

Usage: `Authorization: Bearer <token>` header.
Token salt configured in `config/admin.ts` → `apiToken.salt`.
