RaceDeck PH — Final Merged Production Specification (v3)
Base architecture: v2 (corrected status modeling, legal/finance structure). Merged in: v1's full transactional email system, sales invoice support, and e-certificate system — adapted to v2's status fields.

1. Platform Overview
RaceDeck PH is a multi-tenant SaaS platform for running/race event discovery, registration, payments, organizer operations, race-kit claiming, bib management, results, e-certificates, reporting, and organizer payouts in the Philippines.
RaceDeck is specifically for running and race events, not a general-purpose event platform.
Primary Users
Guest / Public Visitor
Participant / Runner
Organizer Staff
Organizer Admin / Owner
RaceDeck Admin
RaceDeck Super Admin
Finance Staff
Support Staff
Core platform flow:
Discover Race → Register → Temporary Slot Reservation → Pay → Payment Gateway Verification → Registration Confirmed → Receive Confirmation Email → Receive QR/Digital Ticket → Receive Receipt/Invoice → Receive Reminders → Claim Race Kit → Race → Results Published → Receive Results Notification → Receive E-Certificate (if enabled)
Organizer flow:
Register Organizer Account → Create Organization → Complete Profile → Upload Verification Documents → Submit for Review → RaceDeck Admin Review → Approved → Create Event → Configure Event → Submit for Review → RaceDeck Approval → Publish → Receive Registrations → Manage Race Operations → Publish Results → Generate E-Certificates (if enabled) → Receive Payout

2. Public Website
Navigation: Events · Results · Services · About Us · Contact Us · Login/Register
Separate CTA: For Organizers
Footer: About · Services · FAQs · Privacy Policy · Terms & Conditions · Refund/Cancellation Policy · Contact · Social Links

3. Marketing / Landing Page
[CORE]
Hero — value proposition, Find a Race CTA, List Your Race CTA
Featured Race (one primary event, controlled by RaceDeck Admin) — banner, name, date, location, Register CTA
Upcoming Races — small list/cards linking to Events Discovery
How RaceDeck Works — Discover → Register → Race
RaceDeck Services — registration, participant management, payments, QR kit claiming, bib management, results management, e-certificates
For Organizers — benefits, registration CTA
Footer
[OPTIONAL] Organizer logos, real testimonials, real platform statistics only (no fabricated numbers).

4. Events Discovery Page
Top Layout: 1/4 width Upcoming Events panel · 3/4 width Featured Event (single, no carousel for MVP)
All Events [CORE]
Search, location filter, distance filter, registration-status filter, sort, pagination
12 events per page, filters and pagination via URL query params (/events?page=2)
Event Card: banner, name, date, location, distance badges, registration availability, registration deadline, Register Now, View Details
Public Registration Labels: Not Yet Open · Registration Open · Registration Closed · Sold Out · Completed · Cancelled

5. Event Details Page
Left Panel: logo, name, date, location, organizer, Verified Organizer badge, categories, registration availability, countdown, Register button, partners/sponsors
Main Area: large banner
Tabs: Event Details · Race Mechanics · Announcements · FAQs · Results
Hide Announcements if none exist
Hide Results until published
Event Details content: description, venue, date/time, categories, fees, available slots, registration dates, assembly time, gun start, cut-off, route/map, race-kit inclusions, claiming info, shirt info, organizer info
Mobile: sticky Register Now

6. Public Results
[CORE] Search by event, participant, bib, category
Display: bib, participant, category, gun time, overall rank, classification rank (where applicable), category rank, status
Participant outcome: Finished · DNF · DNS · DQ
[OPTIONAL] Chip time
[PHASE 2] Live timing, RFID live feeds, live leaderboard

7. Accountless Participant Registration
Participants register directly from an event without creating or signing in to a RaceDeck account.
Registration collects the event-specific participant details, category, race-kit selections, optional merchandise, waiver acceptance, and payment method.
Participants keep their registration reference for payment and organizer follow-up. Public finished-event results remain available from the Results page.

11. Organizer Account Architecture
User → Organization Membership → Organization → Events
Organizer self-registers normally: Self-Registration → Verification → Admin Approval. Super Admin retains + Add Organizer for partner/corporate/personally-onboarded/assisted-onboarding/special accounts.
Every organizer-owned record must resolve to an organization_id. Cross-organization isolation enforced at DB and API level (not just UI).

12. Final Organizer Sidebar
Dashboard · Events · Registrations · Payments · Payouts · Reports · Team Members · Organization · Settings

13. Organizer Dashboard
KPI Cards [CORE]: Total Events, Active Events, Total Registrations, Total Participants, Gross Registration Sales, Net Organizer Revenue
Sections: Upcoming Events, Recent Registrations, Recent Payments, Payout Summary
[PHASE 2] Registration trend, category distribution, advanced analytics

14. Organization Profile
Public: name, logo, description, contact person, email, phone, address, website, social links
Private: legal/business info, verification documents, payout account, internal contacts
Organization Account Status (separate from verification): Active · Suspended · Deactivated

15. Organizer Verification
Verification Status: Draft · Pending Review · Needs Changes · Approved · Rejected
(Suspended is never a verification status — it belongs to Organization Account Status, §14.)
Flow: Register → Create Organization → Complete Profile → Upload Verification → Submit → RaceDeck Review → Approved/Needs Changes/Rejected → Activate Organizer

16. Team Members & Permissions
[CORE] Organizer Owner can invite/remove/activate/deactivate staff, assign roles and permissions, restrict staff to selected events.
Role presets: Organizer Owner · Event Manager · Registration Staff · Race Kit Staff · Results Staff
Granular permissions: View/Create/Edit/Submit Events, Manage Registrations, View Participant Info, Manage Promo Codes, Assign Bibs, Scan Race Kits, Manage Announcements, Manage Email Reminders, Upload/Publish Results, Manage Certificates, View Reports, View Financials, Manage Team
Organizer Owner receives full permissions.

17. Events Management
[CORE] Search, filter, create, edit, duplicate, preview, submit for approval, cancel, archive
Event Table: event, date, location, lifecycle status, review status, registration status, registrations, capacity, gross sales, actions

18. Event Status Architecture
Event Lifecycle: Draft · Published · Ongoing · Completed · Cancelled · Archived
Event Review Status (separate field): Not Submitted · Pending Review · Needs Changes · Approved · Rejected
Example: Lifecycle: Draft / Review: Needs Changes → after approval → Lifecycle: Published / Review: Approved

19. Registration Availability
Separate from Event Lifecycle: Not Yet Open · Open · Closed · Sold Out
Automatic rules: before open date → Not Yet Open; open date reached → Open; capacity hits zero → Sold Out; capacity restored before deadline → Open; deadline reached → Closed.

20. Final Event Workspace
Events → [Event Name] opens the Event Workspace:
Overview
Event Setup: Event Details · Categories & Pricing · Registration Form · Event Waiver · Race Kit Configuration · Email & Reminders · Certificate Settings
Operations: Registrations · Promo Codes · Bib Management · Race Kit Claiming · Announcements · Results
Analytics: Reports
Configuration: Settings

21. Event Overview
[CORE] Event lifecycle, review status, registration availability, total/confirmed registrations, capacity, available slots, gross sales, net revenue, recent registrations, recent payments, quick actions

22. Event Details / Builder
General: name, description, logo, banner, contact info, location, venue, address, map coordinates
Dates: event date, start time, registration open/close
Schedule: assembly, gun start, cut-off, category-specific start if needed
Race Info: mechanics, rules, kit inclusions, shirt details, claiming instructions, route map, start/finish points
Content: FAQs, sponsors, partners
Publishing: Save Draft, Preview, Submit for Review, View feedback, Resubmit

23. Categories & Pricing
Categories: 3K · 5K · 10K · 21K · 42K · Custom
Fields: name, distance, fee, max slots, confirmed registrations, available slots, bib prefix/range, gun start, cut-off, registration availability
Supports both Event Capacity and Category Capacity. RaceDeck must never confirm registrations beyond either limit.

24. Temporary Slot Reservation
[CORE] Prevents overselling. On checkout start: Available Slot → temporary hold → payment attempted. Successful payment confirms the slot; failure/timeout returns it.
Recommended hold: 10–15 minutes. Entity: registration_holds (event, category, user/session, expires_at, status)

25. Registration Form Builder
[CORE] Default fields: first/last name, birthdate, email, mobile, address, emergency contact name/number, shirt size, optional event-level competition classification field where necessary
Organizer custom fields: short text, long text, dropdown, radio, checkbox, yes/no — with required/optional, order, active/inactive, options configuration

26. Registrations
Single Event Registrations module (no duplicate Registrations/Participants views).
Table: Registration ID, bib, participant, category, registration status, payment status, kit status, registration date, actions
Actions: view, edit allowed data, resend confirmation email, resend QR, resend receipt/invoice, cancel, transfer where allowed, export
Detail tabs: Participant Info, Registration Answers, Emergency Contact, Payment, Receipt/Invoice, QR, Bib, Race Kit, Result, Certificate, Email History, Status History, Activity

27. Registration Status
Statuses: Pending Payment · Confirmed · Cancelled · Transferred · Refunded · Expired (non-linear transitions, not a single sequential chain)
Transitions: Pending Payment → Confirmed | Pending Payment → Expired | Confirmed → Cancelled | Confirmed → Transferred | Confirmed → Refunded

28. Registration Activity History
[CORE] Registration created, slot reserved, payment initiated/confirmed, registration confirmed, registration edited, bib assigned, QR scanned, kit claimed, refund processed, result published
Store: action, timestamp, actor, metadata

29. Promo Codes
[CORE] Event-scoped. Code, fixed/percentage discount, start/expiration, total usage limit, per-user limit, applicable categories, active/inactive, redemption count

30. Payment System
[CORE] Payment abstraction — not permanently tied to one gateway. Channels depend on gateway: GCash, Maya, cards, others.
Production requirements: backend payment creation, gateway transaction reference, webhook verification + signature validation, idempotent webhook processing, duplicate-webhook prevention, payment expiry, failed-payment retry, refund tracking, reconciliation.
Correct flow:
Payment Gateway Webhook → Verify → Mark Paid → Confirm Registration → Convert Slot Hold → Generate QR → Generate Receipt (+ Invoice if configured) → Send Confirmation Email
The frontend must never mark a registration confirmed directly.

31. Payment Status
Pending · Paid · Failed · Expired · Partially Refunded · Refunded

32. Registration QR / Digital Ticket
Every confirmed registration receives a secure QR/digital ticket containing: RaceDeck branding, event logo/name, participant name, category, Registration ID, bib (when assigned), event date, QR code, registration status.
Accessible via My Races → Selected Race and the registration confirmation email.
The QR is tied to the registration — not the same as the bib number.

33. Automatic Payment Receipt
After successful payment, RaceDeck auto-generates a digital receipt.
Receipt fields: RaceDeck logo, organizer, event, receipt reference, Registration ID, participant, category, registration fee, processing/platform fee, discount, total paid, payment method, gateway transaction reference, payment date, payment status
Delivered via: email (attached/linked), Download Receipt button in My Races, receipt record under Payments.

34. Sales Invoice Support
Configurable per RaceDeck and/or Organizer billing/tax setup:
Receipt Only, or
Receipt + Sales Invoice
Invoice fields (where issued): registered business name, business address, tax/registration info (issuer-configured), participant/customer info, invoice number, event, registration, items, amount, fees, taxes (where configured), total
Invoices use controlled sequential numbering. RaceDeck must not label a document as an official tax invoice unless the issuing entity has properly configured its invoice requirements.

35. Automated Transactional Email System
[CORE] RaceDeck operates its own centralized email delivery system — organizers are never required to connect a personal Gmail account.
Sender format: RaceDeck PH <noreply@racedeck.ph> or RaceDeck Events <events@racedeck.ph>
RaceDeck controls the email infrastructure; organizers control event-specific content where permitted (§39).
35.1 Automatic Registration Email (Pending Payment)
Triggered when: Registration Status = Pending Payment
Subject: Complete Your Registration for [Event Name]
Contains: participant name, event, category, Registration ID, amount, payment status, payment deadline, Complete Payment CTA. No receipt generated yet.
35.2 Automatic Confirmation Email
Triggered when: Registration Status = Confirmed (i.e., webhook confirms payment — see §30)
Subject: Registration Confirmed — [Event Name]
Contains: participant name, event name/date, location, category, Registration ID, amount paid, payment reference, Registration QR, View Registration CTA, race-kit claiming info if available. This is the participant's primary confirmation.
35.3 Payment Receipt / Invoice Email
Sent alongside §35.2 once §33/§34 documents are generated.
35.4 Race Reminder Automation
Triggered by proximity to event date, only for Registration Status = Confirmed.
Default schedule: 7 days before (date/venue/category/assembly/gun start/kit details), 3 days before (final prep, venue, schedule, mechanics, announcements), 1 day before (Race Tomorrow, event time, venue, assembly, QR reminder, kit reminder).
Organizer may enable/disable each reminder and configure additional schedules (14 days, custom). RaceDeck prevents excessive/duplicate sends.
35.5 Race Kit Email Automation (Optional)
Race Kit Available — sent when claiming period opens (event, venue, date/time, Registration ID, QR, kit inclusions)
Claiming Deadline Reminder — sent before claiming closes
Race Kit Claimed — confirmation after successful QR scan/claim (event, participant, bib, claim timestamp)
35.6 Refund Notification
Sent automatically when Refund Status = Completed (§40): Your Refund Has Been Processed
35.7 Results Published Notification
Sent when a result batch's Publication Status = Published (§37): Your Results Are Available — [Event Name]
35.8 E-Certificate Ready Notification
Sent when a certificate is generated per §41's eligibility flow: Your E-Certificate Is Ready — [Event Name]
35.9 Organizer Announcements Email
Triggered manually by organizer per §36.

36. Organizer Announcements
Event-specific. Organizer targets: all confirmed participants, or a specific category.
Channels: In-App, Email
Examples: venue update, route change, gun start update, weather advisory, kit claiming update, important instruction.
Every announcement is logged.

37. Email Delivery Management
[CORE] RaceDeck tracks every transactional email.
Email Status: Queued · Sending · Delivered · Failed · Bounced · Suppressed
Stored per message: recipient, event, registration, email type, template, sent timestamp, delivery status, provider message ID, failure reason, retry count
Failed transactional emails may auto-retry. Admin can view failed emails, retry, inspect reason, search recipient, view delivery history (see §47). Organizers may view event-related delivery status only — not global email infrastructure.

38. Email Templates
System templates (RaceDeck-managed): organizer verification, event approval, registration pending, payment successful/failed, registration confirmed, receipt, invoice, refund, race reminder, kit reminder, announcement, results published, e-certificate available
Organizer customization (limited): event message, reminder instructions, race day/kit instructions, certificate message
Organizer must NOT edit: payment amount, transaction info, Registration IDs, legal system notices, security elements, RaceDeck transactional footer

39. Email Sender Security
Production sender supports: verified sending domain, SPF, DKIM, DMARC, bounce handling, delivery tracking, rate limiting, retry system, queue processing, template versioning. All transactional email originates from the RaceDeck domain, never a personal organizer inbox.

40. Bib Management
[CORE] Manual/bulk/sequential assignment, category sequences, search, reassign, export, duplicate prevention. Bib remains separate from the registration QR.
[PHASE 2] RFID tag linking

41. Race Kit Configuration
Event- and category-specific inclusions (e.g., 5K: shirt + bib; 21K: shirt + bib + bag + towel). Entities: race_kit_configs, race_kit_items. No full inventory ERP required for MVP.

42. Race Kit Claiming
Organizer staff: scan QR or manual lookup, validate registration = Confirmed and payment = Paid, display participant/category/bib/kit, prevent duplicate claim, mark claimed, store timestamp + claiming staff (claim history)
Participant view: claiming schedule, location, QR, bib, kit inclusions, claimed/unclaimed, claim timestamp
[OPTIONAL] Proxy claiming

43. Results Management
Result Import Batch [CORE] — entity result_batches, one per CSV import. Stores event, file reference, imported by/date, validation status, publication status, published date.
Workflow: Upload CSV → Validate → Preview → Identify unmatched bibs → Correct → Publish
Result Row fields: bib, registration, participant, category, gun time, chip time, overall rank, classification rank, category rank, participant result status

44. Result Statuses
Result Batch Publication Status: Draft · Published
Participant Result Status: Finished · DNF · DNS · DQ
(These are two distinct status concepts — never mixed.)
On publish → triggers §35.7 notification.

45. Optional E-Certificate System
E-Certificate is optional per event, default Disabled. Organizer enables it via Event Setup → Certificate Settings (§20).
Organizer Certificate Settings: enable/disable, certificate title, template, event logo, organizer logo, sponsor logos, authorized signature image, signatory name/position, certificate message
Eligibility options: all Finished participants, selected categories, organizer-defined eligible results
Recommended default: only participants with Participant Result Status = Finished
Certificate fields: participant full name, event name, category, event date, bib, finish time (if available), rank (if applicable), certificate reference, QR/verification code, organizer, signature
Flow: Result Batch Published (§44) → Certificate Eligibility Determined → Certificate Generated → Stored Securely → §35.8 Email Sent
Accessible via My Races → Event → Certificate.

46. Certificate Verification
Each certificate receives a unique certificate ID, verification URL/token, and QR code.
Public verification page shows: participant, event, category, date, certificate validity — without exposing unnecessary personal information.

47. Organizer Payments
Gross Registration Sales − Refunds − RaceDeck/Processing Fees (when organizer-borne) = Net Organizer Revenue → Payout

48. Platform Fee Configuration
[CORE] Fixed, percentage, or fixed+percentage. Fee bearer: Participant Pays or Organizer Absorbs.
Example: Registration ₱1,000, RaceDeck Fee ₱40 → Participant Pays: ₱1,040 (or Organizer Absorbs: participant pays ₱1,000, organizer nets ₱960)
[PHASE 2] Organization-specific negotiated rates

49. Refunds
[CORE] Search transaction, view payment/registration, full or partial refund (gateway-dependent), refund reason, initiated by, gateway reference, refund history
Status: Pending · Processing · Completed · Failed · Cancelled
On Completed → triggers §35.6

50. Organizer Payouts
Dashboard: Available Balance, Pending Balance, Total Paid Out, Net Organizer Revenue
Payout record: reference, amount, destination, initiated/completed dates, status
Status: Pending · Processing · Paid · Failed · Cancelled
MVP: manually approved/processed by RaceDeck. [PHASE 2] Automated payout schedule.

51. Organizer Reports
[CORE] Registrations, event performance, gross sales, discounts, refunds, RaceDeck fees, net revenue, payments, payouts, category performance, kit claiming, email delivery, results, certificates issued
[PHASE 2] Repeat runners, demographics, conversion, cohort analytics

52. RaceDeck Admin Sidebar
Dashboard
Management: Organizers · Events · Participants
Finance: Transactions · Refunds · Payouts · Platform Fees · Reconciliation
Platform: Content Management · Email Delivery · Support/Issues · Roles & Permissions · Audit Logs · Platform Settings

53. Admin Dashboard
[CORE] Total/Active Organizers, Pending Organizer Reviews, Total/Active Events, Events Pending Review, Total Registrations, Gross Registration Volume, RaceDeck Fee Revenue, Organizer Payables, Recent Transactions, Upcoming Major Races

54. Organizer Management — Admin
Search/filter, review applications/documents, approve/request changes/reject, suspend/reactivate, view organization/team/events/financials/payouts/audit history

55. Admin Event Management
Search/filter all events, review submission, request changes, approve/reject, publish/unpublish, feature, cancel/suspend listing, view registrations summary/finance summary/status history

56. Admin Participant Management
Search participant, view account, registration/payment/race history, account status, support-related actions. Admins should not casually modify results or registrations without explicit permission.

57. Email Delivery — Admin
[CORE] Total sent/delivered/failed/bounced/queued, delivery rate, failed transactional messages
Search by: recipient, event, organizer, registration, email type
Actions: view email, retry failed, view delivery provider response, suppress invalid recipient where necessary

58. Finance Reconciliation
[CORE]
Payment Gateway Total vs. RaceDeck Recorded Payments − Refunds = Net Collected → then RaceDeck Fees, Organizer Payable, Payouts Sent. Highlight discrepancies. Not a replacement for accounting software.

59. Content Management
[CORE] Featured race, homepage banner, homepage sections, public announcements
[OPTIONAL] Full CMS for About/Services/FAQs/Policies (may be code-managed initially)

60. Support / Issues
MVP: basic support records — participant/organizer concern, registration/payment/refund/kit issue
Status: Open · In Progress · Resolved · Closed
[PHASE 2] Full ticketing system

61. RaceDeck Internal Roles
Super Admin — full platform access
Admin — organizer/event management
Finance — transactions, refunds, payouts, fees, reconciliation
Support — participants, organizers, support cases, limited registration/payment lookup
Use granular permissions rather than hardcoded UI assumptions.

62. Audit Logs
[CORE] Tracks: organizer/event approval, event changes, registration changes, payment changes, refund/payout actions, bib changes, kit claims, result publication, certificate generation, email resend, role changes, platform settings
Stored: actor, action, resource, timestamp, previous value (where appropriate), new value, IP/device context (where appropriate)

63. Notifications
Participant (automatic): registration created, payment pending/confirmation/failure, registration confirmation, receipt/invoice available, refund completed, kit available/deadline, event reminder, organizer announcement, race tomorrow, results published, e-certificate ready
Organizer: organizer verification result, event review result, new registration, payment notification, refund, payout notice, important delivery failure
Channels: In-App, Email [CORE] · SMS, Push [PHASE 2]

64. Legal Architecture
Two fully separate systems:
RaceDeck Platform Legal — Terms & Conditions, Privacy Policy — tracked per user/version
Event Waiver — specific to one event, accepted during registration — tracked per registration/version
Old accepted versions are never overwritten.

65. Security Requirements
[CORE] HTTPS, secure password hashing, secure session handling, rate limiting, RBAC, organization-scoped authorization, row-level security where supported, server-side validation, secure file uploads, signed/private file access, payment webhook signature verification, payment idempotency, secure QR tokens, audit logs, PII encryption, backups, disaster recovery, session revocation, cross-tenant ID enumeration protection, email sender domain authentication
2FA: Required — Super Admin. Strongly recommended — Admin, Finance. Optional — Organizer Owner.

66. Data Privacy (Philippine Data Privacy Act)
[CORE] Clear Privacy Policy, consent where required, purpose limitation, PII access controls, access/correction requests, account/data deletion workflow (where legally permitted), retention policy, security incident procedure, sensitive information protection

67. Final Database Modules
Identity/Access: users, user_profiles, organizations, organization_members, organization_roles, permissions, role_permissions
Organizer: organizer_verifications, organization_payout_accounts
Events: events, event_status_history, event_review_history, event_schedules, event_routes, event_partners, race_categories
Registration: event_registration_fields, event_registration_field_options, registration_holds, registrations, registration_responses, registration_status_history
Payments: payments, payment_transactions, payment_webhook_events, refunds, platform_fees
Documents: payment_receipts, invoices
Promo: promo_codes, promo_code_redemptions
Race Operations: bibs, race_kit_configs, race_kit_items, race_kit_claims
Communication: announcements, notifications, notification_deliveries, email_templates, email_messages, email_delivery_logs, event_reminder_settings
Results: result_batches, results
Certificates: certificate_templates, event_certificate_settings, certificates
Finance: payouts, finance_reconciliation_records
Legal: legal_documents, legal_acceptances, event_waivers, event_waiver_acceptances
Platform: support_cases, audit_logs, content_blocks

68. Core Relationships
User
 └── Organization Membership
      └── Organization
           ├── Events
           │    ├── Race Categories
           │    ├── Registration Form Fields
           │    ├── Promo Codes
           │    ├── Announcements
           │    ├── Result Batches
           │    └── Certificate Settings
           └── Payouts


Participant/User
 └── Registration
      ├── Event
      ├── Race Category
      ├── Registration Responses
      ├── Payment → Receipt / Invoice
      ├── Digital Registration QR
      ├── Bib
      ├── Race Kit Claim
      ├── Result
      ├── Certificate
      └── Email Delivery History


69. Final MVP Scope
Public: Marketing · Events · Event Details · Public Results · Organizer Profile · Legal pages
Participant: Account · Registration · Payments · My Races · QR · Bib · Kit info · Results · Certificates · Notifications · Profile
Organizer: Verification · Organization profile · Dashboard · Team Members · Events · Event Workspace · Registrations · Payments · Payouts · Reports
Event Operations: Categories · Capacity · Slot holds · Registration form · Promo codes · Bibs · QR · Race kits · Announcements · Results import/publication · Certificate settings
Transactional Email [CORE]: registration pending, payment confirmation, registration confirmation, QR/ticket, receipt, invoice (where configured), payment failure, refund notification, race reminders, kit reminders, organizer announcements, results published, e-certificate ready
E-Certificate [OPTIONAL PER EVENT]: enable/disable, template, generation, email delivery, download, verification
Admin: Organizers · Events · Participants · Finance · Email Delivery · Content · Support · Roles · Audit · Settings
Finance: Transactions · Payment webhooks · Refunds · Fees · Fee bearer · Payouts · Reconciliation
Security: Multi-tenancy · Authorization · Audit logs · Webhook verification · Secure QR · Privacy controls (Data Privacy Act) · Backups · Super Admin 2FA · Email sender domain authentication

70. Features Explicitly Not Needed for MVP
Native participant/organizer mobile apps, social feed, runner messaging, reviews/ratings, AI running coach, GPS live tracking, international currencies, generic event ticketing, merchandise marketplace, complex CRM, full accounting platform, marketing automation, RFID hardware.
Future (Phase 2+): RFID/chip timing, live race results, live leaderboard, SMS, push notifications, live participant tracking, automated payout scheduling, full ticketing system, negotiated organizer fee rates.

71. Final Production Navigation
Participant: Dashboard · My Races · Results · Payments · Notifications · Profile
Organizer: Dashboard · Events · Registrations · Payments · Payouts · Reports · Team Members · Organization · Settings
Event Workspace: Overview · Event Setup (Event Details, Categories & Pricing, Registration Form, Event Waiver, Race Kit Configuration, Email & Reminders, Certificate Settings) · Registrations · Promo Codes · Bib Management · Race Kit Claiming · Announcements · Results · Reports · Settings
RaceDeck Admin: Dashboard · Management (Organizers, Events, Participants) · Finance (Transactions, Refunds, Payouts, Platform Fees, Reconciliation) · Platform (Content Management, Email Delivery, Support/Issues, Roles & Permissions, Audit Logs, Platform Settings)

Final RaceDeck Principle
RaceDeck operates as a self-service SaaS platform. The Organizer manages their organization and events. RaceDeck Admin verifies organizers, reviews events, manages platform finance, and maintains platform integrity. Participants register and pay online.
After successful payment, RaceDeck automatically:
Confirms Registration → Generates QR/Ticket → Generates Receipt (+ Invoice if configured) → Sends Confirmation Email → Schedules Event Reminders → Sends Race-Kit Notifications → Sends Results Notification → Sends E-Certificate (if enabled)
— a complete end-to-end race registration and organizer management platform, without requiring RaceDeck staff to manually handle every registration or event.
t
