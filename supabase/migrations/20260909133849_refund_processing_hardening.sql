-- Atomic refund reservation and settlement helpers. These are deliberately
-- service-role-only because gateway confirmation remains server driven.

create or replace function public.create_refund_request(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text,
  p_requested_by uuid
)
returns public.refunds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_existing public.refunds;
  v_reserved numeric(12,2);
  v_transaction_id uuid;
  v_refund public.refunds;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;
  if p_reason not in ('duplicate', 'fraudulent', 'requested_by_customer', 'others') then
    raise exception 'Refund reason is invalid';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'Refund idempotency key is required';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment was not found';
  end if;
  if v_payment.status not in ('succeeded', 'partially_refunded') or v_payment.amount_paid <= 0 then
    raise exception 'Only successful payments with a remaining balance can be refunded';
  end if;

  select * into v_existing
  from public.refunds
  where gateway = v_payment.gateway and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payment_id <> v_payment.id or v_existing.amount <> p_amount then
      raise exception 'Refund idempotency key conflicts with a different request';
    end if;
    return v_existing;
  end if;

  select coalesce(sum(amount), 0) into v_reserved
  from public.refunds
  where payment_id = v_payment.id and status in ('pending', 'processing', 'succeeded');
  if v_reserved + p_amount > v_payment.amount_paid then
    raise exception 'Refund exceeds the remaining refundable balance';
  end if;

  select id into v_transaction_id
  from public.payment_transactions
  where payment_id = v_payment.id
    and transaction_type = 'payment'
    and status = 'succeeded'
    and gateway_transaction_id is not null
  order by processed_at desc nulls last, created_at desc
  limit 1;
  if v_transaction_id is null then
    raise exception 'Verified gateway payment reference is unavailable';
  end if;

  insert into public.refunds (
    payment_id, transaction_id, registration_id, event_id, organization_id,
    gateway, idempotency_key, amount, currency, reason, status, requested_by
  ) values (
    v_payment.id, v_transaction_id, v_payment.registration_id, v_payment.event_id, v_payment.organization_id,
    v_payment.gateway, p_idempotency_key, p_amount, v_payment.currency, p_reason, 'pending', p_requested_by
  ) returning * into v_refund;
  return v_refund;
end;
$$;

create or replace function public.apply_refund_gateway_result(
  p_refund_id uuid,
  p_gateway_refund_id text,
  p_status refund_status,
  p_failure_code text default null,
  p_failure_message text default null
)
returns public.refunds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refunds;
  v_payment public.payments;
  v_transaction_id uuid;
  v_attempt integer;
  v_amount_refunded numeric(12,2);
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'Refund was not found'; end if;
  select * into v_payment from public.payments where id = v_refund.payment_id for update;
  if not found then raise exception 'Payment was not found'; end if;

  if v_refund.status = 'succeeded' then return v_refund; end if;
  if p_status = 'succeeded' and (p_gateway_refund_id is null or btrim(p_gateway_refund_id) = '') then
    raise exception 'Successful refunds require a gateway refund reference';
  end if;

  select id into v_transaction_id from public.payment_transactions
  where gateway = v_refund.gateway and idempotency_key = 'refund:' || v_refund.id::text;
  if v_transaction_id is null then
    select coalesce(max(attempt_number), 0) + 1 into v_attempt
    from public.payment_transactions where payment_id = v_payment.id;
    insert into public.payment_transactions (
      payment_id, registration_id, event_id, organization_id, attempt_number,
      gateway, gateway_transaction_id, idempotency_key, transaction_type, status,
      amount, currency, processed_at, failure_code, failure_message
    ) values (
      v_payment.id, v_payment.registration_id, v_payment.event_id, v_payment.organization_id, v_attempt,
      v_refund.gateway, p_gateway_refund_id, 'refund:' || v_refund.id::text, 'refund',
      case when p_status = 'succeeded' then 'refunded'::payment_transaction_status when p_status = 'failed' then 'failed'::payment_transaction_status else 'processing'::payment_transaction_status end,
      v_refund.amount, v_refund.currency, case when p_status in ('succeeded', 'failed') then now() else null end, p_failure_code, p_failure_message
    ) returning id into v_transaction_id;
  else
    update public.payment_transactions set
      gateway_transaction_id = coalesce(p_gateway_refund_id, gateway_transaction_id),
      status = case when p_status = 'succeeded' then 'refunded'::payment_transaction_status when p_status = 'failed' then 'failed'::payment_transaction_status else 'processing'::payment_transaction_status end,
      processed_at = case when p_status in ('succeeded', 'failed') then now() else processed_at end,
      failure_code = case when p_status = 'failed' then p_failure_code else null end,
      failure_message = case when p_status = 'failed' then p_failure_message else null end
    where id = v_transaction_id;
  end if;

  update public.refunds set
    transaction_id = v_transaction_id,
    gateway_refund_id = coalesce(p_gateway_refund_id, gateway_refund_id),
    status = p_status,
    failure_code = case when p_status = 'failed' then p_failure_code else null end,
    failure_message = case when p_status = 'failed' then p_failure_message else null end,
    processed_at = case when p_status in ('succeeded', 'failed', 'cancelled') then now() else null end
  where id = v_refund.id
  returning * into v_refund;

  if p_status = 'succeeded' then
    v_amount_refunded := v_payment.amount_refunded + v_refund.amount;
    if v_amount_refunded > v_payment.amount_paid then
      raise exception 'Refund result exceeds the paid amount';
    end if;
    update public.payments set
      amount_refunded = v_amount_refunded,
      status = case when v_amount_refunded = v_payment.amount_paid then 'refunded'::payment_status else 'partially_refunded'::payment_status end
    where id = v_payment.id;
    if v_amount_refunded = v_payment.amount_paid then
      perform public.release_registration_slot(v_payment.registration_id, 'refunded');
    end if;
    insert into public.registration_activity (registration_id, action, metadata)
    values (v_payment.registration_id, 'refund_processed', jsonb_build_object('refund_id', v_refund.id, 'amount', v_refund.amount, 'gateway_refund_id', p_gateway_refund_id));
  end if;
  return v_refund;
end;
$$;

revoke all on function public.create_refund_request(uuid, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function public.apply_refund_gateway_result(uuid, text, refund_status, text, text) from public, anon, authenticated;
grant execute on function public.create_refund_request(uuid, numeric, text, text, uuid) to service_role;
grant execute on function public.apply_refund_gateway_result(uuid, text, refund_status, text, text) to service_role;
