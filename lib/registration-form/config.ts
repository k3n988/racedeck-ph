export const CUSTOM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'dropdown',
  'radio',
  'checkbox',
  'yes_no',
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  dropdown: 'Dropdown',
  radio: 'Radio',
  checkbox: 'Checkbox',
  yes_no: 'Yes / No',
};

const SYSTEM_FIELD_LABELS = new Set([
  'firstname',
  'lastname',
  'birthdate',
  'email',
  'mobile',
  'mobilenumber',
  'address',
  'emergencycontactname',
  'emergencycontactnumber',
  'shirtsize',
  'competitionclassification',
]);

export function isSystemRegistrationFieldLabel(label: string): boolean {
  return SYSTEM_FIELD_LABELS.has(label.toLowerCase().replace(/[^a-z0-9]/g, ''));
}
