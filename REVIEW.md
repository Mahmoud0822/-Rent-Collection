# Current Implementation Review

This review reflects the current files in this repository. It replaces older findings that referenced routes and server actions not present in the current implementation. This is a code review, not proof that every behavior has passed end-to-end or concurrency tests.

## Not a confirmed defect in the current code

- **Collections report organization scope:** `app/api/reports/collections/route.ts` authenticates the actor, allows manager/staff roles, and filters by the organization derived from that actor. It does not accept a caller-supplied `orgId`.
- **Late-fee authorization, scope, and duplicate-charge findings:** no late-fee API handler exists in the current `app/api` tree. Treat late fees as unimplemented functionality, not bugs in a handler that is absent.
- **Malaysia report boundaries:** the report route creates explicit UTC instants from `+08:00` calendar-month boundaries and groups by `Asia/Kuala_Lumpur`. The dashboard also groups by Malaysia time and fills its displayed six-month range from the result map.
- **Webhook amount mismatch:** `app/api/webhooks/gateway/route.ts` requires a digit-only `paid_amount` equal to the stored bill amount before settlement.
- **Duplicate delivery of the same gateway bill:** the webhook locks the bill row, checks its state inside a transaction, and the schema has a unique gateway-bill reference on payments. These are appropriate idempotency safeguards, but concurrent retry behavior has not been stress-tested.

## Confirmed issue

1. **A failed manual-payment request can delete a pre-existing slip.** In `app/api/leases/[leaseId]/payments/route.ts`, `slipPath` is taken from the request body, then the catch block removes that path after any later error. A manager or staff member can submit an existing path in their organization folder with an invalid payment request and cause the server-side storage client to delete that file. Cleanup should be limited to a path the current request actually uploaded.

## Potential risks that need validation

1. **Separate pending gateway bills can represent the same outstanding balance.** `app/api/leases/[leaseId]/gateway-bills/route.ts` computes the due amount and creates a bill without reserving that balance. Two bills may be created before either callback settles. Settlement locks the lease, but does not recalculate the remaining due amount; a second paid bill could therefore create an overpayment that remains unapplied.
2. **Webhook behavior under simultaneous callbacks needs an executable test.** Row locking and the unique reference are safeguards, but the observed checks did not send simultaneous callbacks against a pending bill.
3. **Missing webhook secret behavior needs a fail-closed check.** The webhook currently falls back to an empty string when `GATEWAY_X_SIGNATURE_KEY` is unset. Verify configuration failure is rejected rather than accepting signatures calculated with an empty key.

## Verification recorded in this review

Observed in the related `assiment` workspace running the same implementation: production build, TypeScript check, Prisma schema validation, billing-helper smoke checks, authenticated manager/tenant dashboard rendering, role checks on reports and lease/payment APIs, and rejection of an unsigned webhook.

Not exercised: slip upload/deletion behavior, payment approval/rejection/void flows, overlapping lease rejection, signed success/failure callbacks, duplicate or concurrent callbacks, separate gateway bills for the same balance, direct Supabase Data API RLS behavior, and an automated test suite. Do not describe these as passing tests.