# Rent Collection Assessment

Rent collection portal for Malaysian property managers. Money is stored as integer sen, dates as Postgres `date`, instants as `timestamptz`, and business-time calculations use Asia/Kuala_Lumpur.

## Run locally

Requirements: Node.js 20.9+, Git, Docker Desktop running, and the Supabase CLI.

```powershell
npx supabase start
npx supabase db reset
npm install
Copy-Item .env.example .env.local
npm run seed
npm run dev
```

Use the Studio URL printed by `npx supabase status` to inspect the local database. Update `.env.local` with the URL and keys printed by that command if they differ from `.env.example`. Never commit `.env.local`.

For a production build, run `npm run build && npm start`.

## Seed accounts

`npm run seed` creates the organizations, accounts, units, leases, generated invoices, allocations, and payment-slip sample from the brief. All seeded accounts use the password **RentTest2026!**. Run `npx supabase db reset` before reseeding.

## Main implementation

- Pure date and money functions: `lib/billing.ts`.
- SQL schema, RLS, grants, append-only audit log, exclusion constraint, and Storage policies: `supabase/migrations/`.
- Prisma schema: `prisma/schema.prisma`.
- Lease/payment APIs and gateway webhook: `app/api/`.
- Code review and walkthrough decisions: `REVIEW.md` and `DECISIONS.md`.

## Known limits

- Gateway integration is simulated; `GATEWAY_X_SIGNATURE_KEY` is a local development value and must be set to the simulator's shared key for local webhook calls.
- The interface covers core lease, invoice, payment, approval, and tenant flows. Search, pagination, realtime updates, charts, and automated unit-test coverage were skipped under the four-hour limit.
- Before submitting, export the full Codex conversation transcript required by the assessment into `ai-logs/`. The Codex app does not automatically write its chat transcript into this repository.

## Assessment submission

Submit the public GitHub URL, manager test account `manager@northwind.test`, shared password above, and a short summary of what works and what remains incomplete. The public repo should contain this README, migrations, Prisma schema, seed script, `.env.example`, `REVIEW.md`, `DECISIONS.md`, and the exported `ai-logs/` transcript.
