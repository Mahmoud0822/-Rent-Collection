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
