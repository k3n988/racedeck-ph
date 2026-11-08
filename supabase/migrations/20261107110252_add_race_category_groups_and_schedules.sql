-- Each race distance remains its own category row (and keeps its own price,
-- capacity, kit configuration, and registration window). The optional group
-- label only changes how related distance rows are presented to participants.
ALTER TABLE public.race_categories
  ADD COLUMN IF NOT EXISTS category_group_name text,
  ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.race_categories'::regclass
      AND conname = 'race_categories_group_name_not_blank'
  ) THEN
    ALTER TABLE public.race_categories
      ADD CONSTRAINT race_categories_group_name_not_blank
      CHECK (category_group_name IS NULL OR length(btrim(category_group_name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.race_categories'::regclass
      AND conname = 'race_categories_registration_window_valid'
  ) THEN
    ALTER TABLE public.race_categories
      ADD CONSTRAINT race_categories_registration_window_valid
      CHECK (
        (registration_opens_at IS NULL AND registration_closes_at IS NULL)
        OR (registration_opens_at IS NOT NULL AND registration_closes_at IS NOT NULL
            AND registration_opens_at < registration_closes_at)
      );
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS race_categories_event_group_distance_idx
  ON public.race_categories (event_id, category_group_name, distance_km);
