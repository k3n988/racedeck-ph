import type { SupabaseClient } from '@supabase/supabase-js';

export type VariantUsage = {
  kit: Map<string, number>;
  merchandise: Map<string, number>;
};

const key = (itemId: string, variant: string) => `${itemId}\u0000${variant}`;

/** Counts pending-payment and confirmed registrations against configured option slots. */
export async function loadVariantUsage(admin: SupabaseClient, eventId: string): Promise<VariantUsage> {
  const { data: registrations, error: registrationError } = await admin
    .from('registrations')
    .select('id')
    .eq('event_id', eventId)
    .in('status', ['pending_payment', 'confirmed']);
  if (registrationError) throw registrationError;

  const registrationIds = (registrations ?? []).map((registration) => registration.id);
  const usage: VariantUsage = { kit: new Map(), merchandise: new Map() };
  if (!registrationIds.length) return usage;

  const [{ data: activities, error: activityError }, { data: merchandiseLines, error: merchandiseError }] = await Promise.all([
    admin.from('registration_activity').select('metadata').eq('action', 'created').in('registration_id', registrationIds),
    admin.from('registration_merchandise').select('event_merchandise_id,variant,quantity').in('registration_id', registrationIds),
  ]);
  if (activityError) throw activityError;
  if (merchandiseError) throw merchandiseError;

  for (const activity of activities ?? []) {
    const metadata = activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
      ? activity.metadata as Record<string, unknown>
      : {};
    const selections = Array.isArray(metadata.race_kit_selections) ? metadata.race_kit_selections : [];
    for (const selection of selections) {
      if (!selection || typeof selection !== 'object' || Array.isArray(selection)) continue;
      const row = selection as Record<string, unknown>;
      if (typeof row.item_id !== 'string' || typeof row.variant !== 'string') continue;
      const usageKey = key(row.item_id, row.variant);
      usage.kit.set(usageKey, (usage.kit.get(usageKey) ?? 0) + 1);
    }
  }

  for (const line of merchandiseLines ?? []) {
    if (typeof line.variant !== 'string') continue;
    const usageKey = key(line.event_merchandise_id, line.variant);
    usage.merchandise.set(usageKey, (usage.merchandise.get(usageKey) ?? 0) + line.quantity);
  }

  return usage;
}

export function variantUsageKey(itemId: string, variant: string) {
  return key(itemId, variant);
}

export function hasVariantSlots(option: { slots: number | null }, used: number, requested = 1) {
  return option.slots === null || used + requested <= option.slots;
}
