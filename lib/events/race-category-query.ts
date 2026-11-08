import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type RaceCategoryRow = {
  id: string;
  event_id: string;
  name: string;
  category_group_name: string | null;
  distance_km: number | null;
  registration_fee: number;
  early_bird_fee: number | null;
  early_bird_deadline: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  registration_availability: string;
  max_slots: number | null;
  confirmed_count: number;
};

const CATEGORY_FIELDS = 'id,event_id,name,category_group_name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,registration_opens_at,registration_closes_at,registration_availability,max_slots,confirmed_count';
const WITHOUT_SCHEDULE_FIELDS = 'id,event_id,name,category_group_name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,registration_availability,max_slots,confirmed_count';
const WITHOUT_GROUP_FIELDS = 'id,event_id,name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,registration_availability,max_slots,confirmed_count';
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
  const read = async (fields: string) => {
    let query = client
      .from('race_categories')
      .select(fields)
      .eq('event_id', eventId);
    if (categoryIds) query = query.in('id', categoryIds);
    return query;
  };

  let result = await read(CATEGORY_FIELDS) as unknown as CategoryQueryResult;
  if (result.error?.code === '42703') {
    // Keep public registration readable while a deployment is applying the
    // optional category schedule/group migration. Retry progressively smaller
    // projections instead of assuming which missing column PostgREST reports first.
    result = await read(WITHOUT_SCHEDULE_FIELDS) as unknown as CategoryQueryResult;
    if (result.error?.code === '42703') result = await read(WITHOUT_GROUP_FIELDS) as unknown as CategoryQueryResult;
    if (result.error?.code === '42703') result = await read(LEGACY_CATEGORY_FIELDS) as unknown as CategoryQueryResult;
  }

  return {
    data: (result.data ?? []).map((category) => ({
      ...category,
      early_bird_fee: category.early_bird_fee ?? null,
      early_bird_deadline: category.early_bird_deadline ?? null,
      category_group_name: category.category_group_name ?? null,
      registration_opens_at: category.registration_opens_at ?? null,
      registration_closes_at: category.registration_closes_at ?? null,
    })) as RaceCategoryRow[],
    error: result.error,
  };
}
