import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPlanV4 } from '../js/projection-v4.js';

const base = {
  birth: '1983-01',
  category: 'base60',
  now: { year: 2026, month: 8 },
  claimAgeMonths: 63 * 12,
  paidMonths: 18 * 12,
  deemedMonths: 0,
  amountMode: 'estimate',
  monthlyContributionBase: 20000,
  avgIndex: 1,
  avgIndexConfidence: 'exact',
  accountKnown: true,
  currentAccount: 100000,
  currentCalcBase: 7881,
  currentCalcBaseYear: 2025,
  calcBaseSourceQuality: 'corroborated',
  socialWageGrowth: 0.03,
  historicalReferenceGrowth: 0.03,
  contributionGrowth: 0.03,
  accountInterest: 0.03,
  inflation: 0.02,
  futureContributionSegments: [
    { months: 24, monthlyContributionBase: 4000, startOffsetMonths: 0, contributionGrowth: 0.03, label: '灵活就业' },
  ],
};

test('没有独立计发基准时不再从个人缴费基数反推金额', () => {
  const result = projectPlanV4({ ...base, currentCalcBase: 0, currentCalcBaseYear: 0 });
  assert.equal(result.amountAvailable, false);
  assert.equal(result.pensionCenter, 0);
  assert.ok(result.amountMissingReasons.some(item => item.includes('计发基准')));
});

test('陕西7881锚点下约20年缴费不会因20000个人基数膨胀到一万元以上', () => {
  const result = projectPlanV4(base);
  assert.equal(result.amountAvailable, true);
  assert.ok(result.pensionCenter > 0);
  assert.ok(result.pensionCenter < 8000, `unexpected pension ${result.pensionCenter}`);
});

test('历史缴费支持同一年按月份分段', () => {
  const result = projectPlanV4({
    ...base,
    historyContributionSegments: [
      { startMonth: '2020-01', endMonth: '2020-06', monthlyContributionBase: 4000 },
      { startMonth: '2020-07', endMonth: '2020-12', monthlyContributionBase: 8000 },
    ],
  });
  assert.equal(result.historyContributionSegments.length, 2);
  assert.equal(result.historyContributionSegments[0].months, 6);
  assert.equal(result.historyContributionSegments[1].months, 6);
});

test('同样缴费月数下未来灵活就业基数更低，养老金估算也更低', () => {
  const low = projectPlanV4({
    ...base,
    futureContributionSegments: [
      { months: 60, monthlyContributionBase: 4000, startOffsetMonths: 0, contributionGrowth: 0.03, label: '灵活就业' },
    ],
  });
  const high = projectPlanV4({
    ...base,
    futureContributionSegments: [
      { months: 60, monthlyContributionBase: 12000, startOffsetMonths: 0, contributionGrowth: 0.03, label: '灵活就业' },
    ],
  });
  assert.equal(low.futureContributionMonths, high.futureContributionMonths);
  assert.ok(low.pensionCenter < high.pensionCenter);
});

test('养老金分项之和等于总额', () => {
  const result = projectPlanV4(base);
  const sum = result.basicCenter + result.personalCenter + result.transitionCenter;
  assert.ok(Math.abs(sum - result.pensionCenter) < 1e-8);
});

test('存在视同缴费但没有过渡养老金信息时不输出伪完整总额', () => {
  const result = projectPlanV4({
    ...base,
    deemedMonths: 48,
    transitionAmountKnown: false,
    transitionAmount: 0,
  });
  assert.equal(result.amountAvailable, false);
  assert.ok(result.amountMissingReasons.some(item => item.includes('过渡性养老金')));
});
