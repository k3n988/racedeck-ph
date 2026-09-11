# RaceDeck Project Progress

This document is the official development progress tracker for RaceDeck PH. It records the current implementation state, validation status, and remaining work before production launch.

Last updated: 2026-09-12

### Organizer create-event workflow hardening (2026-09-12)

- Reworked the seven-step create-event form so event name and event date validation is explicit and returns the organizer to the missing step instead of failing silently.
- Each image input now owns its own selected `File` and preview state; logo, banner, route map, and multi-select poster uploads no longer overwrite one another or persist only as browser `blob:` URLs.
- Event creation now saves supported schedule fields, creates categories, uploads event assets after the event exists, persists route-map metadata, and reports the exact failing operation inline.
- Poster uploads support multiple files with per-image removal before creation. Uploads use the existing organization-scoped event asset endpoint and storage bucket.
- Tagline, race mechanics, and separate city/province inputs are preserved in the event description/address because the existing `events` schema has no dedicated columns for those values.
- Event asset uploads now idempotently ensure the `event-assets` bucket exists before uploading, preventing `Bucket not found` when the remote storage migration has not been applied.
- Public event details now load persisted content-image metadata for the specific event. Public list/details continue to show only approved published/ongoing/completed events; newly created drafts remain available through the organizer preview until admin approval.
- Create Event now intentionally creates a `published` and `approved` event so completed organizer submissions appear in the public event list/details immediately, and a forward-only grant allows route-map metadata to be saved by the server-side asset endpoint.
- Added an idempotent repair migration for remote projects missing `event_content_images`; it recreates the table, index, grants, RLS read policy, and reloads the PostgREST schema cache so multi-poster uploads can complete.
- The repair policy uses RaceDeck's existing `is_org_member()` tenant-check function, matching the established event-content RLS pattern.
- Public event list/home reads are now explicitly uncached (`noStore` plus the list page's `force-dynamic` mode) so newly published events are not hidden by a stale server-rendered empty state; the existing public approval/lifecycle filter remains in place.
- Public event date rendering now handles malformed legacy dates safely instead of throwing a `500` for the entire event list; invalid values display `Date to be announced` while valid events continue to render normally.

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
- Secure participant payment receipt and issued-invoice PDF download endpoints, each scoped through the authenticated user's registration ownership.
- Added shared React-PDF branding and receipt, sales-invoice, and certificate templates.
- Added private `payment-documents` Storage bucket migration with PDF-only MIME restriction and a 10 MB limit.
- Payment document downloads now reuse an existing `storage_reference`, otherwise render once, upload to `payment-documents`, persist the path, and return a 10-minute signed URL.

### Organizer results operations

- Results import page at `/organizer/events/[eventId]/results`.
- CSV upload and server-side validation against active bibs assigned to confirmed registrations.
- Preview response with matched and unmatched rows; publishing is blocked while unmatched rows remain.
- Separate `upload_results` and `publish_results` permission gates.
- Publication reuses the existing idempotent results-published notification and email queue path.
- Existing Promo Codes, Bib Management, Race Kit Claiming, and Announcements workflows were reviewed and confirmed as already wired; they were not duplicated.
- Results CSV parsing now handles quoted fields, embedded commas/quotes, BOMs, and CRLF/LF line endings.
- Pre-publication unmatched-row correction/exclusion controls and a server-side correction endpoint were added.

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
- Results and document routes were included in the successful production build.
- No `supabase db push` was run during the participant application implementation.

## Remaining work

### Participant vertical slice completion

- Complete and integration-test the full flow:
  `Event → Registration → Waiver → Slot Hold → Checkout → Verified Webhook → Confirmed Registration → QR → Receipt/Invoice → Confirmation Email`.
- Add or finish secure QR/digital-ticket generation and duplicate protection where the existing schema/service does not yet provide it.
- Certificate storage caching remains pending because no existing certificate delivery route/service currently generates documents.
- Add richer validation for all optional result columns (times, ranks, participant identifiers, and category snapshots) before broad organizer rollout.
- Vitest is configured for local tests, with a passing PDF template smoke test. Supabase integration tests remain pending because no dedicated local test database harness is configured.
- Added additive `result_batches.is_superseded` and `superseded_by_batch_id` tracking with a trigger that only supersedes unpublished draft batches; published batches are never touched.
- Add a dedicated persisted staging model if fully revisitable corrections beyond the existing `results` staging rows are required.
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

## Latest validation update

- `supabase db reset` completed successfully against the local Docker instance and replayed all migrations through the payment-document storage and result-batch supersede migrations.
- `.env.test` is ignored and contains only local Supabase URL/keys; Vitest loads it through `vitest.config.ts`.
- `tests/helpers/supabase.ts` provides reusable local Auth/organization/event/category fixture seed and cleanup helpers.
- The PDF template smoke test passes. Full API/RLS/webhook integration cases remain pending because route-session fixtures and end-to-end assertions have not yet been implemented.
- Added the seven integration-test contract cases and authenticated-client helper; the first run exposed a malformed local service-role JWT before test bodies executed, which was diagnosed and corrected below.
- `supabase db reset` remains clean; Docker/local database is available and the integration harness now seeds and cleans up local Auth fixtures successfully.

### Local Auth fixture validation (2026-09-09)

- Diagnosed the fixture setup failure as a malformed `SUPABASE_SERVICE_ROLE_KEY` in `.env.test`: local Auth returned HTTP 403 `bad_jwt` because the JWT had two segments instead of three.
- Replaced it with the complete local service-role key from `supabase status`; the key remains local-test-only and is not committed.
- Made fixture teardown safe when setup fails and removed temporary diagnostic logging after confirming the cause.
- The seven integration contract tests now execute and pass in two consecutive runs; the full `npm test` suite passes with 8 tests.
- The initial participant/public-event assertion was corrected to test an actual cross-organization mutation denial, since published event visibility is intentionally public.
- These are local database/RLS contract tests; full route-level webhook, payment, PDF-cache, and concurrent-capacity integration coverage remains outstanding.
- Final validation after the fixture cleanup adjustment: `npm test` passed (8/8), `npx tsc --noEmit` passed, `npm run lint` passed with existing warnings, and `npm run build` passed.

### Email delivery worker and reminders (2026-09-09)

- Added the server-only email queue worker in `lib/email/email.service.ts` using the existing `email_messages` lifecycle and Resend configuration.
- Queue claims use a conditional status update so concurrent workers cannot deliver the same message; retries are bounded and exhausted failures become `suppressed`.
- Added idempotent confirmed-participant reminder dispatch in `lib/email/reminder.service.ts` for in-app notifications and queued email.
- Added CRON_SECRET-protected endpoints at `/api/cron/email-delivery` and `/api/cron/race-reminders`.
- Reminder dispatch skips registrations without an authenticated owner or email address and never targets non-confirmed registrations.
- TypeScript and production build pass after the implementation; existing lint warnings remain unchanged.

### Resend delivery webhook (2026-09-09)

- Added `/api/webhooks/resend` with Svix signature and five-minute timestamp verification.
- Delivery events are deduplicated by the existing unique `email_delivery_logs.provider_event_id` constraint.
- Provider events update `email_messages` to `delivered`, `failed`, `bounced`, or `suppressed` while preserving delivery history and preventing a delivered message from being downgraded.

### Project documentation (2026-09-09)

- Replaced the default Next.js README with a RaceDeck product, routing, authorization, payment, email, local-development, and operational reference.

### Participant payment-flow hardening (2026-09-09)

- Protected checkout idempotency reuse so a payment key cannot return another participant's registration or checkout URL.
- Checkout now cancels/releases the created registration and hold when payment initialization or persisted pricing fails.
- PayMongo webhooks now reject a payment whose registration belongs to a different event.
- Confirmation email queue records now retain the registration's authenticated `user_id` and skip invalid null email addresses.
- Validation passed: `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` with existing warnings, and `npm run build`.

### Public events flow (2026-09-09)

- Updated `/events` with public event cards sourced from the existing public-event service, including banner, event date, location, category distances, registration status, closing date, and starting fee.
- The complete card, Featured card, `View Details`, and list-level `Register Now` affordance all route to `/events/[eventId]` for the selected event.
- The event details page remains the only public point that links to `/events/[eventId]/register`, preserving the required list → details → registration flow.
- Final validation passed: `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` with existing warnings, and `npm run build`.

### Public event details UI (2026-09-09)

- Rebuilt `/events/[eventId]` around the existing public event-detail service with responsive event hero, sidebar summary, event logo/banner fallback, category badges, registration status, deadline, countdown, and mobile registration CTA.
- Added data-backed tabs for Event Details, Race Mechanics, Announcements, and Results; optional tabs appear only when the corresponding public data exists.
- Added real category pricing/availability, schedules, route links, race-kit items, partner display, and published-results navigation.
- The only registration links remain `/events/[eventId]/register`; no client code can alter payment or registration state.
- Validation passed: `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` with existing warnings, and `npm run build`.

### Participant registration and payment state UI (2026-09-09)

- Rebuilt `/events/[eventId]/register` with data-backed category cards, configured event fields, waiver review/acceptance, promo entry, checkout lifecycle explanation, and responsive public styling.
- Checkout retries now retain one client idempotency key for the active form session; payment and registration status remain server/webhook controlled.
- Updated `/my-races/[registrationId]` with a pending-payment state, expiry countdown, safe gateway continuation link, webhook-status refresh/polling, confirmed QR view, receipt/invoice links, and operational registration details.
- Participant registration-detail API now returns a QR only for a confirmed registration.
- Validation passed: `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` with existing warnings, and `npm run build`.

### Payment-flow integration contracts (2026-09-09)

- Added repeatable local Supabase coverage for concurrent capacity-safe slot holds, durable PayMongo webhook-event idempotency, signed webhook status parsing, and participant registration RLS isolation.
- Added a reusable local participant factory to create a second authenticated user for tenant/ownership assertions without changing production data or migrations.
- The new tests deliberately avoid inserting disposable financial-history rows: payment, transaction, receipt, and invoice records are append-only by design and cannot safely be cleaned by the harness.
- Targeted validation passed: `npx vitest run tests/payment-flow.integration.test.ts` (4/4). Full route-level checkout/webhook artifact assertions remain a follow-up requiring a resettable financial fixture strategy or gateway mocks.

### PayMongo webhook production hardening (2026-09-09)

- Hardened the PayMongo gateway parser for the current Hosted Checkout webhook envelope while retaining compatibility with the legacy `/v1` envelope.
- RaceDeck now resolves the stored Checkout Session ID (`cs_…`) for the payment aggregate, stores the resulting payment ID (`pay_…`) as the transaction reference, and converts verified centavo amounts to PHP before comparing them with the pending payment total.
- Added route-level webhook tests for exactly-once successful confirmation/artifact orchestration, processed duplicate no-ops, failed-payment isolation, amount mismatch rejection, and out-of-order failure events that must not downgrade a succeeded/refunded payment.
- Validation passed: targeted payment tests (10/10). Full local-suite/build validation follows this entry.

### Participant payment UI integration (2026-09-09)

- Completed the participant Payments list integration with pending/processing checkout continuation using the server-provided checkout URL and expiry timestamp.
- Payment totals now safely normalize numeric values returned by Supabase before formatting; receipt and invoice links are shown only for successful payments with corresponding document records.
- Registration and My Races continue to use the existing server-side checkout, webhook polling, confirmed QR, and secure document endpoints; the browser still cannot mark payment or registration status.

### Registration-to-payment vertical slice test (2026-09-09)

- Added a local route-level test harness with a mocked PayMongo gateway covering pending registration creation, server-side checkout creation, hold conversion, verified webhook confirmation, and duplicate webhook no-op behavior.
- The test asserts that confirmation and post-payment artifact orchestration happen once and that the browser-facing registration response remains pending until the webhook completes.
- No real gateway calls or disposable financial-history rows are used; the test remains safe to repeat against the local Supabase instance.

### PayMongo sandbox integration harness (2026-09-09)

- Added an opt-in real-gateway test at `tests/paymongo.sandbox.integration.test.ts`.
- It requires a separately supplied `PAYMONGO_SANDBOX_SECRET_KEY` beginning with `sk_test_`, creates a minimal PHP 1 sandbox Checkout Session, and verifies the returned `cs_…` reference and hosted checkout URL.
- The default local test suite skips this test because no sandbox secret is stored in the repository. It never reads or reuses `.env.local` credentials.
- Completing a real paid callback still requires a PayMongo dashboard webhook pointed at a reachable deployment/tunnel and a manual sandbox payment; the existing signed webhook and local route tests cover that processing path.

### Durable payment webhook recovery (2026-09-09)

- Extracted verified PayMongo payment processing into a reusable server-only service so the public webhook endpoint and recovery worker follow the same payment, confirmation, transaction, and artifact path.
- Webhook processing failures are now persisted as retryable `failed` events with exponential backoff in the existing `payment_webhook_events.next_retry_at` field.
- Invalid amount/ownership payloads are permanently marked `ignored` and return HTTP 400 rather than being retried.
- Added a CRON_SECRET-protected endpoint at `/api/cron/payment-webhook-recovery`; it atomically claims due `received`/`failed` events and stale `processing` events using the existing status and `updated_at` fields.
- Unknown gateway payments and missing registrations are recorded as `ignored`; successful recovery continues to rely on the existing transaction, receipt, invoice, confirmation-email, and registration-confirmation idempotency safeguards.

### Internal payment operations (2026-09-09)

- Added the admin-only `/admin/payment-operations` page for filtering and reviewing PayMongo webhook status, attempts, payment/registration references, retry time, and failure details.
- Added protected admin APIs for listing webhook events and retrying recoverable events; terminal `processed` and `ignored` events cannot be retried.
- Manual retry now targets the selected webhook event directly and reuses the same durable recovery worker, preserving the shared verified processing path and idempotency protections.
- Access follows the existing `requireInternalAccess()` boundary, so only RaceDeck Admin/Super Admin roles can use this operational surface; Finance and Support are not granted document/payment webhook review access by this feature.

### Scheduled jobs and cron health (2026-09-09)

- Extracted hold/payment expiration into the shared server-only `expireRegistrationHolds()` service so direct and scheduled execution use the same logic and error handling.
- Added `/api/cron/run`, a CRON_SECRET-protected dispatcher for hold expiry, PayMongo webhook recovery, email delivery, and race reminders; jobs run independently and report per-job failures.
- Added `/api/cron/health`, a protected readiness endpoint checking database connectivity and required server-side scheduler/provider configuration without returning secrets.
- Added `vercel.json` to invoke the dispatcher every minute. Deployment must define `CRON_SECRET`, Supabase service-role configuration, and email provider configuration before the scheduler reports ready.

### Organizer financial operations (2026-09-09)

- Replaced the generic organizer Payments page with a scoped financial operations view for verified payments, refunds, RaceDeck fees, gross paid, and net revenue.
- Added event/status filters and a PII-minimized CSV export sourced from the existing persisted payment/refund/fee amounts.
- Corrected the payments API to filter event IDs through the membership's `restricted_event_ids` before loading financial records; out-of-scope event filters return `403`.
- Restricted organization-wide payout visibility for restricted-event memberships because the existing payout schema has no event scope suitable for safe partial disclosure.
- Validation passed: `npm test` (20 passed, 1 skipped), `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

### Organizer payout history (2026-09-09)

- Replaced the generic Payouts table with a finance-focused payout history page showing payout periods, status, gross registration sales, all persisted deductions, net payout, paid date, external reference, and recorded failure reason.
- Added payout summary cards for paid-out total, pending/processing total, and record count.
- The server API remains protected by `view_financials` and rejects restricted-event memberships because payout records are organization-level and cannot be safely partitioned by event using the existing schema.

### Internal refund operations (2026-09-09)

- Added Admin/Super Admin-only `/admin/finance/refunds` and `/api/admin/refunds` for reviewing cross-organization refund history, status, payment/registration/event references, gateway references, amounts, timestamps, reasons, and recorded failure diagnostics.
- Added server-side status filtering and bounded client-side reference search; the API intentionally returns no participant PII.
- The original review surface was read-only; verified gateway refund submission is now implemented separately below using the forward-only refund hardening migration.

### Verified PayMongo refund processing (2026-09-09)

- Added forward-only migration `20260909133849_refund_processing_hardening.sql` with service-role-only, row-locking refund reservation and gateway-settlement functions. They reserve pending/processing/succeeded refund amounts before gateway submission, preventing concurrent over-refunds.
- Added server-only PayMongo refund creation using the official `/v1/refunds` API with the same idempotency key stored in RaceDeck and sent to PayMongo.
- Added Admin/Super Admin refund submission from the internal Refund Operations page. The server validates the payment, gateway transaction reference, amount, reason, refund balance, and idempotency key; the browser never controls refund status or financial ownership.
- Successful gateway results atomically update refund/payment status and refunded amount, create an immutable refund transaction, release a fully refunded confirmed registration slot, record registration activity, queue participant refund email/in-app notifications, and write an audit log.
- Added handling for PayMongo `payment.refunded` and `payment.refund.updated` webhooks. Gateway transport uncertainty remains `pending` for safe retry with the same idempotency key rather than being incorrectly marked failed.
- Application validation passed: `npm test` (20 passed, 1 skipped), `npx tsc --noEmit`, `npm run lint`, and `npm run build`. The new migration has not been replayed with local `supabase db reset` in this task, to preserve current local development data; perform that clean replay before `supabase db push`.

### Local refund migration replay (2026-09-09)

- Clean `supabase db reset` replayed every migration through `20260909133849_refund_processing_hardening.sql` successfully on the local Docker Supabase instance.
- Verified `create_refund_request(uuid, numeric, text, text, uuid)` and `apply_refund_gateway_result(uuid, text, refund_status, text, text)` exist with `service_role` execution only; `authenticated` execution is denied.
- Post-reset validation passed: `npm test` (20 passed, 1 skipped), `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Lint/build retain only the previously noted non-blocking React/image warnings.

### Final backend refund integration validation (2026-09-09)

- Added `tests/refund.integration.test.ts` against the local Docker Supabase database.
- Verified repeated refund idempotency keys return the original reservation, concurrent requests cannot reserve more than the paid balance, and duplicate gateway settlement does not double-count `payments.amount_refunded` or create a second refund transaction.
- Full validation passed: `npm test` (23 passed, 1 skipped), `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- Backend payment/refund validation is complete for the implemented scope; remaining work is provider sandbox/live verification and UI implementation.

### Organizer and public UI foundation (2026-09-09)

- Implemented the functional organizer dashboard at `/organizer/dashboard` using the existing scoped events API, including event search, event creation, registration/sales summary cards, event status, capacity, and links into each event workspace.
- Implemented event settings at `/organizer/events/[eventId]/settings` using the existing event authorization and PATCH API for availability, capacity, registration window, slug, and featured visibility.
- Replaced the empty public `/services` module with a minimal product overview page; no new business behavior or API was introduced.
- TypeScript and production build passed. Lint passed with existing hook/image warnings plus the new dashboard/settings dependency warnings; these are follow-up cleanup items and do not disable security or validation.
- Next UI slice: finalize the public Events list/details/registration presentation and then continue remaining organizer/admin placeholder pages.

### Organizer event workspace navigation (2026-09-09)

- Expanded `/organizer/events/[eventId]` into a complete workspace hub with links to event setup, categories and pricing, registration form, waiver, race kit, registrations, bib management, kit claiming, announcements, results, reports, and settings.
- Added active-section navigation, back-to-events navigation, event lifecycle/review context, review feedback visibility, and quick links for setup sections.
- Preserved the existing server-side event authorization/API boundary; this change only improves navigation and workspace presentation.
- TypeScript and production build passed. Lint passed with existing warnings in older event/details and image/result components.

### Public registration UI guard (2026-09-09)

- Updated `/events/[eventId]/register` to load the browser Supabase session before allowing checkout submission.
- Unauthenticated visitors can still review the public registration form, but are redirected to `/login` with a return URL before the server registration API is called.
- Preserved server-side category, profile, waiver, promo, slot-hold, pricing, and payment validation; the browser still cannot confirm payment or registration.
- TypeScript and production build passed. Lint passed with existing warnings only.

### Public home visual redesign (2026-09-09)

- Rebuilt `/` to match the RaceDeck public visual direction: branded navigation, orange/navy hero treatment, featured race banner, upcoming-race cards, and participant journey section.
- The home page uses the existing public published-event query. It now renders dynamically and falls back safely to a polished empty state when no published event data is available.
- Added a public header login/registration CTA and footer legal links without changing public event, authentication, registration, or payment authorization behavior.
- TypeScript, lint, and production build passed. Existing image/hook lint warnings remain for later cleanup.

### Public home empty-state refinement (2026-09-10)

- Refined the public landing experience when no organizer event is yet published: an intentional RaceDeck hero, race-discovery benefits, organizer-hosting CTA, clearer upcoming-races empty state, and improved visual hierarchy.
- Refined the public header and footer with a sticky branded navigation, legal links, and responsive spacing.
- Real published events still replace the empty hero/cards automatically; no mock event data or authorization changes were introduced.
- TypeScript, lint, and production build passed. Existing image/hook lint warnings remain for later cleanup.

### Public home reference-alignment revision (2026-09-10)

- Reworked the public home after visual review to follow the supplied RaceDeck event-list reference: compact discovery panel, short wide featured-event banner, All Events heading/grid, and restrained event-first layout.
- Removed the oversized generic marketing-hero composition. The no-event fallback now retains the same event-discovery layout until organizers publish approved events.
- TypeScript and production build passed. Existing lint warnings remain unchanged outside the public home image notices.

## Important development rules

- Update this `PROJECT_PROGRESS.md` file after every new feature or code implementation, including its current status, validation result, and remaining follow-up work.
- Do not edit previously applied migrations.
- Do not create a migration unless a genuine schema gap is confirmed.
- Keep service-role keys and other privileged credentials server-only.
- Treat RLS and server-side authorization as mandatory for every sensitive operation.
- Do not trust client-provided organization, event ownership, payment status, registration status, or claim state.
- Preserve financial, legal, certificate, payment, reconciliation, and audit history.
- Do not commit or push changes without explicit instruction.
# Auth portal labels (2026-09-10)

- Added explicit Participant Portal and Organizer Portal labels to registration and shared login forms.
- Added cross-links so users can select the correct account type before authentication.
# Auth portal hydration fix (2026-09-10)

- Made the shared login portal label hydration-safe by resolving the query-string portal after mount.
- Organizer login now defaults to the organizer verification flow instead of the participant dashboard.

# Organizer signup feedback (2026-09-10)

- Organizer signup now verifies successful Supabase-backed provisioning before continuing.
- Successful signup shows feedback and redirects to organizer sign-in with email verification guidance.
- Organizer signup now detects missing Supabase users and duplicate email responses instead of showing a false success message.
- Organizer sign-in now completes idempotent profile/organization provisioning after email confirmation when the signup callback was not available.
- Organizer route redirects now preserve the organizer portal and requested destination instead of falling back to the participant dashboard.
- Participant and organizer signup/sign-in flows now validate Supabase user creation, detect duplicate emails, verify profile provisioning, and keep portal-specific redirects.
- Added duplicate-submit guards so signup cannot issue repeated Supabase email requests from double-clicks or rapid retries.
- Added a visible Organizer Portal link to the public header and footer.
- Registration pages remain accessible when an existing session is present, preventing organizer signup from incorrectly redirecting to the participant dashboard.
- Shared login remains accessible with an existing session, preventing organizer sign-in from being redirected into a failing protected page.
- Added forward-only auth context table grants migration to restore authenticated SELECT access while preserving existing RLS row isolation.
- Added server-only diagnostics for profile, organization, and membership provisioning failures without exposing database details to clients.
- Development login now surfaces the safe provisioning stage error returned by the server; production remains generic.
- Development provisioning diagnostics now include the Supabase error code/message for the failing stage without exposing credentials.
- Added a forward-only service-role grant migration for server-side profile, organization, and membership provisioning.
- Fixed organizer verification feedback ordering and added a saved-document count/readiness check before submission.
- Added the organization profile-first onboarding target and a public organization-logo storage bucket/server upload endpoint; verification documents remain private.
- Organizer login now defaults to the Organization Profile step before verification.
- Normalized nullable organization profile values to prevent client-side `.trim()` errors during onboarding.
- Fixed the organization logo upload handler to retain the input reference across async requests and avoid the React null `currentTarget` crash.
- Fixed organization profile upload/save feedback and ensured successful logo URLs remain visible after the async refresh.
- Added the authenticated organization-profile update grant required by the owner-protected profile save route, with development-safe error details.
- Confirmed a clean local Supabase replay through the organization profile update grant; organization profile saves now have the required authenticated UPDATE privilege while the owner-only RLS policy remains enforced.
- Merged organizer onboarding into one Organization Setup & Verification form with required government ID, optional business/registration fields, status-based locking, admin feedback, and approved-state event CTA.
- Added coordinated onboarding submission with server-side validation and compensating rollback if verification or organization status synchronization fails; tagged uploaded documents by type for government-ID enforcement.
- Pre-approval visits to the post-approval organization profile now return to the combined onboarding flow.
- Revalidated the full local Vitest suite after onboarding consolidation: 23 tests passed and 1 PayMongo sandbox test skipped by design.
- Updated the combined onboarding form to use a two-column desktop layout with two inputs per row; description, logo, social URLs, and document controls remain appropriately full-width.
- Added the pending-review read-only verification card using live organization and organizer verification data, including submission date, contact summary, optional-field fallbacks, and uploaded document names.
- Completed the Admin Organizer Verification workflow with a pending-review count, per-application Review and Approve actions, confirmation prompt, success/error feedback, and a server-side pending-status guard before approval.
- Added shared role-priority landing resolution: `racedeck_internal_user_roles` Admin/Super Admin accounts land in `/admin/dashboard`, active organizers land in `/organizer/dashboard` or `/organizer/verification`, and other authenticated users land in `/dashboard`; password login and auth callback use the same resolver.
- Finalized shared login redirects through `lib/auth/resolve-landing-route.ts` and `/api/auth/landing-route`; internal staff priority is enforced before organizer membership, with no separate Admin login route.
- Replaced the empty Admin Dashboard placeholder with a functional internal overview: role display, platform counts, pending organizer queue, review links, and navigation to existing Admin modules.
- Added direct pending-organizer approval actions to the Admin Dashboard with confirmation, loading, success/error states, and reuse of the protected audited approval API.
- Hardened organizer approval to claim only still-pending records atomically, roll back status synchronization/audit failures, and keep a successful approval from being reported as failed when notification or email queueing has a recoverable warning.
- Expanded the public RaceDeck desktop containers to a wide responsive layout while keeping organizer and admin portal container sizing unchanged.
- Redesigned `/admin/dashboard` as a production-oriented Super Admin platform control center based on the README: dark admin navigation, responsive operational header, organizer/event/registration/revenue/payable KPIs, attention queue for organizer reviews/event approvals/reconciliation/email issues, platform pulse indicators, recent payment transactions, upcoming races, and the existing live organizer approval queue.
- Wired the redesigned dashboard to authoritative existing records (`organizations`, `events`, `registrations`, `payments`, `platform_fees`, `finance_reconciliation_records`, `email_messages`, and `organizer_verifications`) with empty-state handling and no hardcoded business metrics; admin access remains protected by `requireInternalAccess()`.
- Validated the Super Admin dashboard redesign with `npx tsc --noEmit` successfully.
- Refined the Super Admin sidebar to match the approved navigation structure: separate Transactions, Refunds, Payouts, Platform Fees, and Reconciliation links plus Platform Content, Email Delivery, Support / Issues, Roles & Permissions, Audit Logs, and Platform Settings; added responsive scrolling and operational badges.
- Started the complete Super Admin interface implementation from the README: added shared `components/admin/admin-ui.tsx` primitives for page headers, stat cards, status badges, toolbars, tables, empty states, action links, and money formatting.
- Replaced placeholder Admin screens with real Supabase-backed operational pages for Events, Participants, Transactions, Payouts, Platform Fees, Reconciliation, Content Management, Email Delivery, Support / Issues, Audit Logs, Roles & Permissions, and Platform Settings.
- Added read-only detail views for admin event, participant, transaction, and payout records with linked RaceDeck records, state badges, financial summaries, and privacy-safe operational messaging.
- Expanded Organizer Management to load all organizer verification records with an all-organizers filter while retaining protected approval actions.
- Added shared `AdminShell` for non-dashboard Super Admin routes with responsive desktop sidebar, mobile slide-over drawer/backdrop, active route state, breadcrumb header, global search affordance, profile identity, and sign-out navigation; dashboard is excluded from the wrapper to preserve its existing full dashboard shell.
- Revalidated the expanded Super Admin implementation: `npx tsc --noEmit` passed, `npm run lint` passed with existing organizer/public hook and image warnings, and `npm run build` passed with all added Admin routes compiled.
- Added a shared responsive Organizer Portal shell matching the approved RaceDeck organizer navigation: Dashboard, Events, Registrations, Finance (Payments/Payouts), Analytics (Reports), and Organization (Team Members/Organization/Settings), with event-specific tools intentionally kept inside Event Workspace routes.
- Organizer shell includes desktop sidebar, mobile drawer/backdrop, active route highlighting, breadcrumb header, organization-scoped search affordance, account identity, and sign-out navigation; it reuses the existing organization-context guard.
- Added a visible, consistently styled logout button to both Admin and Organizer shell account areas, including the dashboard's Super Admin sidebar, using the existing `/auth/logout` route.
- Rebuilt `/organizer/dashboard` with six live KPI cards (total/active events, registrations, unique confirmed+paid participants, gross sales, and net organizer revenue), upcoming-event fill bars, recent registrations, recent payments with negative refunds, payout balances, friendly zero-event CTA, per-section skeleton loading, and inline retryable errors.
- Extended the existing organization-scoped organizer registration/payment services to return the event/category/participant display data needed by the dashboard; payment summaries remain derived server-side from scoped payment/refund/platform-fee records, and the payouts service remains organization-scoped.
- Removed the dashboard's duplicate event search control and retained event-specific management inside the existing Event Workspace; validated the dashboard with `npx tsc --noEmit`, `npm run lint`, and `npm run build` successfully (lint has pre-existing warnings only).
- Rebuilt `/organizer/events` with the requested nine-column operational table: Event, Date & Location, Lifecycle Status, Review Status, Registration Availability, Registrations, Capacity, Gross Sales, and Actions; added banner thumbnails, capacity fill progress, Preview/Manage actions, responsive table scrolling, skeleton loading, empty state, retryable errors, filters, and the existing create-draft modal.
- Extended the event list UI type mapping to use existing banner, address, and updated event fields without changing the organization-scoped event API.
- Validated the nine-column organizer events screen with `npx tsc --noEmit`, `npm run lint`, and `npm run build`; only existing `<img>` and hook dependency warnings remain.
- Improved local organizer API diagnostics: event list queries now report which scoped query failed during development, validate related registrations/payments/categories query errors instead of silently ignoring them, and retain the generic error message in production; `npx tsc --noEmit` passed.
- Added a 15-second timeout and clear retryable timeout message to the organizer Events loader so a stalled API/Supabase request cannot leave the page on an infinite skeleton.
- Fixed the organizer Events error-state regression where diagnostic messages beginning with `Loading` were incorrectly rendered as skeletons; failed 500 responses now show the retryable error banner.
- Added a narrowly scoped migration granting the trusted `service_role` access to the existing organizer event, category, registration, and payment tables; this resolves the confirmed `permission denied for table events` failure without changing the schema or tenant-scoping logic.
- Included explicit `USAGE` on the `public` schema in the organizer service-role grant migration so the remote permission fix covers both schema and table access.
- Updated `/organizer/events` to always render the complete nine-column table, including a friendly race-flag empty row and Create Event CTA when no records exist; API errors remain separately retryable.
- Added the dedicated `/organizer/events/create` draft workflow with persistent section navigation, slug generation, event details, branding URLs, dynamic race categories, capacity calculation, registration dates, review summary, and draft preview routing; added organizer-only draft preview rendering from live event data.
- Added authenticated grants for existing event/category management routes while keeping RLS as the authorization boundary; TypeScript validation passed.
- Enhanced the organizer draft preview to use live event branding and description data in a public-page-style layout with hero overlay, logo, registration status, sharing controls, and Event Details/Race Mechanics/Announcements/FAQs tabs; unsupported content sections show clear setup guidance instead of fabricated data.
- Exposed a safe development-only Supabase error detail for event creation failures and logged the full server error, so failed draft saves now identify permission, duplicate-slug, schema, or validation causes without leaking details in production.
- Matched the organizer draft preview more closely to the public event-details experience: live hero/logo branding, two-column overview, event metadata, registration state, sharing area, and content tabs now use the same RaceDeck visual hierarchy without sample event data.
- Revalidated the preview/public-style update with `npm run lint`; it passes with only existing `<img>` optimization warnings and unrelated hook warnings.
- Fixed organizer Event Details draft saves by converting blank optional date/time, URL, and capacity values to database `null` before PATCH updates; development responses now expose the exact update error while production remains generic.
- Added the `event-assets` Storage bucket migration and an organization-scoped event logo/banner upload API for persistent organizer event branding.
- Added real file pickers and local image previews for Event Logo and Event Hero/Cover Banner on Create Event; selected files upload after draft creation and their persistent URLs are written back to the scoped event record.
- Rebuilt `/organizer/events/create` as the requested seven-step organizer event setup UI with vertical stepper, shared form state, local previews for logo/banner/route/posters, date validation, category capacity summary, kit/FAQ repeaters, content fields, sponsor/review summary, autosave indicator, and required-section checklist; `npx tsc --noEmit` passed.
- Connected the final Create Event action to the existing organization-scoped event API: it creates/updates the draft, uploads selected logo/banner assets, persists configured race categories, and redirects to the live event preview; the final action is labeled Create Event instead of Submit for Review.
- Finalized the Create Event action behavior: it now saves the event and configured categories to the database, uploads selected branding assets, and redirects to the real event preview; the review action is presented as Create Event for this organizer flow.
- Added persistent `event_content_images` storage metadata and extended the event asset API to save multiple poster images per organization-scoped event, with development upload error details for missing/unapplied Storage configuration.
- Connected the Create Event poster gallery to the persistent asset endpoint so every selected poster is uploaded and recorded after the event draft receives its ID; `npx tsc --noEmit` and `npm run lint` pass with existing image/hook warnings.
- Completed the Sponsors & Review step UI with separate Presented By, Official Partners, and Supported By sections; organizers can add/remove multiple sponsors and enter sponsor name, logo preview, and website URL before creating the event.
