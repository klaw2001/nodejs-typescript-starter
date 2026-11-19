# Node.js TypeScript Starter

A production-minded REST API starter: **Express 5 + TypeScript + Prisma 7 (PostgreSQL)** with authentication,
role based permissions, an audit log, notifications and signed file downloads already wired up.

It was extracted from a real-world application, so the patterns here (instant session revocation, account
lockout, permission matrix, audit trail) are the ones that survived production use.

## What's included

| Area | Details |
| --- | --- |
| Auth | Login by e-mail or mobile, short-lived access token + refresh token, logout everywhere, forced password change, OTP password reset, lockout after repeated failures, per-IP+account rate limits |
| Users | CRUD, temporary passwords, deactivate / reactivate, force logout, admin password reset, optional access expiry |
| Permissions | `module x role` read / write matrix (`readAccessMiddleware` / `writeAccessMiddleware`), editable at runtime through `/api/role` |
| Audit log | `audit(req, action, entity, id, meta)` records who did what, with IP and user agent; browse via `/api/audit` |
| Notifications | In-app notifications with optional e-mail (`notifyUsers`), mark-read API |
| Files | Authenticated upload with content sniffing (images / PDF), expiring HMAC-signed download links |
| Infra | Winston logging, Helmet, CORS allow-list, graceful shutdown, `/health` and `/health/ready`, example cron job |
| Tooling | ESLint 10 (flat config) + Prettier, Jest + Supertest, Dockerfile, docker-compose, GitHub Actions CI |

## Quick start

Requires Node.js 22.12+ (see `.nvmrc`) and PostgreSQL 14+ (or Docker).

```bash
npm install                    # also runs `prisma generate`
cp .env.example .env           # then replace every change-me value (see "Secrets" below)
docker compose up -d db        # PostgreSQL on :5432 (skip if you already have one; match DATABASE_URL)
npm run db:deploy              # apply migrations
npm run db:seed                # modules, roles, permissions and the super admin
npm run dev                    # http://localhost:8000
```

Check it works:

```bash
curl http://localhost:8000/health/ready
curl -X POST http://localhost:8000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"admin@example.com","password":"<SEED_ADMIN_PASSWORD>"}'
```

The seeded super admin (`SEED_ADMIN_EMAIL`, default `admin@example.com`) must change the password on first
login: every endpoint except `/api/auth/change-password`, `/api/auth/logout` and `/api/master/user-profile`
answers `PASSWORD_CHANGE_REQUIRED` until then. `npm run db:seed:demo` adds a permission-less demo user
(`demo@example.com`, development only).

### Secrets

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use 32 bytes for `JWT_*_SECRET`, `ENCRYPT_KEY`, `FILE_URL_SECRET` and 16 bytes (32 hex chars) for `ENCRYPT_IV`.
The seed refuses to run while `SEED_ADMIN_PASSWORD` still starts with `change-me`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Watch mode with tsx |
| `npm run build` / `npm start` | Compile to `dist/` and run it (`module-alias` resolves `@/` and `@core/`) |
| `npm run typecheck` / `lint` / `lint:fix` | Static checks |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Jest unit + API guard tests (no database needed) |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations in production / CI |
| `npm run db:seed` / `db:seed:demo` | Seed reference data (idempotent) |
| `npm run db:studio` | Prisma Studio |

Prisma 7 notes: the connection string lives in `prisma.config.ts` (it falls back to a placeholder so
`npm install` works before `.env` exists), the client is generated into `src/generated/prisma` (CommonJS, git-ignored)
and uses the `@prisma/adapter-pg` driver adapter. `migrate dev` does not seed or generate automatically.

## Project layout

```
prisma/                 schema.prisma, migrations, seed.ts
src/
  server.ts             entry: loads env, starts the HTTP server and jobs, graceful shutdown
  app.ts                express app: helmet, CORS, body parsing, uploads, health, error handler
  @core/                framework code you rarely edit
    enum/               status codes, error codes, module keys, role keys, upload types
    helpers/            prisma client, query helpers, validation, CSV/XLSX export, mail, router wrapper
    securityService/    scrypt password hashing, AES, JWT
    services/           logging, responses, file storage, notifications, audit, SMS
  app/                  your application code
    router.ts           route table with auth / permission middlewares
    middlewares/        auth, read/write access, rate limits
    modules/<name>/     <name>Controller.ts + <name>Routes.ts (+ <name>Service.ts when needed)
    jobs/               cron jobs (example: cleanupJob.ts)
test/                   Jest tests; setup.ts provides env defaults so tests run without .env
types/                  ambient types (process.env, req.userInfo)
```

Path aliases: `@/` is `src/`, `@core/` is `src/@core/`.

## Conventions

- **Tables** are snake_case with prefixed columns (`user_email`, `role_name`) plus
  `_status / _archived / _deleted / _created_by / _updated_by / _created_at / _updated_at`. Soft delete by setting `_deleted`.
- **Responses** always go through `sendResponse(res, status, data, message, httpCode)` and look like
  `{ status, data, message, apiVersion }`. Error responses that the frontend should react to carry `data.code` (`@core/enum/errorCodes`).
- **Lists** accept `search, status, archived, deleted, limit, offset` and return `{ total, rows }`
  (`whereIfFlags`, `likeIfValue`, `applyIfLimit`, `applyIfOffset` in `@core/helpers/prismaHelpers`).
- **Create + update** share one `POST /save` endpoint: send the id to update, omit it to create.
- **Controllers** wrap their body in `try / catch`, log with `logger.consoleErrorLog` and return a `DB_ERROR` response.
  Routes are registered with `route()` from `@core/helpers/router`, which forwards async errors to the express error handler.
- VS Code snippets for controllers and logging live in `.vscode/rv_snippets.code-snippets`.

## Adding a feature module

1. Add a model to `prisma/schema.prisma`, then `npm run db:migrate -- --name add_widgets`.
2. Add a permission key: `src/@core/enum/moduleKeys.ts` (`WIDGET: 'widget'`) and `modules` in `prisma/seed.ts`.
   Re-run `npm run db:seed`: the super admin is granted new modules automatically. Grant other roles access with
   `POST /api/role/save` (`module_role_map`) or, for new installs, the `permissions` map in `prisma/seed.ts`.
3. Create `src/app/modules/widget/widgetController.ts` and `widgetRoutes.ts` (copy `user` or `role` as a template).
4. Register it in `src/app/router.ts`:

   ```ts
   router.use('/widget', readAccessMiddleware(moduleKeys.WIDGET), widgetRoutes)
   ```

   and guard mutating routes with `writeAccessMiddleware(moduleKeys.WIDGET)` inside the module.
5. Call `audit(req, 'create', 'widget', id)` for changes worth tracking.

## Access model

- **Authentication**: login with e-mail or mobile number. Access token (default 15 min) plus a refresh token that ends
  the session after `JWT_REFRESH_TOKEN_EXPIRE` (default 12 h). `LOGIN_MAX_ATTEMPTS` failed logins lock the account for
  `LOGIN_LOCK_MINUTES`. Password reset by OTP (SMS + e-mail; the SMS gateway is a stub in `SmsService.ts`,
  `SMS_PROVIDER=console` logs the OTP, and mail is logged until `MAIL_HOST` is set).
- **Instant revocation**: every token carries `user_token_version`. Deactivating a user, "force logout", password changes,
  role changes and logout bump it, so existing tokens fail on the next request. `user_access_expires_at` ends access
  automatically for temporary accounts.
- **Permissions**: `sys_module` x `roles` matrix (`module_role_map`) with read / write per module. Write implies read.

| Role | Default permissions |
| --- | --- |
| Super Admin | everything (new modules are granted automatically by the seed) |
| Admin | users (read + write), roles (read), audit (read) |
| User | none |

## API overview

All routes are under `/api` and use `Authorization: Bearer <access token>` unless noted.

| Prefix | Who | Endpoints |
| --- | --- | --- |
| `/auth` | public | `POST login`, `access-token`, `forgot-password`, `verify-otp`, `reset-password`; `POST change-password`, `logout` (logged in) |
| `/master` | any user | `GET user-profile` (profile + permission map), `users`, `roles`, `modules` (dropdown data) |
| `/notification` | any user | `GET all`, `POST read` |
| `/file` | signed / any user | `GET /:id?expires&signature` (public, signed), `POST upload` (multipart `file`, optional `type=image\|document`) |
| `/user` | `user` permission | `GET all`, `GET single/:id`, `POST save`, `deactivate`, `reactivate`, `force-logout`, `reset-password` |
| `/role` | `role` permission | `GET all`, `GET single/:id`, `POST save` (with `module_role_map`) |
| `/audit` | `audit` permission | `GET all` (filters: `entity`, `entity_id`, `user_id`, `action`, `from`, `to`) |
| `/health`, `/health/ready` | public | liveness, readiness (database ping), outside `/api` |

## Docker

```bash
docker compose up -d --build                              # PostgreSQL + API on :8000
docker compose run --rm api npx prisma migrate deploy     # apply migrations
```

The runtime image contains production dependencies and compiled output only, runs as a non-root user and has a
health check. Run `npm run db:seed` from your machine against the published database port to create the first admin.
Uploads and logs are kept in named volumes.

## Production checklist

1. `npm ci && npm run build && npm run db:deploy && npm run db:seed`, then run `npm start` under a process manager
   (systemd, PM2) with `MODE=production`, behind a reverse proxy with HTTPS (`trust proxy` is enabled).
2. Set real values for every secret, `CORS_ORIGINS`, `API_BASEURL` and `FRONTEND_BASEURL`; configure SMTP (`MAIL_*`)
   and plug an SMS gateway into `src/@core/services/SmsService.ts`.
3. Back up PostgreSQL and the `STORAGE_PATH` folder (or replace the local driver in `StorageService.ts` with S3 and friends).
4. The in-memory rate limiter is per process; use a shared store (e.g. Redis) when running several instances.

## License

MIT, see [LICENSE](LICENSE).
