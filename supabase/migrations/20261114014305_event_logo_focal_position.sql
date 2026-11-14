-- Persist a square focal point for event logo thumbnails. The original image
-- stays unchanged; all event logo previews use these coordinates consistently.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS logo_position_x smallint NOT NULL DEFAULT 50
    CHECK (logo_position_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS logo_position_y smallint NOT NULL DEFAULT 50
    CHECK (logo_position_y BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS logo_zoom numeric(3,2) NOT NULL DEFAULT 1.00
    CHECK (logo_zoom >= 1.00 AND logo_zoom <= 2.00);
