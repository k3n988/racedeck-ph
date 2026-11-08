type RegistrationQuestion = {
  id: string;
  label: string;
  field_type: string;
  is_required: boolean;
  event_registration_field_options?: Array<{ label?: string; value: string }> | null;
};

export function validateRegistrationAnswers(
  fields: RegistrationQuestion[],
  answers: Record<string, unknown>,
): string | null {
  for (const field of fields) {
    const raw = answers[field.id];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (field.is_required && !value) return `${field.label} is required`;
    if (!value) continue;
    if (value.length > 5000) return `${field.label} must be 5,000 characters or fewer`;

    const options = field.event_registration_field_options ?? [];
    if (field.field_type === 'dropdown' || field.field_type === 'radio') {
      if (!options.some((option) => option.value === value)) return `Choose a valid answer for ${field.label}`;
    }
    if (field.field_type === 'yes_no' && value !== 'yes' && value !== 'no') {
      return `Choose yes or no for ${field.label}`;
    }
    if (field.field_type === 'checkbox' && value !== 'yes') {
      return `Confirm ${field.label}`;
    }
    if (field.field_type === 'multi_select') {
      let parsed: unknown;
      try { parsed = JSON.parse(value); } catch { return `Choose valid answers for ${field.label}`; }
      const selected = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { selected?: unknown }).selected)
          ? (parsed as { selected: unknown[] }).selected
          : null;
      const other = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as { other?: unknown }).other === 'string'
        ? ((parsed as { other: string }).other).trim()
        : '';
      if (!selected || selected.some((item) => typeof item !== 'string')) return `Choose valid answers for ${field.label}`;
      const values = selected as string[];
      const allowed = new Set(options.map((option) => option.value));
      if (values.some((item) => !allowed.has(item)) || new Set(values).size !== values.length) return `Choose valid answers for ${field.label}`;
      if (field.is_required && values.length === 0) return `${field.label} is required`;
      const otherOption = options.find((option) => option.value.toLowerCase() === 'other' || option.label?.toLowerCase().startsWith('other'));
      if (otherOption && values.includes(otherOption.value) && !other) return `Please specify your answer for ${field.label}`;
      if (other.length > 500) return `Other answer for ${field.label} must be 500 characters or fewer`;
    }
  }
  return null;
}
