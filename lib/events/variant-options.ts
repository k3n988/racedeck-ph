export type VariantOption = {
  name: string;
  slots: number | null;
};

/** Accept legacy string options and capacity-aware JSONB option objects. */
export function parseVariantOptions(value: unknown): VariantOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((option): VariantOption[] => {
    if (typeof option === 'string') {
      const name = option.trim();
      return name ? [{ name, slots: null }] : [];
    }
    if (!option || typeof option !== 'object' || Array.isArray(option)) return [];

    const record = option as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) return [];
    const slots = typeof record.slots === 'number' && Number.isSafeInteger(record.slots) && record.slots >= 0
      ? record.slots
      : null;
    return [{ name, slots }];
  });
}

export function variantOptionsPayload(names: string[], slotsByName: Record<string, string>) {
  return names.map((name) => ({ name, slots: slotsByName[name]?.trim() ? Number(slotsByName[name]) : null }));
}
