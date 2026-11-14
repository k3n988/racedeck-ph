import { z } from 'zod';
import { RACE_KIT_CLAIMING_ITEM, RACE_KIT_DELIVERY_OPTION } from '@/lib/events/race-kit';

const variantOptionSchema = z.union([
  z.string().trim().min(1).max(160),
  z.object({
    name: z.string().trim().min(1).max(160),
    slots: z.number().int().min(0).max(1000000).nullable(),
  }),
]);

const detailsSchema = z.object({
  kind: z.enum(['product', 'text_inclusion']).optional(),
  description: z.string().max(1000).nullable().optional(),
  variants: z.array(variantOptionSchema).max(41).optional(),
  product_image_urls: z.array(z.string().url()).max(8).optional(),
  reference_image_url: z.string().url().nullable().optional(),
}).passthrough();

export const raceKitItemSchema = z.object({
  item_code: z.string().trim().min(1).max(80),
  item_name: z.string().trim().min(1).max(160),
  quantity: z.number().int().positive().max(100),
  details: detailsSchema.default({}),
  is_required: z.boolean().default(true),
  is_active: z.boolean().default(true),
  display_order: z.number().int().nonnegative().default(0),
}).superRefine((item, context) => {
  const options = item.details.variants ?? [];
  const names = options.map((option) => typeof option === 'string' ? option.trim() : option.name.trim());
  const isClaimingItem = item.item_name.toLocaleLowerCase() === RACE_KIT_CLAIMING_ITEM.toLocaleLowerCase();
  const pickupLocations = names.filter((name) => name.toLocaleLowerCase() !== RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase());
  if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['details', 'variants'], message: 'Race kit options must be unique.' });
  }
  if (!isClaimingItem && options.length > 40) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['details', 'variants'], message: 'Race kit products can have at most 40 options.' });
  }
  if (!isClaimingItem && names.some((name) => name.length > 80)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['details', 'variants'], message: 'Product options must be 80 characters or fewer.' });
  }
  if (isClaimingItem && (pickupLocations.length > 40 || pickupLocations.some((name) => name.length > 160))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['details', 'variants'], message: 'Race kit claiming allows up to 40 pickup locations, each 160 characters or fewer.' });
  }
  if (isClaimingItem && names.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['details', 'variants'], message: 'Add a pickup location or enable Race Kit Delivery.' });
  }
}).transform((item) => ({
  ...item,
  // Older saved items may not have a `kind`; treat them as products so a
  // status-only update cannot silently make an existing choice optional.
  is_required: item.details.kind !== 'text_inclusion' && Boolean(item.details.variants?.length),
}));
