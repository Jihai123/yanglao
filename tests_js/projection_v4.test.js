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

test('已确认视同缴费计入最低缴费年限，但未知地方金额规则时只给部分结果', () => {
  const result = projectPlanV4({
    ...base,
    paidMonths: 10 * 12,
    deemedMonths: 5 * 12,
    futureContributionSegments: [],
    deemedStatus: 'confirmed',
    transitionAmountKnown: false,
    transitionAmount: null,
  });
  const noDeemed = projectPlanV4({
    ...base,
    paidMonths: 10 * 12,
    deemedMonths: 0,
    deemedStatus: 'none',
    futureContributionSegments: [],
  });
  assert.equal(result.qualifyingContributionMonths, 15 * 12);
  assert.equal(result.actualContributionMonths, 10 * 12);
  assert.equal(result.plannedContributionShortageMonths, Math.max(0, result.requiredContributionMonths - 15 * 12));
  assert.equal(noDeemed.plannedContributionShortageMonths - result.plannedContributionShortageMonths, 5 * 12);
  assert.equal(result.amountAvailable, true);
  assert.equal(result.amountStatus, 'partial_transition_unknown');
  assert.equal(result.partialReason, 'transition_unknown');
  assert.equal(result.transitionCenter, null);
  assert.equal(result.fullPensionCenter, null);
  assert.ok(result.knownPensionCenter > 0);
  assert.equal(result.pensionCenter, result.knownPensionCenter);
});

test('已填写官方过渡性养老金仍保持部分结果，不伪装地方视同规则已完整计算', () => {
  const withoutTransition = projectPlanV4({
    ...base,
    deemedMonths: 60,
    deemedStatus: 'confirmed',
    transitionAmountKnown: false,
    transitionAmount: null,
  });
  const withTransition = projectPlanV4({
    ...base,
    deemedMonths: 60,
    deemedStatus: 'confirmed',
    transitionAmountKnown: true,
    transitionAmount: 500,
  });
  assert.equal(withTransition.amountStatus, 'partial_deemed_rules_unknown');
  assert.equal(withTransition.partialReason, 'deemed_rules_unknown');
  assert.equal(withTransition.transitionKnown, true);
  assert.equal(withTransition.transitionCenter, 500);
  assert.equal(withTransition.fullPensionCenter, null);
  assert.ok(Math.abs((withTransition.knownPensionCenter - withoutTransition.knownPensionCenter) - 500) < 1e-8);
});

test('视同缴费状态不确定时，资格和金额都只基于已确认资料', () => {
  const result = projectPlanV4({
    ...base,
    paidMonths: 10 * 12,
    deemedMonths: 0,
    deemedStatus: 'unknown',
    futureContributionSegments: [],
  });
  assert.equal(result.qualifyingContributionMonths, 10 * 12);
  assert.equal(result.amountStatus, 'partial_deemed_unknown');
  assert.equal(result.partialReason, 'deemed_status_unknown');
});

test('没有视同缴费时仍输出完整金额结果', () => {
  const result = projectPlanV4({ ...base, deemedStatus: 'none', deemedMonths: 0 });
  assert.equal(result.amountStatus, 'full');
  assert.equal(result.partialReason, '');
  assert.ok(result.fullPensionCenter > 0);
  assert.equal(result.fullPensionCenter, result.pensionCenter);
});


test('计算核心不会让 confirmed=0 静默变成完整结果', () => {
  const result = projectPlanV4({
    ...base,
    deemedStatus: 'confirmed',
    deemedMonths: 0,
    transitionAmountKnown: false,
    transitionAmount: null,
  });
  assert.equal(result.amountAvailable, false);
  assert.equal(result.amountStatus, 'unavailable');
  assert.ok(result.amountMissingReasons.some(item => item.includes('未填写视同缴费年限')));
});

test('非 confirmed 状态不会把残留视同月数计入资格', () => {
  const none = projectPlanV4({
    ...base,
    paidMonths: 10 * 12,
    deemedStatus: 'none',
    deemedMonths: 5 * 12,
    futureContributionSegments: [],
  });
  const unknown = projectPlanV4({
    ...base,
    paidMonths: 10 * 12,
    deemedStatus: 'unknown',
    deemedMonths: 5 * 12,
    futureContributionSegments: [],
  });
  assert.equal(none.deemedMonths, 0);
  assert.equal(unknown.deemedMonths, 0);
  assert.equal(none.qualifyingContributionMonths, 10 * 12);
  assert.equal(unknown.qualifyingContributionMonths, 10 * 12);
});
