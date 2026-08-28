import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPlanV3 } from '../js/projection-v3.js';

const base = {
  birth: '1983-01',
  category: 'base60',
  now: { year: 2026, month: 8 },
  claimAgeMonths: 63 * 12,
  paidMonths: 18 * 12 + 5,
  futureContributionMonths: 12,
  contributionSchedule: 'spread',
  amountMode: 'skip',
  monthlyContributionBase: 7000,
  avgIndex: 1,
  avgIndexConfidence: 'unknown',
  accountKnown: false,
  currentAccount: 0,
  currentCalcBase: 0,
  wageGrowth: 0.03,
  accountInterest: 0.03,
  inflation: 0.02,
};

test('缴费资格按实际累计月数计算，断缴计划不会被年龄差替代', () => {
  const result = projectPlanV3(base);
  assert.equal(result.paidMonths, 221);
  assert.equal(result.requiredContributionMonths, 240);
  assert.equal(result.remainingActualContributionMonths, 19);
  assert.equal(result.futureContributionMonths, 12);
  assert.equal(result.plannedContributionShortageMonths, 7);
  assert.equal(result.eligible, false);
});

test('未来实际缴费月数足够时满足最低年限', () => {
  const result = projectPlanV3({ ...base, futureContributionMonths: 19 });
  assert.equal(result.totalContributionMonths, 240);
  assert.equal(result.eligible, true);
});

test('历史缴费水平不确定时不输出无意义金额', () => {
  const result = projectPlanV3({ ...base, amountMode: 'estimate', futureContributionMonths: 120 });
  assert.equal(result.amountAvailable, false);
  assert.ok(result.amountMissingReasons.some(item => item.includes('历史平均缴费水平')));
});

test('信息较完整时输出中心估算和受控区间', () => {
  const result = projectPlanV3({
    ...base,
    amountMode: 'estimate',
    futureContributionMonths: 120,
    avgIndex: 1,
    avgIndexConfidence: 'exact',
    accountKnown: true,
    currentAccount: 120000,
    currentCalcBase: 12049,
  });
  assert.equal(result.amountAvailable, true);
  assert.ok(result.pensionCenter > 0);
  assert.ok(result.pensionLow < result.pensionCenter);
  assert.ok(result.pensionHigh > result.pensionCenter);
  assert.ok(result.uncertaintyRatio <= 0.45);
});
