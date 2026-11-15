import { describe, expect, it } from 'vitest';
import { raceKitEligibility } from './claiming';

describe('raceKitEligibility', () => {
  const eligibleParticipant = { registrationStatus: 'confirmed', paymentStatus: 'succeeded', hasActiveKit: true, alreadyClaimed: false };

  it('allows a confirmed paid participant with a kit configuration even without a bib', () => {
    expect(raceKitEligibility(eligibleParticipant)).toEqual({ eligible: true, message: null });
  });

  it('requires a confirmed registration and a successful payment', () => {
    expect(raceKitEligibility({ ...eligibleParticipant, registrationStatus: 'pending_payment' }).eligible).toBe(false);
    expect(raceKitEligibility({ ...eligibleParticipant, paymentStatus: 'pending' }).message).toBe('A successful payment is required');
  });

  it('rejects participants without an active kit configuration', () => {
    expect(raceKitEligibility({ ...eligibleParticipant, hasActiveKit: false })).toEqual({ eligible: false, message: 'No active race-kit configuration exists' });
  });

  it('blocks a repeat claim and returns the duplicate state first', () => {
    expect(raceKitEligibility({ ...eligibleParticipant, alreadyClaimed: true })).toEqual({ eligible: false, message: 'Race kit already claimed' });
  });
});
