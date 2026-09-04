import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIDENT_ACCOUNT_DIVISOR,
  RESIDENT_MIN_CONTRIBUTION_YEARS,
  projectResidentPension,
  residentClaimDate,
} from '../js/resident.js';

test('resident pension uses age 60, 15 years and divisor 139', () => {
  assert.equal(RESIDENT_MIN_CONTRIBUTION_YEARS, 15);
  assert.equal(RESIDENT_ACCOUNT_DIVISOR, 139);
  assert.deepEqual(residentClaimDate('1980-03'), { year: 2040, month: 3 });
});

test('resident plan can satisfy 15 years by continuing contributions', () => {
  const r = projectResidentPension({
    birth: '1980-01', now: { year: 2026, month: 8 }, paidYears: 10,
    futureContributionYears: 5, annualContribution: 1000, annualSubsidy: 100,
    currentAccount: 15000, localBasicPension: 200,
  });
  assert.equal(r.totalContributionYears, 15);
  assert.equal(r.eligibleAt60, true);
  assert.equal(r.shortageYears, 0);
  assert.ok(r.pensionLow > 200);
  assert.ok(r.pensionHigh >= r.pensionLow);
});

test('resident future contributions are capped by time remaining to age 60', () => {
  const r = projectResidentPension({
    birth: '1967-01', now: { year: 2026, month: 8 }, paidYears: 8,
    futureContributionYears: 10, annualContribution: 1000, annualSubsidy: 100,
    currentAccount: 0, localBasicPension: 0,
  });
  assert.ok(r.futureContributionYears <= r.maxFutureWholeYears);
  assert.equal(r.eligibleAt60, false);
  assert.ok(r.shortageYears > 0);
});

test('resident result does not invent total pension without local basic pension', () => {
  const r = projectResidentPension({
    birth: '1980-01', now: { year: 2026, month: 8 }, paidYears: 15,
    futureContributionYears: 0, annualContribution: 1000, annualSubsidy: 100,
    currentAccount: 20000, localBasicPension: '',
  });
  assert.equal(r.pensionLow, 0);
  assert.equal(r.pensionHigh, 0);
  assert.ok(r.accountPensionLow > 0);
  assert.ok(r.warnings.some(item => item.includes('当地基础养老金')));
});
