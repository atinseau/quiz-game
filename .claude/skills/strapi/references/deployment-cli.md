# Strapi v5 CLI, Deployment & Migration

## CLI Commands

### Development & Build

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `strapi develop` / `strapi dev` | Dev server with auto-reload & HMR | `--bundler vite\|webpack`, `--open`, `--no-watch-admin`, `--no-build-admin`, `--polling`, `--debug`, `--silent` |
| `strapi start` | Production server (no auto-reload) | — |
| `strapi build` | Build admin panel | `-d\|--debug`, `--minify`, `--sourcemaps`, `--stats`, `--silent` |

**Never use `strapi develop` in production.**

### Code Generation

`strapi generate` — interactive generator for:

| Generator | Creates | Location |
|-----------|---------|----------|
| api | controller + service + routes | `src/api/[name]/` |
| content-type | schema.json (+ optional API files) | `src/api/[name]/content-types/` |
| controller | controller file | `src/api/[name]/controllers/` |
| service | service file | `src/api/[name]/services/` |
| policy | policy file | `src/policies/` or `src/api/[name]/policies/` |
| middleware | middleware file | `src/middlewares/` or `src/api/[name]/middlewares/` |
| migration | timestamped migration | `database/migrations/` |

Auto-detects TS/JS. Names must be kebab-case, singular != plural.

Content-type generator attribute types: string, text, richtext, email, password, integer, biginteger, float, decimal, date, time, datetime, timestamp, boolean, json, enumeration, media.

Content-type destination choices: New API, Existing API, Existing plugin, Root (policies/middlewares only).

Content-type kinds: Collection Type (multiple entries) or Single Type (one entry).

### TypeScript

```bash
strapi ts:generate-types              # Generate types from schemas
strapi ts:generate-types --debug      # Verbose output with schema table
strapi ts:generate-types -s           # Silent mode
strapi ts:generate-types -o <path>    # Custom output dir (not recommended for normal use)
```

Auto-generate on restart: `config/typescript.ts` → `autogenerate: true`.

### Introspection Commands

| Command | Description |
|---------|-------------|
| `strapi routes:list` | All registered routes with method/path/handler |
| `strapi policies:list` | All registered policies |
| `strapi middlewares:list` | All registered middlewares |
| `strapi content-types:list` | All content-types |
| `strapi controllers:list` | All controllers |
| `strapi services:list` | All services |
| `strapi hooks:list` | All hooks |

### Admin User Management

```bash
strapi admin:create-user --firstname=John --lastname=Doe --email=john@example.com --password=Secret123
strapi admin:reset-user-password --email=john@example.com --password=NewPass123
```

Options: `-f/--firstname`, `-l/--lastname`, `-e/--email`, `-p/--password`. Interactive if no options passed.

### Data Export / Import / Transfer

**Export:**
```bash
strapi export                                    # Default: encrypted compressed .tar.gz.enc
strapi export -f myData                          # Custom filename (no extension)
strapi export --no-encrypt                       # No encryption
strapi export --no-encrypt --no-compress         # Readable .tar for inspection
strapi export --only content                     # Only content data
strapi export --exclude files                    # Exclude uploaded media
strapi export -k my-encryption-key               # Specify encryption key inline
```

Data types: `content`, `files`, `config`. Comma-separated with `--only` or `--exclude`.

Auto-named: `export_YYYYMMDDHHMMSS`. Archive contains: configuration/, entities/, links/, schemas/ folders with JSONL files.

**Import:**
```bash
strapi import -f myData.tar.gz.enc -k my-key     # Import with decryption key
strapi import -f dump.tar                         # Plain archive
```

Detects compression (.gz) and encryption (.enc) from filename.

**Transfer** (between Strapi instances):
```bash
# Push local → remote
strapi transfer --to https://remote.com/admin --to-token <transfer-token>

# Pull remote → local
strapi transfer --from https://remote.com/admin --from-token <transfer-token>

# With data type filters
strapi transfer --to https://remote.com/admin --to-token <token> --only content,config
strapi transfer --exclude files

# Non-interactive
strapi transfer --force
```

Transfer tokens: created in admin Settings > Transfer Tokens. **Destination must run `strapi start`** (not develop).

Either `--to` or `--from` required (not both).

### Configuration Dump/Restore

```bash
strapi configuration:dump -f dump.json             # Export to file
strapi configuration:dump -f dump.json --pretty     # Pretty JSON
strapi configuration:dump > dump.json               # Stdout redirect

strapi configuration:restore -f dump.json           # Restore (default: replace)
strapi configuration:restore -f dump.json -s merge  # Merge strategy
cat dump.json | strapi configuration:restore        # Stdin
```

Strategies: `replace` (create missing + overwrite existing), `merge` (create missing + merge), `keep` (create missing only).

**Caution**: dump includes third-party credentials. Don't commit to VCS without encryption.

### Console & Debug

```bash
strapi console   # REPL with full Strapi API access
```

Available in REPL: `strapi.documents()`, `strapi.db.query()`, `strapi.services`, `strapi.controllers`, `strapi.contentTypes`, `strapi.plugins`, `strapi.config`. Exit with Ctrl-C twice.

```bash
strapi report --all                    # Full debug info for bug reports
strapi report --uuid --dependencies    # Selective
```

### OpenAPI

```bash
strapi openapi generate                          # Generate spec (default: ./openapi-spec.json)
strapi openapi generate --output ./docs/spec.json  # Custom path
```

### Other Commands

| Command | Description |
|---------|-------------|
| `strapi version` | Show version |
| `strapi telemetry:disable` / `telemetry:enable` | Toggle telemetry |
| `strapi templates:generate <path>` | Create reusable project template |
| `strapi login` / `strapi logout` | Strapi Cloud auth |
| `strapi deploy` | Deploy to Strapi Cloud |

### CLI Tips

- Local install recommended: `yarn strapi <cmd>` or `npx strapi <cmd>`
- npm options: `npm run strapi <cmd> -- --<option>`
- Interactive commands don't show prompts with npm — use yarn
- v4 commands removed: `strapi install`, `strapi uninstall`, `strapi new`, `strapi watch-admin`

## Deployment Checklist

1. **Build admin**: `NODE_ENV=production strapi build`
2. **Start**: `NODE_ENV=production strapi start`
3. **Database**: PostgreSQL or MySQL (NOT SQLite in production)
4. **Secrets**: set all env vars:
   - `APP_KEYS` (session signing)
   - `JWT_SECRET` (Users & Permissions JWT)
   - `ADMIN_JWT_SECRET` (admin panel JWT)
   - `API_TOKEN_SALT` (API tokens)
   - `TRANSFER_TOKEN_SALT` (data transfer)
5. **Media**: S3/Cloudinary provider (local uploads don't scale multi-instance)
6. **Public URL**: set `url` in `config/server.ts` + `proxy.koa: true` behind reverse proxy
7. **Admin path**: optionally change from `/admin`
8. **CORS**: configure allowed origins in `strapi::cors` middleware
9. **CSP**: add media provider domains to `strapi::security` CSP directives
10. **Upload limits**: match `strapi::body` formidable config + server requestTimeout + nginx client_max_body_size

### Server Requirements

- Node.js v18 or v20
- npm >= 6 (yarn/bun supported)
- Recommended: 2+ CPU cores, 2+ GB RAM

## v4 → v5 Migration

### Key Breaking Changes

| Area | v4 | v5 |
|------|----|----|
| Document ID | `id` (integer) | `documentId` (24-char string) |
| API layer | Entity Service (`strapi.entityService`) | Document Service (`strapi.documents()`) |
| Response format | `data.attributes.title` | `data.title` (flattened) |
| Default project | JavaScript | TypeScript |
| Factories import | `require('@strapi/strapi').factories` | `import { factories } from '@strapi/strapi'` |
| GraphQL IDs | `id` available | `documentId` only |

### Migration Steps

1. Update all `@strapi/*` packages to v5
2. Run Strapi's automated codemods for common patterns
3. Replace `strapi.entityService` → `strapi.documents()` with new signatures
4. Remove `.attributes` nesting from response handling
5. Replace `id` with `documentId` for content operations
6. Update relation mutations to connect/disconnect/set syntax
7. Test all custom controllers, services, lifecycle hooks thoroughly

### Resources

- Step-by-step: `docs.strapi.io/cms/migration/v4-to-v5/step-by-step`
- Breaking changes: `docs.strapi.io/cms/migration/v4-to-v5/breaking-changes`
- v4 supported until April 2026

## API Tokens

| Type | Access |
|------|--------|
| Read-only | GET requests only |
| Full access | All CRUD operations |
| Custom | Granular per content-type + action |

Create in admin: Settings > API Tokens. Expiration: 7/30/90 days or unlimited.

Usage: `Authorization: Bearer <token>` header. Salt: `API_TOKEN_SALT` env var.
