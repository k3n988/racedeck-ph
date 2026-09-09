# RaceDeck Project Progress

This document is the official development progress tracker for RaceDeck PH. It records the current implementation state, validation status, and remaining work before production launch.

Last updated: 2026-09-09

## Current milestone

RaceDeck has a working database/security foundation and an expanding Next.js application layer. The participant-facing dashboard, profile, payments, and notifications views are implemented against authenticated server APIs. The application currently builds successfully.

## Implemented and configured

### Database and Supabase foundation

- Initial RaceDeck schema and organization/event/registration foundations.
- Organization membership, permissions, internal RBAC, and multi-tenant ownership relationships.
- Registration form fields and options, event categories and pricing, waivers, promo codes, and registration-related status models.
- Payment architecture covering payments, transactions, webhook events, refunds, and platform fees.
- Digital payment receipts and configurable invoice records.
- Bib management, race-kit configuration, kit items, and race-kit claims.
- Communications, announcements, notifications, email messages, delivery logs, and reminders.
- Results, certificates, and related publication/verification records.
- Forward-only final database hardening migration for identified RLS, ownership, integrity, indexing, idempotency, and history-protection issues.
- Organizer verification document storage architecture using a private, organization-scoped bucket and server-side access patterns.

No historical migration was modified as part of the application work documented here. Database changes must continue to use forward-only migrations.

### Authentication, authorization, and tenant context

- Supabase browser and server clients are configured.
- Service-role access remains server-only.
- Authenticated user/profile provisioning and loading are implemented.
- Participant, organizer, and internal administrative access use protected layouts and server-side authorization helpers.
- Organization membership, permissions, restricted event access, and RLS remain the security boundary; hiding a route in the UI is not treated as authorization.
- Participant data access is scoped to the authenticated Supabase Auth user.

### Event and organizer application areas

- Public event list and event detail APIs/pages.
- Organizer event list, event workspace, event details, and organization context pages.
- Event categories and pricing management.
- Registration form builder and field option management.
- Waiver configuration.
- Promo-code management.
- Bib management.
- Race-kit configuration and claiming.
- Announcement management.
- Results management foundation.
- Certificate settings foundation.
- Organizer registrations, payments, payouts, reports, settings, and verification API/page foundations.
- Admin organizer verification review foundation.

### Participant application areas

- Public event registration entry and registration form foundation.
- Participant `/dashboard` with:
  - next confirmed race;
  - upcoming confirmed races;
  - days-away countdown;
  - payment, race-kit, event, and organizer-announcement reminders;
  - recent published result.
- Participant `/my-races` and registration detail views.
- Participant `/my-results` and authenticated results API.
- Participant `/profile` with authenticated profile read/update support.
- Participant `/payments` with authenticated payment history and receipt/invoice references.
- Participant `/notifications` with authenticated notification listing and mark-as-read support.
- Password reset and email-change foundations through Supabase Auth.

## Security rules currently enforced

- The browser cannot mark payments as paid or registrations as confirmed.
- Payment confirmation is server/webhook driven.
- Participant APIs derive the user ID from the authenticated server session; client-supplied user IDs are not trusted.
- Participant queries are limited to the participant's own registrations, payments, notifications, documents, results, and related records.
- Organizer operations require authenticated organization membership, event ownership, permission checks, and restricted-event checks where applicable.
- Internal Admin, Super Admin, Finance, and Support access follows the existing internal authorization architecture; financial access is not automatically treated as document-review access.
- Verification documents remain private and are intended to be viewed through short-lived server-created signed URLs.

## Validation completed

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings in organizer/public files (hook dependency and image optimization warnings).
- `npm run build` — passed; Next.js compiled, type-checked, generated static pages, and finalized page optimization successfully.
- No `supabase db push` was run during the participant application implementation.

## Remaining work

### Participant vertical slice completion

- Complete and integration-test the full flow:
  `Event → Registration → Waiver → Slot Hold → Checkout → Verified Webhook → Confirmed Registration → QR → Receipt/Invoice → Confirmation Email`.
- Add or finish secure QR/digital-ticket generation and duplicate protection where the existing schema/service does not yet provide it.
- Complete receipt/invoice document generation and secure download/view endpoints. The existing invoice service is currently only a placeholder, so the participant payments page displays issued references but does not provide document downloads.
- Complete gateway integration testing with real signature verification, idempotency, failed/expired/refunded states, and concurrent checkout/hold scenarios.
- Complete queued confirmation email orchestration and delivery assertions.

### Application and operations

- Add targeted local Supabase/API integration tests for RLS, ownership, payment webhook idempotency, capacity/hold concurrency, duplicate race-kit claims, and cross-tenant denial cases.
- Finish remaining placeholder pages and feature-specific UI polish without weakening server-side authorization.
- Review participant navigation and information architecture before final UI implementation.
- Add production observability, structured error reporting, retry/dead-letter handling, and operational alerts for payment/email/webhook failures.
- Confirm scheduled processing for expired holds, stale payments, reminders, and other background jobs in the deployment environment.

### Production readiness checks

- Run a clean local database reset and migration validation against the complete migration history.
- Run `supabase db diff`/schema review and generated-type refresh after any approved schema changes.
- Verify storage bucket configuration and signed-URL expiry in the deployed Supabase project.
- Configure production secrets, webhook endpoints, email provider settings, cron/worker credentials, and domain redirects.
- Perform a security review of all server routes, grants, RLS policies, rate limits, and audit logging.
- Execute end-to-end acceptance tests with representative participant, organizer, restricted staff, and internal admin accounts.

## Important development rules

- Do not edit previously applied migrations.
- Do not create a migration unless a genuine schema gap is confirmed.
- Keep service-role keys and other privileged credentials server-only.
- Treat RLS and server-side authorization as mandatory for every sensitive operation.
- Do not trust client-provided organization, event ownership, payment status, registration status, or claim state.
- Preserve financial, legal, certificate, payment, reconciliation, and audit history.
- Do not commit or push changes without explicit instruction.
