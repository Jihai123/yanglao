import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcStatutoryRetirement,
  divisorRangeForAgeMonths,
  minimumContributionReferenceYear,
  minimumContributionYears,
  requiredContributionYears,
} from '../js/policy.js';
import { projectPlan } from '../js/projection.js';

test('渐进式退休年龄关键边界', () => {
  const male = calcStatutoryRetirement('1965-01', 'base60');
  assert.equal(male.statutoryAgeMonths, 60 * 12 + 1);
  assert.deepEqual(male.retireDate, { year: 2025, month: 2 });

  const female50 = calcStatutoryRetirement('1975-03', 'base50');
  assert.equal(female50.statutoryAgeMonths, 50 * 12 + 2);
  assert.deepEqual(female50.retireDate, { year: 2025, month: 5 });
});

test('2030-2039最低缴费年限边界', () => {
  assert.equal(minimumContributionYears(2029), 15);
  assert.equal(minimumContributionYears(2030), 15.5);
  assert.equal(minimumContributionYears(2031), 16);
  assert.equal(minimumContributionYears(2039), 20);
  assert.equal(minimumContributionYears(2045), 20);
});

test('弹性延迟退休按法定退休年份确定最低缴费年限', () => {
  // 1980-11 原50岁女职工：法定退休年龄53岁，2033年达到法定退休年龄。
  const r = calcStatutoryRetirement('1980-11', 'base50');
  assert.equal(r.statutoryAgeMonths, 53 * 12);
  assert.equal(r.retireDate.year, 2033);

  const delayedAge = 56 * 12;
  assert.equal(minimumContributionReferenceYear('1980-11', 'base50', delayedAge), 2033);
  assert.equal(requiredContributionYears('1980-11', 'base50', delayedAge), 17);

  const earlyAge = 51 * 12;
  assert.equal(minimumContributionReferenceYear('1980-11', 'base50', earlyAge), 2031);
  assert.equal(requiredContributionYears('1980-11', 'base50', earlyAge), 16);
});

test('企业职工计发月数47岁按208，非整岁不伪装成精确档', () => {
  const age47 = divisorRangeForAgeMonths(47 * 12);
  assert.equal(age47.exact, true);
  assert.equal(age47.maxDivisor, 208);

  const age60m11 = divisorRangeForAgeMonths(60 * 12 + 11);
  assert.equal(age60m11.exact, false);
  assert.equal(age60m11.maxDivisor, 139);
  assert.equal(age60m11.minDivisor, 132);
});

test('未来新增个人账户在停止缴费后仍继续计息到领取时', () => {
  const base = {
    birth: '1976-08', category: 'base60', now: { year: 2026, month: 8 },
    paidYears: 20, stopWorkAge: 55, contributionEndAge: 55,
    monthlyContributionBase: 10000, avgIndex: 1,
    currentAccount: 100000, currentCalcBase: 10000,
    wageGrowth: 0, accountInterest: 0.03, inflation: 0.02,
  };
  const at55 = projectPlan({ ...base, claimAgeMonths: 55 * 12 });
  const at60 = projectPlan({ ...base, claimAgeMonths: 60 * 12 });
  assert.ok(at60.accountLow > at55.accountLow, '55岁停缴后的账户应继续计息到60岁');
});

test('不足整年的未来缴费月份也进入缴费年限和个人账户', () => {
  const r = projectPlan({
    birth: '1966-01', category: 'base60', now: { year: 2025, month: 8 },
    paidYears: 20, stopWorkAge: 60, contributionEndAge: 60 + 5 / 12,
    claimAgeMonths: 60 * 12 + 5,
    monthlyContributionBase: 10000, avgIndex: 1,
    currentAccount: 100000, currentCalcBase: 10000,
    wageGrowth: 0, accountInterest: 0, inflation: 0,
  });
  // 2025-08 时年龄59岁7个月，到60岁5个月还有10个月。
  assert.equal(r.futureContributionMonths, 10);
  assert.ok(Math.abs(r.totalContributionYears - (20 + 10 / 12)) < 1e-9);
  assert.ok(r.accountLow > 100000 + 9 * 800, '应包含10个月个人账户划入');
});

test('投影使用弹性延迟的正确最低年限参考年', () => {
  const r = projectPlan({
    birth: '1980-11', category: 'base50', now: { year: 2026, month: 8 },
    paidYears: 15, stopWorkAge: 55, contributionEndAge: 56, claimAgeMonths: 56 * 12,
    monthlyContributionBase: 8000, avgIndex: 1, currentAccount: 50000,
    currentCalcBase: 8000, wageGrowth: 0.03, accountInterest: 0.03, inflation: 0.02,
  });
  assert.equal(r.minYearsReferenceYear, 2033);
  assert.equal(r.minYears, 17);
});

test('非法人员类别直接失败，不静默落到50岁类别', () => {
  assert.throws(() => calcStatutoryRetirement('1980-01', 'bad-category'), /类别无效/);
});
