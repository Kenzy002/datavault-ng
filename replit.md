# DataVault Nigeria

DataVault helps Nigerians manage airtime, mobile data, electricity, cable TV, digital subscriptions, and a test-mode NGN wallet from one responsive app.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/datavault` — responsive customer app, Clerk sign-in, and administrator screens
- `artifacts/api-server/src/routes` — authenticated customer and administrator API
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks
- `lib/db/src/schema/datavault.ts` — DataVault PostgreSQL schema
- `artifacts/api-server/src/lib/catalog.ts` — seed test-mode service plans

## Architecture decisions

- Clerk owns sign-in; the API maps Clerk user IDs to local profiles and checks admin roles in PostgreSQL.
- Store NGN values as integer kobo to avoid floating-point money calculations.
- Wallet funding and all bill purchases are simulated and must remain visibly marked as test mode until real providers are configured.
- `DATAVAULT_ADMIN_EMAILS` is a comma-separated bootstrap allowlist for the first admin account(s). Set it before the matching account signs in; an administrator can manage later roles in the admin screen.

## Product

Customers can create accounts, view their wallet and spending, simulate airtime/data and bill purchases, review transactions, manage their profile, and read in-app notifications. Administrators can review platform activity and manage customer status and roles.

## User preferences

- Keep the UI responsive on mobile and desktop.
- Do not connect payment or VTU providers until the user supplies the credentials.

## Gotchas

- Development and production Clerk accounts are separate; configure an admin email allowlist in each environment where an admin must sign in.
- Service plans are inserted into the database idempotently when the catalog or a purchase is first requested.
- Regenerate API hooks and Zod schemas after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
