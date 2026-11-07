export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  "Parent / guardian",
  "Spouse / partner",
  "Sibling",
  "Child",
  "Relative",
  "Friend",
  "Other",
] as const;

export function isEmergencyContactRelationship(value: string): boolean {
  return EMERGENCY_CONTACT_RELATIONSHIPS.some((relationship) => relationship === value);
}
