// The reputation program is server-trustworthy (total_donations is RPC-managed),
// so the only thing that can break is the tier math. These tests pin the
// thresholds, the next-tier/progress goal-gradient logic, and the lives-helped
// estimate, and guard the degenerate inputs (negative, NaN, fractional).
import { describe, it, expect } from '@jest/globals';
import {
  getReputationTier,
  nextReputationTier,
  reputationProgress,
  livesHelped,
  REPUTATION_TIERS,
  LIVES_PER_DONATION,
} from '@/lib/reputation';

describe('getReputationTier', () => {
  it.each([
    [0, 'new'],
    [1, 'lifesaver'],
    [2, 'lifesaver'],
    [3, 'regular'],
    [9, 'regular'],
    [10, 'champion'],
    [24, 'champion'],
    [25, 'guardian'],
    [49, 'guardian'],
    [50, 'legend'],
    [500, 'legend'],
  ])('maps %i donations to the %s tier', (n, key) => {
    expect(getReputationTier(n).key).toBe(key);
  });

  it('treats negative, NaN, and fractional counts as the new tier / floored', () => {
    expect(getReputationTier(-5).key).toBe('new');
    expect(getReputationTier(Number.NaN).key).toBe('new');
    expect(getReputationTier(2.9).key).toBe('lifesaver'); // floor(2.9) = 2
  });

  it('keeps the tiers in ascending threshold order', () => {
    for (let i = 1; i < REPUTATION_TIERS.length; i++) {
      expect(REPUTATION_TIERS[i].min).toBeGreaterThan(REPUTATION_TIERS[i - 1].min);
    }
  });
});

describe('nextReputationTier', () => {
  it('points to the next tier up', () => {
    expect(nextReputationTier(0)?.key).toBe('lifesaver');
    expect(nextReputationTier(3)?.key).toBe('champion');
  });
  it('is null at the top tier', () => {
    expect(nextReputationTier(50)).toBeNull();
    expect(nextReputationTier(9001)).toBeNull();
  });
});

describe('reputationProgress', () => {
  it('reports donations remaining to the next tier', () => {
    const p = reputationProgress(7); // regular (3..9), next champion at 10
    expect(p.current.key).toBe('regular');
    expect(p.next?.key).toBe('champion');
    expect(p.remaining).toBe(3);
    expect(p.fraction).toBeGreaterThan(0);
    expect(p.fraction).toBeLessThan(1);
  });

  it('maxes out at the legend tier', () => {
    const p = reputationProgress(60);
    expect(p.current.key).toBe('legend');
    expect(p.next).toBeNull();
    expect(p.remaining).toBe(0);
    expect(p.fraction).toBe(1);
  });

  it('is exactly at the band start when freshly promoted', () => {
    const p = reputationProgress(10); // just hit champion
    expect(p.fraction).toBe(0);
    expect(p.remaining).toBe(15); // guardian at 25
  });
});

describe('livesHelped', () => {
  it('estimates three lives per donation', () => {
    expect(LIVES_PER_DONATION).toBe(3);
    expect(livesHelped(4)).toBe(12);
    expect(livesHelped(0)).toBe(0);
    expect(livesHelped(-3)).toBe(0);
  });
});
