// Blood compatibility is the one rule in this app that absolutely cannot drift:
// a wrong entry here means matching a recipient with blood that could kill them.
// These tests pin the matrix against transfusion-medicine ground truth and prove
// the two directions (donate-to / receive-from) stay mutual inverses.
import { describe, it, expect } from '@jest/globals';
import {
  BLOOD_GROUPS,
  COMPATIBILITY_MAP,
  DONOR_FOR_RECIPIENT,
  type BloodGroup,
} from '@/constants/BloodData';

describe('blood compatibility matrix', () => {
  it('covers all eight groups in both directions', () => {
    expect(BLOOD_GROUPS).toHaveLength(8);
    for (const g of BLOOD_GROUPS) {
      expect(COMPATIBILITY_MAP[g]).toBeDefined();
      expect(DONOR_FOR_RECIPIENT[g]).toBeDefined();
    }
  });

  it('treats O- as the universal donor', () => {
    // O- can give to every group.
    expect([...COMPATIBILITY_MAP['O-']].sort()).toEqual([...BLOOD_GROUPS].sort());
    // ...and an O- recipient can only receive O-.
    expect(DONOR_FOR_RECIPIENT['O-']).toEqual(['O-']);
  });

  it('treats AB+ as the universal recipient', () => {
    // AB+ can receive from everyone.
    expect([...DONOR_FOR_RECIPIENT['AB+']].sort()).toEqual([...BLOOD_GROUPS].sort());
    // ...and an AB+ donor can only give to AB+.
    expect(COMPATIBILITY_MAP['AB+']).toEqual(['AB+']);
  });

  it('keeps the two maps as exact inverses', () => {
    // donor D can give to recipient R  <=>  R can receive from D.
    for (const donor of BLOOD_GROUPS) {
      for (const recipient of COMPATIBILITY_MAP[donor]) {
        expect(DONOR_FOR_RECIPIENT[recipient]).toContain(donor);
      }
    }
    for (const recipient of BLOOD_GROUPS) {
      for (const donor of DONOR_FOR_RECIPIENT[recipient]) {
        expect(COMPATIBILITY_MAP[donor]).toContain(recipient);
      }
    }
  });

  it('respects Rh: a negative recipient never accepts positive blood', () => {
    const isPositive = (g: BloodGroup) => g.endsWith('+');
    for (const recipient of BLOOD_GROUPS) {
      if (isPositive(recipient)) continue;
      for (const donor of DONOR_FOR_RECIPIENT[recipient]) {
        expect(isPositive(donor)).toBe(false);
      }
    }
  });

  it('never lists a donor twice for the same recipient', () => {
    for (const recipient of BLOOD_GROUPS) {
      const donors = DONOR_FOR_RECIPIENT[recipient];
      expect(new Set(donors).size).toBe(donors.length);
    }
  });
});
