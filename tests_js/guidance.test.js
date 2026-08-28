import test from 'node:test';
import assert from 'node:assert/strict';

import { buildContributionGuidance } from '../js/guidance.js';
import { projectPlan } from '../js/projection.js';

const base = {
  birth: '1983-01', category: 'base60', now: { year: 2026, month: 8 },
  paidYears: 8, stopWorkAge: 50, contributionEndAge: 52, claimAgeMonths: 60 * 12,
  monthlyContributionBase: 7000, avgIndex: 1, currentAccount: 50000,
  currentCalcBase: 7000, wageGrowth: 0.03, accountInterest: 0.03, inflation: 0.02,
};

test('guidance recommends extending contribution when shortage can be fixed before claim', () => {
  const result = projectPlan(base);
  const g = buildContributionGuidance(base, result);
  assert.equal(g.eligible, false);
  assert.ok(g.shortageYears > 0);
  assert.equal(g.canFixBeforeClaim, true);
  assert.ok(g.recommendedContributionEndAge > base.contributionEndAge);
  assert.ok(g.recommendedContributionEndAge <= base.claimAgeMonths / 12);
});

test('guidance returns no shortage for an eligible plan', () => {
  const input = { ...base, paidYears: 18, contributionEndAge: 55 };
  const result = projectPlan(input);
  const g = buildContributionGuidance(input, result);
  assert.equal(g.eligible, true);
  assert.equal(g.shortageYears, 0);
});

test('guidance checks whether paying until claim age is enough', () => {
  const input = { ...base, paidYears: 1, contributionEndAge: 50 };
  const result = projectPlan(input);
  const g = buildContributionGuidance(input, result);
  assert.equal(g.eligible, false);
  assert.equal(typeof g.claimOnlyEligible, 'boolean');
  assert.ok(g.claimOnlyShortageYears >= 0);
});
