-- Trigger functions execute through their triggers and are not RPC endpoints.
-- Remove the default PUBLIC execute privilege from these SECURITY DEFINER helpers.
revoke execute on function public.guard_reviewed_event_details() from public, anon, authenticated;
revoke execute on function public.guard_event_review_snapshot() from public, anon, authenticated;
revoke execute on function public.guard_nested_event_review_snapshot() from public, anon, authenticated;
revoke execute on function public.guard_registration_hold_window() from public, anon, authenticated;
revoke execute on function public.guard_event_merchandise_review_snapshot() from public, anon, authenticated;
