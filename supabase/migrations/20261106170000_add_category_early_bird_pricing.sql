alter table public.race_categories
  add column early_bird_fee numeric(10,2),
  add column early_bird_deadline timestamptz;

alter table public.race_categories
  add constraint race_categories_early_bird_pair_check
    check ((early_bird_fee is null) = (early_bird_deadline is null)),
  add constraint race_categories_early_bird_fee_check
    check (early_bird_fee is null or (early_bird_fee >= 0 and early_bird_fee < registration_fee));

comment on column public.race_categories.early_bird_fee is
  'Optional promotional registration fee. Applied only before early_bird_deadline; registration_fee remains the regular fee.';
comment on column public.race_categories.early_bird_deadline is
  'Exclusive cutoff for early_bird_fee. Checkout uses the regular registration_fee at or after this timestamp.';
