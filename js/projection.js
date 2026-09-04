import {
  calcStatutoryRetirement,
  claimDateFromAge,
  divisorRangeForAgeMonths,
  minimumContributionReferenceYear,
  minimumContributionYears,
  parseMonth,
} from './policy.js';

const MONTHS = 12;

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function annualize(monthly, rate, years) {
  return monthly * Math.pow(1 + rate, Math.max(0, years));
}

function estimateCurrentAccountRange({ monthlyContributionBase, paidYears }) {
  // 快速模式仅用于规划：历史缴费基数通常并不等于当前值，因此给宽区间而不是伪精确点值。
  const currentAnnualPersonal = monthlyContributionBase * 0.08 * 12;
  const rough = currentAnnualPersonal * paidYears;
  return { low: rough * 0.55, high: rough * 0.9 };
}

function projectAccountMonthly({
  startingBalance,
  monthlyContributionBase,
  wageGrowth,
  accountInterest,
  contributionMonths,
  monthsToClaim,
}) {
  const totalMonths = Math.max(0, Math.round(monthsToClaim));
  const payMonths = Math.max(0, Math.min(totalMonths, Math.round(contributionMonths)));
  const monthlyInterest = Math.pow(1 + accountInterest, 1 / 12) - 1;
  const monthlyWageGrowth = Math.pow(1 + wageGrowth, 1 / 12) - 1;
  let balance = Math.max(0, Number(startingBalance) || 0);

  for (let month = 0; month < totalMonths; month += 1) {
    balance *= (1 + monthlyInterest);
    if (month < payMonths) {
      const base = monthlyContributionBase * Math.pow(1 + monthlyWageGrowth, month);
      balance += base * 0.08;
    }
  }
  return balance;
}

function safeRate(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-0.95, n) : fallback;
}

export function projectPlan(input) {
  const birth = parseMonth(input.birth);
  const now = input.now || currentYearMonth();
  const currentAgeMonths = (now.year * 12 + now.month - 1) - (birth.year * 12 + birth.month - 1);
  if (currentAgeMonths < 0) throw new Error('出生年月不能晚于当前月份');

  const paidYears = Number(input.paidYears);
  if (!Number.isFinite(paidYears) || paidYears < 0) throw new Error('累计缴费年限无效');

  const stopWorkAgeMonths = Number(input.stopWorkAge) * MONTHS;
  const contributionEndAgeMonths = Number(input.contributionEndAge) * MONTHS;
  const claimAgeMonths = Number(input.claimAgeMonths);
  if (![stopWorkAgeMonths, contributionEndAgeMonths, claimAgeMonths].every(Number.isFinite)) {
    throw new Error('退休计划年龄无效');
  }

  const retirement = calcStatutoryRetirement(input.birth, input.category);
  const claimDate = claimDateFromAge(birth, claimAgeMonths);
  const minYearsReferenceYear = minimumContributionReferenceYear(input.birth, input.category, claimAgeMonths);
  const minYears = minimumContributionYears(minYearsReferenceYear);

  const contributionCutoffAgeMonths = Math.min(contributionEndAgeMonths, claimAgeMonths);
  const futureContributionMonths = Math.max(0, contributionCutoffAgeMonths - currentAgeMonths);
  const futureContributionYears = futureContributionMonths / 12;
  const totalContributionYears = paidYears + futureContributionYears;

  const monthsToClaim = Math.max(0, claimAgeMonths - currentAgeMonths);
  const yearsToClaim = monthsToClaim / 12;
  const index = Math.max(0.01, Number(input.avgIndex || 1));
  const wageGrowth = safeRate(input.wageGrowth, 0.03);
  const accountInterest = safeRate(input.accountInterest, 0.03);
  const inflation = safeRate(input.inflation, 0.02);
  const wageGrowthBand = Math.max(0, Number(input.wageGrowthBand ?? 0.01));
  const accountInterestBand = Math.max(0, Number(input.accountInterestBand ?? 0.005));
  const monthlyContributionBase = Math.max(0, Number(input.monthlyContributionBase || 0));

  let currentCalcBase = Math.max(0, Number(input.currentCalcBase || 0));
  const inferredCalcBase = !currentCalcBase && monthlyContributionBase > 0 && index > 0;
  if (inferredCalcBase) currentCalcBase = monthlyContributionBase / index;

  const anchorBand = inferredCalcBase ? 0.1 : 0;
  const lowWageGrowth = Math.max(-0.02, wageGrowth - wageGrowthBand);
  const highWageGrowth = wageGrowth + wageGrowthBand;
  const futureCalcBase = currentCalcBase > 0 ? annualize(currentCalcBase, wageGrowth, yearsToClaim) : 0;
  const futureCalcBaseLow = currentCalcBase > 0
    ? annualize(currentCalcBase * (1 - anchorBand), lowWageGrowth, yearsToClaim)
    : 0;
  const futureCalcBaseHigh = currentCalcBase > 0
    ? annualize(currentCalcBase * (1 + anchorBand), highWageGrowth, yearsToClaim)
    : 0;

  const knownAccount = Math.max(0, Number(input.currentAccount || 0));
  const currentEstimate = knownAccount > 0
    ? { low: knownAccount, high: knownAccount }
    : estimateCurrentAccountRange({ monthlyContributionBase, paidYears });

  const lowAccountInterest = Math.max(0, accountInterest - accountInterestBand);
  const highAccountInterest = accountInterest + accountInterestBand;
  const accountLow = projectAccountMonthly({
    startingBalance: currentEstimate.low,
    monthlyContributionBase,
    wageGrowth: lowWageGrowth,
    accountInterest: lowAccountInterest,
    contributionMonths: futureContributionMonths,
    monthsToClaim,
  });
  const accountHigh = projectAccountMonthly({
    startingBalance: currentEstimate.high,
    monthlyContributionBase,
    wageGrowth: highWageGrowth,
    accountInterest: highAccountInterest,
    contributionMonths: futureContributionMonths,
    monthsToClaim,
  });

  const divisorInfo = divisorRangeForAgeMonths(claimAgeMonths);
  const basic = futureCalcBase > 0
    ? futureCalcBase * ((1 + index) / 2) * totalContributionYears * 0.01
    : 0;
  const basicLow = futureCalcBaseLow > 0
    ? futureCalcBaseLow * ((1 + index) / 2) * totalContributionYears * 0.01
    : 0;
  const basicHigh = futureCalcBaseHigh > 0
    ? futureCalcBaseHigh * ((1 + index) / 2) * totalContributionYears * 0.01
    : 0;

  const transition = Math.max(0, Number(input.transition || 0));
  const extra = Math.max(0, Number(input.extra || 0));
  const pensionLow = basicLow + accountLow / divisorInfo.maxDivisor + transition + extra;
  const pensionHigh = basicHigh + accountHigh / divisorInfo.minDivisor + transition + extra;

  const todayPowerLow = pensionLow / Math.pow(1 + inflation, yearsToClaim);
  const todayPowerHigh = pensionHigh / Math.pow(1 + inflation, yearsToClaim);

  const warnings = [];
  if (!divisorInfo.exact) {
    warnings.push(`本次领取年龄为非整岁，国家现行企业职工计发月数表按整岁列示；金额区间已用${divisorInfo.lowerAge}岁与${divisorInfo.upperAge}岁相邻档位做边界，不把其中任一档伪装成全国统一精确值。`);
  }
  if (inferredCalcBase) {
    warnings.push('快速模式未填写当地最新养老金计发基数，当前以缴费基数÷平均缴费指数反推基准，并加入敏感性区间。');
  }
  if (yearsToClaim > 5) {
    warnings.push('距离领取养老金超过5年，未来计发基数、缴费基数和记账利率都会变化，金额只能用于长期规划，不能视为待遇承诺。');
  }
  if (claimAgeMonths > retirement.statutoryAgeMonths) {
    warnings.push(`本次属于弹性延迟退休，最低缴费年限按法定退休年龄对应年份 ${minYearsReferenceYear} 年确定，而不是按实际延迟到的年份确定。`);
  }

  let confidence = '规划估算';
  if (knownAccount > 0 && Number(input.currentCalcBase) > 0 && yearsToClaim <= 2 && divisorInfo.exact) {
    confidence = '较高';
  } else if (!knownAccount || inferredCalcBase || yearsToClaim > 5) {
    confidence = '长期规划估算';
  }

  return {
    currentAgeMonths,
    stopWorkAgeMonths,
    contributionEndAgeMonths,
    claimAgeMonths,
    claimDate,
    retirement,
    gapYears: Math.max(0, (claimAgeMonths - stopWorkAgeMonths) / 12),
    futureContributionMonths,
    futureContributionYears,
    totalContributionYears,
    minYearsReferenceYear,
    minYears,
    eligible: totalContributionYears + 1e-9 >= minYears,
    futureCalcBase,
    futureCalcBaseLow,
    futureCalcBaseHigh,
    accountLow,
    accountHigh,
    divisor: divisorInfo.exact ? divisorInfo.maxDivisor : null,
    divisorExact: divisorInfo.exact,
    divisorMin: divisorInfo.minDivisor,
    divisorMax: divisorInfo.maxDivisor,
    basic,
    basicLow,
    basicHigh,
    pensionLow,
    pensionHigh,
    todayPowerLow,
    todayPowerHigh,
    confidence,
    warnings,
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
