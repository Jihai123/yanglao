import {
  calcStatutoryRetirement,
  claimDateFromAge,
  divisorRangeForAgeMonths,
  minimumContributionReferenceYear,
  minimumContributionYears,
  parseMonth,
} from './policy.js';

const MONTHS = 12;

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function annualize(monthly, rate, years) {
  return monthly * Math.pow(1 + rate, Math.max(0, years));
}

function inferCurrentAccount(monthlyContributionBase, paidMonths) {
  const paidYears = paidMonths / 12;
  const rough = Math.max(0, monthlyContributionBase) * 0.08 * 12 * paidYears;
  return {
    center: rough * 0.72,
    low: rough * 0.58,
    high: rough * 0.88,
  };
}

function projectAccount({
  startingBalance,
  monthlyContributionBase,
  contributionMonths,
  monthsToClaim,
  wageGrowth,
  accountInterest,
  schedule = 'frontload',
}) {
  const total = Math.max(0, Math.round(monthsToClaim));
  const payMonths = clamp(Math.round(contributionMonths), 0, total);
  const monthlyInterest = Math.pow(1 + accountInterest, 1 / 12) - 1;
  const monthlyWageGrowth = Math.pow(1 + wageGrowth, 1 / 12) - 1;
  let balance = Math.max(0, startingBalance);
  let paid = 0;

  for (let month = 0; month < total; month += 1) {
    balance *= 1 + monthlyInterest;
    let shouldPay = false;
    if (schedule === 'spread' && payMonths > 0) {
      const targetPaidByNow = Math.floor(((month + 1) * payMonths) / total);
      shouldPay = targetPaidByNow > paid;
    } else {
      shouldPay = month < payMonths;
    }
    if (shouldPay) {
      const base = monthlyContributionBase * Math.pow(1 + monthlyWageGrowth, month);
      balance += Math.max(0, base) * 0.08;
      paid += 1;
    }
  }
  return balance;
}

function historyIndexRange(avgIndex, confidence) {
  const center = Math.max(0.01, safeNumber(avgIndex, 1));
  if (confidence === 'exact') return { center, low: center, high: center };
  if (confidence === 'rough') {
    return {
      center,
      low: Math.max(0.3, center * 0.9),
      high: Math.min(3, center * 1.1),
    };
  }
  return { center, low: null, high: null };
}

export function projectPlanV3(input) {
  const birth = parseMonth(input.birth);
  const now = input.now || currentYearMonth();
  const currentAgeMonths = (now.year * 12 + now.month - 1) - (birth.year * 12 + birth.month - 1);
  if (currentAgeMonths < 0) throw new Error('出生年月不能晚于当前月份');

  const paidMonths = Math.max(0, Math.round(safeNumber(input.paidMonths, safeNumber(input.paidYears) * 12)));
  const claimAgeMonths = Math.round(safeNumber(input.claimAgeMonths));
  if (!(claimAgeMonths > 0)) throw new Error('退休年龄无效');

  const retirement = calcStatutoryRetirement(input.birth, input.category);
  const claimDate = claimDateFromAge(input.birth, claimAgeMonths);
  const minYearsReferenceYear = minimumContributionReferenceYear(input.birth, input.category, claimAgeMonths);
  const minYears = minimumContributionYears(minYearsReferenceYear);
  const requiredContributionMonths = Math.round(minYears * 12);
  const monthsToClaim = Math.max(0, claimAgeMonths - currentAgeMonths);

  const requestedFutureMonths = safeNumber(input.futureContributionMonths, monthsToClaim);
  const futureContributionMonths = clamp(Math.round(requestedFutureMonths), 0, monthsToClaim);
  const totalContributionMonths = paidMonths + futureContributionMonths;
  const remainingActualContributionMonths = Math.max(0, requiredContributionMonths - paidMonths);
  const plannedContributionShortageMonths = Math.max(0, requiredContributionMonths - totalContributionMonths);
  const eligible = plannedContributionShortageMonths === 0;

  const yearsToClaim = monthsToClaim / 12;
  const avgIndexConfidence = input.avgIndexConfidence || 'unknown';
  const indexRange = historyIndexRange(input.avgIndex, avgIndexConfidence);
  const monthlyContributionBase = Math.max(0, safeNumber(input.monthlyContributionBase));
  const wageGrowth = clamp(safeNumber(input.wageGrowth, 0.03), -0.02, 0.15);
  const accountInterest = clamp(safeNumber(input.accountInterest, 0.03), 0, 0.15);
  const inflation = clamp(safeNumber(input.inflation, 0.02), 0, 0.15);

  let currentCalcBase = Math.max(0, safeNumber(input.currentCalcBase));
  const inferredCalcBase = !currentCalcBase && monthlyContributionBase > 0 && indexRange.center > 0;
  if (inferredCalcBase) currentCalcBase = monthlyContributionBase / indexRange.center;

  const knownAccount = Math.max(0, safeNumber(input.currentAccount));
  const accountKnown = Boolean(input.accountKnown && knownAccount >= 0);
  const accountStart = accountKnown
    ? { center: knownAccount, low: knownAccount, high: knownAccount }
    : inferCurrentAccount(monthlyContributionBase, paidMonths);

  const missing = [];
  if (input.amountMode === 'skip') missing.push('本次选择了先不估金额');
  if (avgIndexConfidence === 'unknown') missing.push('历史平均缴费水平变化较大或尚不确定');
  if (!(monthlyContributionBase > 0)) missing.push('缺少当前养老保险缴费基数');
  if (!(currentCalcBase > 0)) missing.push('缺少可用的养老金计发基准');

  const divisorInfo = divisorRangeForAgeMonths(claimAgeMonths);
  const divisorCenter = (divisorInfo.maxDivisor + divisorInfo.minDivisor) / 2;
  const schedule = input.contributionSchedule === 'spread' ? 'spread' : 'frontload';

  let pensionCenter = 0;
  let pensionLow = 0;
  let pensionHigh = 0;
  let todayPowerCenter = 0;
  let amountAvailable = missing.length === 0;
  let amountConfidence = '暂不估金额';
  let uncertaintyRatio = null;

  if (amountAvailable) {
    const calcCenter = annualize(currentCalcBase, wageGrowth, yearsToClaim);
    const growthBand = yearsToClaim > 10 ? 0.01 : 0.005;
    const calcLow = annualize(currentCalcBase * (inferredCalcBase ? 0.94 : 0.98), Math.max(-0.02, wageGrowth - growthBand), yearsToClaim);
    const calcHigh = annualize(currentCalcBase * (inferredCalcBase ? 1.06 : 1.02), wageGrowth + growthBand, yearsToClaim);

    const accountCenter = projectAccount({
      startingBalance: accountStart.center,
      monthlyContributionBase,
      contributionMonths: futureContributionMonths,
      monthsToClaim,
      wageGrowth,
      accountInterest,
      schedule,
    });
    const accountLow = projectAccount({
      startingBalance: accountStart.low,
      monthlyContributionBase,
      contributionMonths: futureContributionMonths,
      monthsToClaim,
      wageGrowth: Math.max(-0.02, wageGrowth - growthBand),
      accountInterest: Math.max(0, accountInterest - 0.005),
      schedule,
    });
    const accountHigh = projectAccount({
      startingBalance: accountStart.high,
      monthlyContributionBase,
      contributionMonths: futureContributionMonths,
      monthsToClaim,
      wageGrowth: wageGrowth + growthBand,
      accountInterest: accountInterest + 0.005,
      schedule,
    });

    const totalYears = totalContributionMonths / 12;
    const basicCenter = calcCenter * ((1 + indexRange.center) / 2) * totalYears * 0.01;
    const basicLow = calcLow * ((1 + indexRange.low) / 2) * totalYears * 0.01;
    const basicHigh = calcHigh * ((1 + indexRange.high) / 2) * totalYears * 0.01;
    const transition = Math.max(0, safeNumber(input.transition));
    const extra = Math.max(0, safeNumber(input.extra));

    pensionCenter = basicCenter + accountCenter / divisorCenter + transition + extra;
    pensionLow = basicLow + accountLow / divisorInfo.maxDivisor + transition + extra;
    pensionHigh = basicHigh + accountHigh / divisorInfo.minDivisor + transition + extra;
    todayPowerCenter = pensionCenter / Math.pow(1 + inflation, yearsToClaim);
    uncertaintyRatio = pensionCenter > 0 ? (pensionHigh - pensionLow) / pensionCenter : 1;

    if (uncertaintyRatio > 0.45) {
      amountAvailable = false;
      missing.push('当前信息下金额波动范围过大，继续给数字没有决策意义');
      amountConfidence = '信息不足';
    } else if (uncertaintyRatio <= 0.2 && accountKnown && avgIndexConfidence === 'exact' && !inferredCalcBase) {
      amountConfidence = '较高';
    } else if (uncertaintyRatio <= 0.3) {
      amountConfidence = '中等';
    } else {
      amountConfidence = '规划估算';
    }
  }

  return {
    currentAgeMonths,
    claimAgeMonths,
    claimDate,
    retirement,
    paidMonths,
    futureContributionMonths,
    totalContributionMonths,
    requiredContributionMonths,
    remainingActualContributionMonths,
    plannedContributionShortageMonths,
    minYears,
    minYearsReferenceYear,
    eligible,
    yearsToClaim,
    pensionCenter,
    pensionLow,
    pensionHigh,
    todayPowerCenter,
    amountAvailable,
    amountConfidence,
    amountMissingReasons: missing,
    uncertaintyRatio,
    inferredCalcBase,
    divisorExact: divisorInfo.exact,
    divisorMin: divisorInfo.minDivisor,
    divisorMax: divisorInfo.maxDivisor,
  };
}
