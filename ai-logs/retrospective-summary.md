# AI-Assisted Development — Retrospective Summary

**Project:** Rent Collection  
**Record type:** Retrospective summary, not an original Codex transcript  
**Prepared:** 2026-10-20

## 1. Scope

This note summarizes engineering topics discussed while reviewing the Rent Collection implementation. It is not a verbatim record of an AI conversation. The exact order of prompts, responses, edits, and tool calls is not reconstructed here.

## 2. Architecture and implementation areas reviewed

The project uses a Next.js App Router application with TypeScript, Supabase/Postgres, Prisma, and Supabase Auth/Storage.

Areas reviewed included:

- Billing-period calculations and invoice status.
- Monetary amount parsing and storage.
- Authentication, role checks, and organization scoping.
- Payment creation, manager approval, voiding, and allocation.
- Payment-gateway webhook verification and idempotency.
- Malaysia-local date and reporting boundaries.
- Database constraints and row-level security.
- Audit logging and payment-slip upload validation.

## 3. Engineering decisions and rationale

### 3.1 Money representation

Amounts are represented as integer sen rather than floating-point ringgit values. Input parsing uses decimal-string handling and integer arithmetic to avoid floating-point rounding errors. Values should be validated before persistence, including positive amounts and safe bounds where JavaScript numbers are used.

### 3.2 Billing dates and periods

Billing periods use calendar dates, while event timestamps use timezone-aware instants. Monthly periods should be calculated from the original billing anchor so that a lease starting near the end of a month does not drift across subsequent months. Proration and rounding behavior should be covered by tests.

### 3.3 Malaysia timezone

Business reporting uses `Asia/Kuala_Lumpur` and explicit month boundaries. Calendar dates and timestamps should not be treated as interchangeable. Tests should cover month boundaries and execution under different server timezone settings.

### 3.4 Authorization and organization boundaries

Server handlers should authenticate the caller, enforce the required role, and derive the organization scope from trusted membership data. Client-supplied organization IDs must not be treated as proof of authorization. Prisma database access does not automatically enforce Supabase RLS, so server-side authorization and query scoping remain important.

### 3.5 Payment allocation and concurrency

Payment allocation is performed against outstanding invoices in a deterministic order. Lease-level row locking helps serialize competing operations for the same lease. Pending verification payments must be accounted for when determining remaining collectible balance if the business rules reserve that amount.

Approval and voiding operations should use conditional state transitions and audit records. Voiding a payment should reverse only the allocations associated with that payment, according to the project's documented policy.

### 3.6 Webhook validation and idempotency

The gateway webhook verifies a signature using a constant-time comparison and validates that the reported amount matches the stored bill amount. Processing locks the relevant gateway-bill row and uses a unique gateway-bill reference to help prevent duplicate payment records.

These controls reduce common risks but should be verified with tests for duplicate, concurrent, invalid, mismatched, and out-of-order callbacks. A production deployment should fail safely if its webhook secret is missing or misconfigured.

### 3.7 Database constraints and auditability

Database constraints provide a final line of defense for cross-organization relationships, duplicate gateway references, and overlapping leases. Audit events should capture important state changes without recording secrets or unnecessary sensitive callback payloads.

## 4. Review findings and status

The following distinctions were made during review:

- **Report organization scope:** not considered a confirmed defect after reviewing the implementation that derives organization scope from the authenticated actor and checks the caller's role.
- **Late fees:** no late-fee handler was identified in the reviewed folder. This is missing functionality, not evidence of a bug in a handler that does not exist.
- **Report timezone:** not considered a confirmed defect after reviewing the explicit Malaysia timezone/month-boundary handling described for the current route.
- **Webhook amount validation:** the current implementation checks that the signed callback amount matches the stored bill amount.
- **Webhook concurrency:** row locking and a unique gateway-bill reference are safeguards; concurrency and retry behavior should still be verified with executable tests.

These are review notes based on the code details examined. They should not be read as proof that every behavior has been tested end to end.

## 5. Known implementation considerations

- Ensure the gateway signing secret is configured and never expose it to browser code.
- Avoid logging complete callback payloads if they may contain personal or sensitive data.
- Test month boundaries under multiple runtime timezone settings.
- Verify uploaded-file cleanup cannot delete a file that was not created by the current request.
- Confirm every Prisma-backed API route performs its own authentication, role authorization, and organization scoping.
- Keep database migrations, Prisma schema, and application enums aligned.
- Add or retain automated tests for billing anchors, proration, payment allocation, approval/void state transitions, and webhook idempotency.

## 6. Mistakes and corrections

The project notes mention that Prisma schema formatting and an `@next/env` import issue required correction after testing. This summary does not reconstruct the exact original prompts or claim specific command output that is not preserved here.

## 7. Verification status

This file does not assert that all tests passed. Record actual commands, environment, observed results, and unresolved failures in `verification-notes.md`.

## 8. Record integrity

This document was created retrospectively from available project context. It is not a generated or exported Codex conversation. If an original AI transcript is available, preserve it separately and label it as the source transcript.
