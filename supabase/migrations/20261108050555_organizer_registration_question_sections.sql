-- Organizers can group registration questions and offer multi-select answers.
-- The existing response table stores answers as text, so multi-select values
-- are serialized as JSON arrays by the registration API.
ALTER TYPE public.custom_field_type ADD VALUE IF NOT EXISTS 'multi_select';

ALTER TABLE public.event_registration_fields
  ADD COLUMN IF NOT EXISTS section_key text NOT NULL DEFAULT 'additional';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_registration_fields_section_key_check'
      AND conrelid = 'public.event_registration_fields'::regclass
  ) THEN
    ALTER TABLE public.event_registration_fields
      ADD CONSTRAINT event_registration_fields_section_key_check
      CHECK (section_key IN ('additional', 'health'));
  END IF;
END;
$$;
