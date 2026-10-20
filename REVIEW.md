# Code review

## Findings (highest severity first)

1. **[P1] Anyone can read another organization's collection totals** — `app/(staff)/dashboard/actions.ts:5-13`. The server action accepts `orgId` from its caller and sends it directly to Prisma, which connects as the database owner and bypasses RLS. A tenant or staff user can invoke the action with another organization's UUID and retrieve its report. Authenticate the caller inside the action, derive the organization from `memberships`, enforce the manager/staff role, and ignore any caller-supplied organization ID.

2. **[P1] The late-fee route trusts an editable role claim** — `app/api/leases/[leaseId]/late-fees/route.ts:11-14`. A user who can change Supabase `user_metadata` to `role: manager` passes this check. Roles must come from `memberships`, and authorization must be checked server-side for every request. Load the caller's membership and require its manager role.

3. **[P1] The late-fee route can operate on a lease in another organization** — `app/api/leases/[leaseId]/late-fees/route.ts:16-21`. The lookup uses only the globally supplied lease ID. A manager from one organization can create invoices on another organization's lease. Scope the lease lookup by the authenticated manager's `org_id`; return 404 when the scoped lookup finds nothing.

4. **[P1] A signed paid callback can settle a bill for the wrong amount** — `app/api/webhooks/gateway/route.ts:27-36`. It copies `fields.paid_amount` into a new payment without checking it against `bill.amount_sen`. A validly signed callback with a smaller or larger value marks the entire bill paid and allocates the wrong amount. Parse and validate the integer, require exact equality with the bill amount, and return 422 without changing either record on mismatch.

5. **[P1] Concurrent or retried callbacks can race the bill transition** — `app/api/webhooks/gateway/route.ts:21-39`. Two requests can both read `pending`, then both enter the transaction and attempt to create a payment. Without a row lock or an atomic conditional transition, one retry can produce a uniqueness error/500, or duplicate payments if the schema lacks a unique bill constraint. Lock the bill row and check its status inside the transaction; enforce a unique `payments.gateway_bill_id` constraint so the state transition and payment creation happen once.

6. **[P1] The late-fee invoice uses an unsupported kind** — `app/api/leases/[leaseId]/late-fees/route.ts:32-43` (especially line 37). The required `InvoiceKind` is only `deposit | rent`; this `late_fee` value does not type-check against the contract and cannot be stored in the required enum. Represent a fee using a separately specified charge model, or extend the agreed schema, migration, response types, and tests consistently before inserting it.

7. **[P1] Repeated late-fee requests create duplicate charges** — `app/api/leases/[leaseId]/late-fees/route.ts:26-45`. Every invocation creates another fee for each qualifying rent invoice. A client retry or two concurrent manager requests can charge the same invoice more than once. Store an idempotent reference to the source invoice and enforce uniqueness for one late fee per invoice (or use an atomic insert-on-conflict).

8. **[P2] Payment reports use callback processing time instead of gateway receipt time** — `app/api/webhooks/gateway/route.ts:33-36`. The code writes `new Date()` and discards the supplied `paid_at`. A callback delayed across a month boundary is counted in the wrong collection month. Parse the signed `paid_at` value with its explicit offset and store that instant as `received_at`.

9. **[P2] Webhook logging records the full callback payload** — `app/api/webhooks/gateway/route.ts:14-18`. Logging `fields` can expose transaction identifiers and signed callback data. The brief explicitly forbids logging the whole payload. Log only a safe event label and a non-sensitive internal bill ID, and never log callback fields or signatures.

10. **[P2] The report groups and filters on UTC month boundaries, not Malaysia month boundaries** — `app/(staff)/dashboard/actions.ts:8-13`. `date_trunc('month', received_at)` uses the database session timezone, and casting `from` and `to` to `date` produces session-timezone boundaries. With the expected UTC database session, `2026-01-01 00:00 MYT` is `2025-12-31 16:00Z`, so it can be excluded or grouped as December. Bucket using `date_trunc('month', received_at AT TIME ZONE 'Asia/Kuala_Lumpur')` and filter between explicit MYT month boundaries converted to instants.

11. **[P2] Empty months disappear from the collections report** — `app/(staff)/dashboard/actions.ts:8-14`. The grouped query only returns months that have payments. The required response includes every requested month with `collectedSen: 0` when none were collected. Generate the month sequence and left-join or fill missing months in application code.

## Looks suspicious but is correct

`new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)` in the late-fee route is a valid way to obtain today's Malaysia calendar date: Malaysia is fixed at UTC+8 and does not observe daylight saving time. The subsequent seven-day subtraction is also in whole calendar days. I would still centralize this conversion in a tested date helper to avoid repeating it elsewhere.
