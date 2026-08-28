import {
  calcStatutoryRetirement,
  claimDateFromAge,
  divisorRangeForAgeMonths,
  minimumContributionReferenceYear,
  minimumContributionYears,
  parseMonth,
} from './policy.js';

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
  return {
    center,
    low: Math.max(0.3, center * 0.6),
    high: Math.min(3, center * 1.4),
  };
}

function normalizeSegments(input, monthsToClaim, fallbackBase) {
  const raw = Array.isArray(input.futureContributionSegments) && input.futureContributionSegments.length
    ? input.futureContributionSegments
    : [{
        months: safeNumber(input.futureContributionMonths, monthsToClaim),
        monthlyContributionBase: fallbackBase,
        startOffsetMonths: 0,
        spread: input.contributionSchedule === 'spread',
      }];

  let remainingCapacity = Math.max(0, Math.round(monthsToClaim));
  const result = [];
  for (const item of raw) {
    if (remainingCapacity <= 0) break;
    const months = clamp(Math.round(safeNumber(item.months)), 0, remainingCapacity);
    if (!months) continue;
    result.push({
      months,
      monthlyContributionBase: Math.max(0, safeNumber(item.monthlyContributionBase, fallbackBase)),
      startOffsetMonths: clamp(Math.round(safeNumber(item.startOffsetMonths)), 0, Math.max(0, monthsToClaim)),
      spread: Boolean(item.spread),
      label: item.label || '',
    });
    remainingCapacity -= months;
  }
  return result;
}

function segmentPaidAtMonth(segment, month, monthsToClaim) {
  const start = segment.startOffsetMonths;
  if (month < start) return false;
  if (!segment.spread) return month < start + segment.months;

  const window = Math.max(1, monthsToClaim - start);
  const elapsed = month - start + 1;
  const targetByNow = Math.floor((elapsed * segment.months) / window);
  const targetBefore = Math.floor(((elapsed - 1) * segment.months) / window);
  return targetByNow > targetBefore;
}

function projectAccountSegments({
  startingBalance,
  segments,
  monthsToClaim,
  wageGrowth,
  accountInterest,
}) {
  const total = Math.max(0, Math.round(monthsToClaim));
  const monthlyInterest = Math.pow(1 + accountInterest, 1 / 12) - 1;
  const monthlyWageGrowth = Math.pow(1 + wageGrowth, 1 / 12) - 1;
  let balance = Math.max(0, startingBalance);

  for (let month = 0; month < total; month += 1) {
    balance *= 1 + monthlyInterest;
    for (const segment of segments) {
      if (!segmentPaidAtMonth(segment, month, total)) continue;
      const base = segment.monthlyContributionBase * Math.pow(1 + monthlyWageGrowth, month);
      balance += Math.max(0, base) * 0.08;
    }
  }
  return balance;
}

function combinedIndexRange({ historyRange, paidMonths, segments, currentCalcBase }) {
  const futureMonths = segments.reduce((sum, s) => sum + s.months, 0);
  const totalMonths = paidMonths + futureMonths;
  if (!totalMonths) return historyRange;

  const future = segments.map(segment => {
    const center = clamp(segment.monthlyContributionBase / currentCalcBase, 0.3, 3);
    return {
      months: segment.months,
      center,
      low: clamp(center * 0.95, 0.3, 3),
      high: clamp(center * 1.05, 0.3, 3),
    };
  });

  const weighted = key => {
    let sum = historyRange[key] * paidMonths;
    for (const item of future) sum += item[key] * item.months;
    return sum / totalMonths;
  };

  return { center: weighted('center'), low: weighted('low'), high: weighted('high') };
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

  const yearsToClaim = monthsToClaim / 12;
  const avgIndexConfidence = input.avgIndexConfidence || 'unknown';
  const historyRange = historyIndexRange(input.avgIndex, avgIndexConfidence);
  const monthlyContributionBase = Math.max(0, safeNumber(input.monthlyContributionBase));
  const wageGrowth = clamp(safeNumber(input.wageGrowth, 0.03), -0.02, 0.15);
  const accountInterest = clamp(safeNumber(input.accountInterest, 0.03), 0, 0.15);
  const inflation = clamp(safeNumber(input.inflation, 0.02), 0, 0.15);

  let currentCalcBase = Math.max(0, safeNumber(input.currentCalcBase));
  const inferredCalcBase = !currentCalcBase && monthlyContributionBase > 0 && historyRange.center > 0;
  if (inferredCalcBase) currentCalcBase = monthlyContributionBase / historyRange.center;

  const segments = normalizeSegments(input, monthsToClaim, monthlyContributionBase);
  const futureContributionMonths = segments.reduce((sum, s) => sum + s.months, 0);
  const totalContributionMonths = paidMonths + futureContributionMonths;
  const remainingActualContributionMonths = Math.max(0, requiredContributionMonths - paidMonths);
  const plannedContributionShortageMonths = Math.max(0, requiredContributionMonths - totalContributionMonths);
  const eligible = plannedContributionShortageMonths === 0;

  const knownAccount = Math.max(0, safeNumber(input.currentAccount));
  const accountKnown = Boolean(input.accountKnown && knownAccount >= 0);
  const accountStart = accountKnown
    ? { center: knownAccount, low: knownAccount, high: knownAccount }
    : inferCurrentAccount(monthlyContributionBase, paidMonths);

  const missing = [];
  const notes = [];
  if (input.amountMode === 'skip') missing.push('本次选择了先不估金额');
  if (!(monthlyContributionBase > 0)) missing.push('缺少当前养老保险缴费基数');
  if (!(currentCalcBase > 0)) missing.push('缺少可用的养老金计发基准');
  if (segments.some(s => s.months > 0 && !(s.monthlyContributionBase > 0))) missing.push('未来缴费基数没有填写完整');
  if (avgIndexConfidence === 'unknown') notes.push('历史缴费水平不清楚，金额按中性假设粗略估算');
  if (!accountKnown) notes.push('个人账户余额未知，当前账户为规划估算');
  if (inferredCalcBase) notes.push('当地计发基准未填写，当前按规划假设反推');
  if (segments.length > 1 || segments.some(s => s.monthlyContributionBase !== monthlyContributionBase)) {
    notes.push('未来不同阶段按各自缴费基数分段计算');
  }

  const divisorInfo = divisorRangeForAgeMonths(claimAgeMonths);
  const divisorCenter = (divisorInfo.maxDivisor + divisorInfo.minDivisor) / 2;
  let pensionCenter = 0;
  let pensionLow = 0;
  let pensionHigh = 0;
  let todayPowerCenter = 0;
  const amountAvailable = missing.length === 0;
  let amountConfidence = '暂不估金额';
  let uncertaintyRatio = null;

  if (amountAvailable) {
    const combinedIndex = combinedIndexRange({ historyRange, paidMonths, segments, currentCalcBase });
    const calcCenter = annualize(currentCalcBase, wageGrowth, yearsToClaim);
    const growthBand = yearsToClaim > 10 ? 0.01 : 0.005;
    const calcLow = annualize(currentCalcBase * (inferredCalcBase ? 0.94 : 0.98), Math.max(-0.02, wageGrowth - growthBand), yearsToClaim);
    const calcHigh = annualize(currentCalcBase * (inferredCalcBase ? 1.06 : 1.02), wageGrowth + growthBand, yearsToClaim);

    const accountCenter = projectAccountSegments({
      startingBalance: accountStart.center,
      segments,
      monthsToClaim,
      wageGrowth,
      accountInterest,
    });
    const accountLow = projectAccountSegments({
      startingBalance: accountStart.low,
      segments,
      monthsToClaim,
      wageGrowth: Math.max(-0.02, wageGrowth - growthBand),
      accountInterest: Math.max(0, accountInterest - 0.005),
    });
    const accountHigh = projectAccountSegments({
      startingBalance: accountStart.high,
      segments,
      monthsToClaim,
      wageGrowth: wageGrowth + growthBand,
      accountInterest: accountInterest + 0.005,
    });

    const totalYears = totalContributionMonths / 12;
    const basicCenter = calcCenter * ((1 + combinedIndex.center) / 2) * totalYears * 0.01;
    const basicLow = calcLow * ((1 + combinedIndex.low) / 2) * totalYears * 0.01;
    const basicHigh = calcHigh * ((1 + combinedIndex.high) / 2) * totalYears * 0.01;
    const transition = Math.max(0, safeNumber(input.transition));
    const extra = Math.max(0, safeNumber(input.extra));

    pensionCenter = basicCenter + accountCenter / divisorCenter + transition + extra;
    pensionLow = basicLow + accountLow / divisorInfo.maxDivisor + transition + extra;
    pensionHigh = basicHigh + accountHigh / divisorInfo.minDivisor + transition + extra;
    todayPowerCenter = pensionCenter / Math.pow(1 + inflation, yearsToClaim);
    uncertaintyRatio = pensionCenter > 0 ? (pensionHigh - pensionLow) / pensionCenter : 1;

    if (avgIndexConfidence === 'unknown' || uncertaintyRatio > 0.45 || inferredCalcBase) amountConfidence = '粗略估算';
    else if (uncertaintyRatio <= 0.2 && accountKnown && avgIndexConfidence === 'exact') amountConfidence = '较高';
    else if (uncertaintyRatio <= 0.3) amountConfidence = '中等';
    else amountConfidence = '规划估算';
  }

  return {
    currentAgeMonths,
    claimAgeMonths,
    claimDate,
    retirement,
    paidMonths,
    futureContributionMonths,
    futureContributionSegments: segments,
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
    amountNotes: notes,
    uncertaintyRatio,
    inferredCalcBase,
    divisorExact: divisorInfo.exact,
    divisorMin: divisorInfo.minDivisor,
    divisorMax: divisorInfo.maxDivisor,
  };
}
