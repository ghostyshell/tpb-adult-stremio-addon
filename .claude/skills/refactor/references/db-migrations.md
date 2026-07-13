# Database Migrations During a Refactor

Refactors often touch the data layer — adding columns, renaming fields, splitting tables. This file covers how to sequence schema changes without breaking the behavior-preservation contract.

## The Rule

**Schema changes are refactors themselves** — they deserve their own phased approach, parallel to the code refactor, not folded into it.

Never combine:

- A Phase 3 function move + a column rename in the same PR.
- A Phase 2 hook extraction + a table split in the same PR.

Code refactor and schema refactor must be independently reversible.

## Expand → Migrate → Contract

The standard pattern for zero-downtime schema changes:

1. **Expand** — add the new column / table / index. Old code keeps working.
2. **Migrate** — backfill data, dual-write from code, verify.
3. **Contract** — remove the old column / table. Only after every consumer reads/writes the new shape.

Each step is its own PR and its own deploy.

## Typical Schema Changes During a Refactor

### Adding a Column

Safe. Do it any time. But:

- Adding a `NOT NULL` column on a populated table needs a backfill strategy. On large tables (>1M rows), make it nullable first, backfill in batches, then add the constraint.
- Adding an index: schedule it — on Postgres, use `CREATE INDEX CONCURRENTLY`.

### Renaming a Column

Never do this in a single step. Use expand-migrate-contract:

1. Add new column with the new name. Keep the old one.
2. Update all writes to write to both columns. Update all reads to prefer new, fall back to old.
3. Backfill old → new.
4. Drop old column.

If this intersects Phase 3 (API module split), sequence it:

- **Before Phase 3:** steps 1–2 (expand + start dual-writing).
- **Phase 3:** split the API module — each domain module now dual-writes.
- **After Phase 4:** finish migration (backfill, drop).

### Splitting a Table

Example: `profiles` → `profiles` + `pro_settings` + `client_settings`.

- Do this **before** Phase 3 if possible. Otherwise after Phase 4.
- Don't do it during Phase 3 — the monolith split already moves the function surface; adding schema moves at the same time makes bisect useless.

### Enum / Check Constraint Changes

Adding a value to a Postgres enum: safe, but commit it as a separate migration.

Removing a value: treat like column rename — first, stop writing it; then, migrate existing rows; finally, drop it.

## Intersection with Supabase / Firebase / Prisma

### Supabase

- Generated types: regenerate after **every** schema change. Commit the regenerated file.
- RLS policies: when splitting an API module, check that the RLS policies on the underlying tables still cover the new access paths. Easy to miss.

### Firebase / Firestore

- Security rules version with the code. If Phase 4 changes access patterns (e.g., a new `byUser` query), update rules in the same PR that introduces the query — but deploy rules first, code second.

### Prisma

- `prisma migrate dev` during development; `prisma migrate deploy` in CI.
- When splitting the monolith, run `prisma generate` after each domain module is created to make sure the client is still in sync.

### Drizzle

- Migrations are SQL-first. Treat them like any other expand-migrate-contract change — separate PRs.

## Refactor-Specific Gotchas

### The "Unused" Column That Isn't

You'll grep the new domain module and see a column isn't referenced. Do NOT drop it yet — external services (analytics exports, BI tools, webhooks) may still read it directly. Audit outside the codebase before contracting.

### The Denormalized Field

Sometimes the refactor reveals a field that was denormalized "for performance" but is now stale everywhere. Resist the urge to fix this during the refactor — file a follow-up ticket. Behavior preservation means keeping the stale data until a proper migration.

### The Cache Layer

Redis / Memcached / IndexedDB caches that store serialized DB rows will break on schema changes. After any shape change:

- Bump the cache key version (`user:v2:${id}` instead of `user:${id}`).
- Or flush the relevant namespace on deploy.

## When to Pause the Code Refactor for a Schema Fix

If you discover during refactoring that the schema has a problem blocking further cleanup (e.g., a polymorphic column used inconsistently):

1. Finish the current sub-task or revert it.
2. Tag a checkpoint.
3. Do the schema migration as its own mini-project with its own expand-migrate-contract.
4. Resume the code refactor.

Do NOT try to fix the schema inline with a Phase 2 hook extraction. That's how 2-week PRs are born.

## CI / Deploy Integration

- Run schema migrations **before** code deploy (Expand step).
- Run Contract step (drops) in a **separate** deploy after verifying the app is fully on the new shape.
- Keep migration files in-repo and replayable. Never let them diverge from what's in the DB — audit tool of choice: your ORM's introspection command.
