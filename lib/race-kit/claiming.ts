export type RaceKitEligibilityInput = {
  registrationStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  hasActiveKit: boolean;
  alreadyClaimed: boolean;
};

export function raceKitEligibility(input: RaceKitEligibilityInput) {
  if (input.alreadyClaimed) return { eligible: false, message: 'Race kit already claimed' };
  if (input.registrationStatus !== 'confirmed') return { eligible: false, message: 'Registration is not confirmed' };
  if (input.paymentStatus !== 'succeeded') return { eligible: false, message: 'A successful payment is required' };
  if (!input.hasActiveKit) return { eligible: false, message: 'No active race-kit configuration exists' };
  return { eligible: true, message: null };
}
