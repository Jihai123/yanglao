import { claimDateFromAge, divisorForAgeMonths, minimumContributionYears, parseMonth } from './policy.js';

const MONTHS = 12;

function annualize(monthly, rate, years) {
  return monthly * Math.pow(1 + rate, Math.max(0, years));
}

function futureValue(current, rate, years) {
  return current * Math.pow(1 + rate, Math.max(0, years));
}

function annuityFutureValueAnnualPayment(firstAnnualPayment, growth, interest, years) {
  let balance = 0;
  for (let i = 0; i < years; i += 1) {
    const payment = firstAnnualPayment * Math.pow(1 + growth, i);
    balance = balance * (1 + interest) + payment;
  }
  return balance;
}

function estimateCurrentAccountRange({ monthlyContributionBase, paidYears }) {
  // 快速模式：历史缴费基数往往低于当前值，因此只给区间，不给伪精确值。
  const currentAnnualPersonal = monthlyContributionBase * 0.08 * 12;
  const rough = currentAnnualPersonal * paidYears;
  return { low: rough * 0.55, high: rough * 0.9 };
}

export function projectPlan(input) {
  const birth = parseMonth(input.birth);
  const now = input.now || { year: 2026, month: 8 };
  const currentAgeMonths = (now.year * 12 + now.month - 1) - (birth.year * 12 + birth.month - 1);
  const stopWorkAgeMonths = Number(input.stopWorkAge) * MONTHS;
  const contributionEndAgeMonths = Number(input.contributionEndAge) * MONTHS;
  const claimAgeMonths = Number(input.claimAgeMonths);
  const claimDate = claimDateFromAge(birth, claimAgeMonths);

  const futureContributionMonths = Math.max(0, Math.min(contributionEndAgeMonths, claimAgeMonths) - currentAgeMonths);
  const futureContributionYears = futureContributionMonths / 12;
  const totalContributionYears = Number(input.paidYears) + futureContributionYears;
  const minYears = minimumContributionYears(claimDate.year);

  const yearsToClaim = Math.max(0, (claimAgeMonths - currentAgeMonths) / 12);
  const contributionYearsWhole = Math.max(0, Math.floor(futureContributionYears));
  const index = Number(input.avgIndex || 1);
  const wageGrowth = Number(input.wageGrowth || 0.03);
  const accountInterest = Number(input.accountInterest || 0.03);
  const inflation = Number(input.inflation || 0.02);
  const monthlyContributionBase = Number(input.monthlyContributionBase || 0);

  let currentCalcBase = Number(input.currentCalcBase || 0);
  if (!currentCalcBase && monthlyContributionBase > 0 && index > 0) {
    currentCalcBase = monthlyContributionBase / index;
  }

  const futureCalcBase = currentCalcBase > 0 ? annualize(currentCalcBase, wageGrowth, yearsToClaim) : 0;
  const divisor = divisorForAgeMonths(claimAgeMonths);

  const futurePersonalPayments = annuityFutureValueAnnualPayment(
    monthlyContributionBase * 0.08 * 12,
    wageGrowth,
    accountInterest,
    contributionYearsWhole,
  );

  const knownAccount = Number(input.currentAccount || 0);
  let accountLow;
  let accountHigh;
  let confidence;
  if (knownAccount > 0) {
    const futureKnown = futureValue(knownAccount, accountInterest, yearsToClaim);
    accountLow = futureKnown + futurePersonalPayments * 0.95;
    accountHigh = futureKnown + futurePersonalPayments * 1.05;
    confidence = currentCalcBase > 0 ? '较高' : '中等';
  } else {
    const est = estimateCurrentAccountRange({ monthlyContributionBase, paidYears: Number(input.paidYears) });
    accountLow = futureValue(est.low, accountInterest, yearsToClaim) + futurePersonalPayments * 0.9;
    accountHigh = futureValue(est.high, accountInterest, yearsToClaim) + futurePersonalPayments * 1.1;
    confidence = '估算';
  }

  const basic = futureCalcBase > 0
    ? futureCalcBase * ((1 + index) / 2) * totalContributionYears * 0.01
    : 0;
  const pensionLow = basic + accountLow / divisor + Number(input.transition || 0) + Number(input.extra || 0);
  const pensionHigh = basic + accountHigh / divisor + Number(input.transition || 0) + Number(input.extra || 0);

  const todayPowerLow = pensionLow / Math.pow(1 + inflation, yearsToClaim);
  const todayPowerHigh = pensionHigh / Math.pow(1 + inflation, yearsToClaim);

  return {
    currentAgeMonths,
    stopWorkAgeMonths,
    contributionEndAgeMonths,
    claimAgeMonths,
    claimDate,
    gapYears: Math.max(0, (claimAgeMonths - stopWorkAgeMonths) / 12),
    futureContributionYears,
    totalContributionYears,
    minYears,
    eligible: totalContributionYears + 1e-9 >= minYears,
    futureCalcBase,
    accountLow,
    accountHigh,
    divisor,
    basic,
    pensionLow,
    pensionHigh,
    todayPowerLow,
    todayPowerHigh,
    confidence,
  };
}

export function buildScenarios(input) {
  const stop = Number(input.stopWorkAge);
  const claim = Number(input.claimAgeMonths) / 12;
  const variants = [
    { key: 'stop', title: '停止工作时停缴', contributionEndAge: stop },
    { key: 'five', title: '再缴 5 年', contributionEndAge: Math.min(claim, stop + 5) },
    { key: 'claim', title: '一直缴到领取', contributionEndAge: claim },
  ];
  const unique = [];
  const seen = new Set();
  for (const v of variants) {
    const k = v.contributionEndAge.toFixed(2);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push({ ...v, result: projectPlan({ ...input, contributionEndAge: v.contributionEndAge }) });
  }
  return unique;
}
