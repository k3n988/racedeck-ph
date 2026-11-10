-- Persist the organizer-selected focal point for wide event banner crops.
-- The original uploaded asset remains unchanged; renderers use these values
-- with object-position and scale so cards, hero banners, and previews agree.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS banner_position_x smallint NOT NULL DEFAULT 50
    CHECK (banner_position_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS banner_position_y smallint NOT NULL DEFAULT 50
    CHECK (banner_position_y BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS banner_zoom numeric(3,2) NOT NULL DEFAULT 1.00
    CHECK (banner_zoom >= 1.00 AND banner_zoom <= 2.00);
