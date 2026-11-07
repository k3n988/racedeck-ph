import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type RaceCategoryRow = {
  id: string;
  event_id: string;
  name: string;
  distance_km: number | null;
  registration_fee: number;
  early_bird_fee: number | null;
  early_bird_deadline: string | null;
  registration_availability: string;
  max_slots: number | null;
  confirmed_count: number;
};

const CATEGORY_FIELDS = 'id,event_id,name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,registration_availability,max_slots,confirmed_count';
const LEGACY_CATEGORY_FIELDS = 'id,event_id,name,distance_km,registration_fee,registration_availability,max_slots,confirmed_count';
type CategoryQueryResult = {
  data: Array<Record<string, unknown> & Partial<RaceCategoryRow>> | null;
  error: { code?: string; message: string } | null;
};

/**
 * Reads categories across deployments that have not yet applied the optional
 * Early Bird pricing migration. Regular registration pricing remains usable;
 * when the columns exist, their values are returned and honored normally.
 */
export async function getRaceCategoryRows(
  client: SupabaseClient,
  eventId: string,
  categoryIds?: string[],
) {
  const read = async (includeEarlyBird: boolean) => {
    let query = client
      .from('race_categories')
      .select(includeEarlyBird ? CATEGORY_FIELDS : LEGACY_CATEGORY_FIELDS)
      .eq('event_id', eventId);
    if (categoryIds) query = query.in('id', categoryIds);
    return query;
  };

  let result = await read(true) as unknown as CategoryQueryResult;
  if (
    result.error?.code === '42703' &&
    /early_bird_(fee|deadline)/i.test(result.error.message)
  ) {
    result = await read(false) as unknown as CategoryQueryResult;
  }

  return {
    data: (result.data ?? []).map((category) => ({
      ...category,
      early_bird_fee: category.early_bird_fee ?? null,
      early_bird_deadline: category.early_bird_deadline ?? null,
    })) as RaceCategoryRow[],
    error: result.error,
  };
}
