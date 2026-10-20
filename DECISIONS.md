# Decisions

## 1. Duplicate paid callback, 5 ms apart

The webhook locks the matching `gateway_bills` row before reading its current state. The first request changes a pending or failed bill to paid, creates the online payment, and allocates it in one database transaction. The second waits for that row lock, then reads `paid` and returns success without creating another payment. The unique `(gateway_bill_id, org_id)` constraint is a second database guard. See [route.ts](app/api/webhooks/gateway/route.ts#L18) and [schema.prisma](prisma/schema.prisma#L155).

## 2. Two staff payments for RM 800 and RM 700 with RM 1,000 remaining

The first request locks the lease row before reading balance and pending reservations. If RM 800 is recorded first, it becomes pending verification and reserves RM 800. The second request then sees only RM 200 available and returns 422. The lock serializes the cap calculation; `leaseBalance` counts allocations and the pending aggregate reserves submitted staff payments. See [route.ts](app/api/leases/%5BleaseId%5D/payments/route.ts#L22) and [allocation.ts](lib/allocation.ts#L6).

## 3. “Today” and date/instant conversions

`invoiceStatus` adds eight hours to the supplied instant and then reads its ISO calendar date, so server and viewer timezones cannot change overdue status ([billing.ts](lib/billing.ts#L70)). Month calculations for dashboards and gateway bills use the same fixed offset ([page.tsx](app/page.tsx#L10), [route.ts](app/api/leases/%5BleaseId%5D/gateway-bills/route.ts#L14)). Date-only lease fields are validated and stored as UTC-midnight `date` values; this preserves the calendar date without treating it as an instant ([billing.ts](lib/billing.ts#L21), [route.ts](app/api/leases/route.ts#L19)). Payment instants must include an ISO offset; the UI treats entered wall-clock values as `+08:00` ([payments route](app/api/leases/%5BleaseId%5D/payments/route.ts#L11), [lease-actions.tsx](components/lease-actions.tsx#L15)). Reports bucket and filter timestamps in `Asia/Kuala_Lumpur` ([collections route](app/api/reports/collections/route.ts#L10)). Display formatting uses an explicit MYT timezone ([lease page](app/leases/%5BleaseId%5D/page.tsx#L19)).

## 4. Queries not subject to RLS

All Prisma queries run as the database owner and bypass RLS. Each API handler first verifies the Supabase user, then gets their role and organization from `memberships` or `tenants.user_id`, and scopes every requested record to that organization or tenant. The server-only secret key is used only for Storage validation, deletion, signed slip URLs, and Auth seeding; upload endpoints still require a staff/manager actor and an organization-prefixed path. Seed operations bypass RLS as setup work. The Data API itself is restricted by table grants, RLS policies, and the private Storage bucket in the migration ([migration](supabase/migrations/202610200001_init.sql#L85)).

## 5. Voiding with unapplied online money present

Voiding deletes only that payment's allocations, sets that payment's unapplied amount to zero, and leaves every other payment's allocations and unapplied balance unchanged. It does not silently redistribute the other online payment's unapplied balance to newly reopened invoices. This preserves the original allocation history and honors the rule that voiding one payment does not change another payment's allocations. See [void route](app/api/payments/%5BpaymentId%5D/void/route.ts#L14) and [allocation](lib/allocation.ts#L27). A manager can see the reopened invoice balance and record or approve a subsequent payment.

## 6. Two AI mistakes and how they were caught

The first draft put several Prisma schema declarations on one line. `npx prisma validate` rejected the schema; the correction is documented in [session notes, lines 5–7](ai-logs/session-notes.md#L5). The first seed draft also used a default import from `@next/env`; `npm run seed` failed because the TypeScript runner exposed the CommonJS module differently. The runtime error showed the mismatch, so I changed the seed to a named import and reran it successfully; see [session notes, lines 9–11](ai-logs/session-notes.md#L9). Those notes are not the required full transcript; export and include the full Codex conversation before submission.
