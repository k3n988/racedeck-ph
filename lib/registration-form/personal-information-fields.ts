export const PERSONAL_INFORMATION_FIELDS = [
  { key: 'first_name', label: 'First name', required: true },
  { key: 'middle_name', label: 'Middle name', required: false },
  { key: 'last_name', label: 'Last name', required: true },
  { key: 'birthdate', label: 'Birthdate', required: true },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'email', label: 'Email', required: true },
  { key: 'contact_number', label: 'Contact number', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'emergency_contact', label: 'Emergency contact person', required: true },
  { key: 'emergency_contact_phone', label: 'Emergency contact phone', required: true },
  { key: 'emergency_contact_relationship', label: 'Relationship to participant', required: true },
] as const;

export type PersonalInformationFieldKey = (typeof PERSONAL_INFORMATION_FIELDS)[number]['key'];

export const DEFAULT_PERSONAL_INFORMATION_FIELDS: PersonalInformationFieldKey[] = PERSONAL_INFORMATION_FIELDS
  .filter((field) => field.key !== 'middle_name')
  .map((field) => field.key);
