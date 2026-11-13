-- PayMongo's configured platform split workflow handles organizer settlement.
-- Remove RaceDeck's manual payout ledger and bank-account profile storage.

drop table if exists public.payouts;
drop table if exists public.organization_payout_accounts;
drop type if exists public.payout_status;
drop function if exists private.validate_payout_record();

alter table public.organizations
  drop column if exists payout_account;

delete from public.internal_role_permissions
where permission_id in (
  select id from public.permissions where key = 'manage_payout_accounts'
);

delete from public.role_permissions
where permission_id in (
  select id from public.permissions where key = 'manage_payout_accounts'
);

delete from public.permissions
where key = 'manage_payout_accounts';

alter table public.finance_reconciliation_records
  drop constraint if exists reconciliation_amounts_nonnegative,
  drop constraint if exists reconciliation_organizer_payable_consistent,
  drop constraint if exists reconciliation_remaining_payable_consistent,
  drop column if exists payouts_sent_amount,
  drop column if exists remaining_payable_amount;

alter table public.finance_reconciliation_records
  rename column organizer_payable_amount to organizer_split_amount;

alter table public.finance_reconciliation_records
  add constraint reconciliation_amounts_nonnegative check (
    gateway_reported_gross_amount >= 0 and recorded_gross_payments >= 0
    and refunds_amount >= 0 and net_collected_amount >= 0
    and (gateway_reported_net_collected_amount is null or gateway_reported_net_collected_amount >= 0)
    and platform_fees_amount >= 0 and processing_fees_amount >= 0
  ),
  add constraint reconciliation_organizer_split_consistent check (
    organizer_split_amount = net_collected_amount - platform_fees_amount
      - processing_fees_amount + other_adjustments_amount
  );
