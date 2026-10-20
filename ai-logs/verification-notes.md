# Verification Notes — Rent Collection

**Purpose:** Record test results that were actually observed. Do not mark checks as passed until they have been run.

## Environment

- Date/time:
- Commit or branch:
- Node.js version:
- Package manager/version:
- Database/Supabase environment:
- Commands run:

## Billing and money

- [ ] Ringgit string parsing, including malformed and excessive-precision inputs
- [ ] Amounts are stored and calculated as integer sen
- [ ] Month-end anchors (for example, a lease beginning on the 31st)
- [ ] Leap-year February
- [ ] Final partial billing period and rounding behavior
- [ ] Invoice status at due-date boundaries
- Observed result / evidence:

## Authorization and organization scope

- [ ] Unauthenticated requests are rejected
- [ ] Tenant, staff, and manager permissions are checked
- [ ] Caller cannot access another organization's lease/payment by changing an ID
- [ ] Client-supplied organization ID is not trusted as authorization
- [ ] Direct Data API access follows the intended RLS and grants
- Observed result / evidence:

## Payments and allocation

- [ ] Invalid, zero, and excessive payment amounts are rejected
- [ ] Staff-submitted payments follow the intended approval flow
- [ ] Manager approval is scoped to the manager's organization
- [ ] Allocation order is deterministic
- [ ] Pending verification payments are handled according to the balance policy
- [ ] Concurrent payment submissions do not over-collect
- [ ] Voiding reverses only the relevant payment's allocations
- Observed result / evidence:

## Gateway webhook

- [ ] Invalid signature is rejected
- [ ] Missing/misconfigured secret fails safely
- [ ] Amount mismatch is rejected
- [ ] Duplicate callback does not create duplicate payment
- [ ] Concurrent callbacks are safe
- [ ] Out-of-order failure callback does not downgrade an already-paid bill
- [ ] Gateway `paid_at` is handled as an offset-aware timestamp
- Observed result / evidence:

## Timezone and reports

- [ ] Malaysian month boundaries are correct
- [ ] Tests are run under more than one runtime timezone
- [ ] Empty months are represented according to reporting requirements
- [ ] Dashboard and report totals agree for the same date range
- Observed result / evidence:

## Storage and privacy

- [ ] Payment-slip size and MIME type are validated
- [ ] Storage paths are scoped to the organization
- [ ] Private bucket access rules are tested
- [ ] Logs avoid secrets and unnecessary sensitive payloads
- Observed result / evidence:

## Summary

- Tests passed:
- Tests failed:
- Not tested:
- Known limitations:
- Follow-up work:

## Observed checks (2026-10-20)

These checks were run in the `assiment` workspace against the same implementation; this note is a concise record, not a substitute for command logs or an exported conversation transcript.

- `npm run build` — passed after the dashboard month alias correction.
- `npm run lint` (`tsc --noEmit`) — passed.
- `npx prisma validate` — passed with the local environment variables loaded.
- Local Supabase — API, database, Studio, and Mailpit ports were listening; seeded records were present. A read-only summary reported 2 organizations, 5 leases, 39 invoices, and 3 approved payments (2 cash, 1 bank transfer).
- Billing helper smoke check — passed for Jan 31 to leap-year February anchoring, half-up proration (5,173 sen), parsing RM 1,234.56 to 123,456 sen, and the MYT overdue boundary at 16:00 UTC.
- Authenticated requests — manager and staff report requests returned 200; tenant report request returned 403. Manager and tenant dashboards rendered. Invalid lease input reached manager validation (400), while staff and tenant lease creation attempts returned 403. Tenant payment submission returned 403. An unsigned webhook returned 401.

### Not exercised in these checks

Bank-slip upload and retrieval; payment approval, rejection, and void flows; lease-overlap rejection; signed successful or failed gateway settlement; duplicate or simultaneous callbacks; out-of-order callbacks; direct Supabase Data API RLS behavior; and automated unit/integration test suites. These remain unverified here and must not be represented as passing tests.