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

function normalizeFutureSegments(input, monthsToClaim, fallbackBase) {
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

function normalizeHistorySegments(input, paidMonths, nowYear) {
  if (!Array.isArray(input.historyContributionSegments)) return [];
  const raw = input.historyContributionSegments
    .map(item => {
      const startYear = Math.round(safeNumber(item.startYear));
      const endYear = Math.round(safeNumber(item.endYear));
      const monthlyContributionBase = Math.max(0, safeNumber(item.monthlyContributionBase));
      if (!startYear || !endYear || startYear > endYear || endYear > nowYear || !(monthlyContributionBase > 0)) return null;
      return {
        startYear,
        endYear,
        monthlyContributionBase,
        rawMonths: (endYear - startYear + 1) * 12,
      };
    })
    .filter(Boolean);

  if (!raw.length) return [];
  const rawMonths = raw.reduce((sum, item) => sum + item.rawMonths, 0);
  const scale = paidMonths > 0 && rawMonths > 0 ? paidMonths / rawMonths : 1;
  return raw.map(item => ({
    ...item,
    months: item.rawMonths * scale,
    midpointYear: (item.startYear + item.endYear + 1) / 2,
  }));
}

function historyRangeFromSegments({ segments, currentCalcBase, wageGrowth, nowYear }) {
  if (!segments.length || !(currentCalcBase > 0)) return null;
  let weightedCenter = 0;
  let totalMonths = 0;
  for (const segment of segments) {
    const yearsAgo = Math.max(0, nowYear - segment.midpointYear);
    const historicalReference = currentCalcBase / Math.pow(1 + wageGrowth, yearsAgo);
    const index = clamp(segment.monthlyContributionBase / Math.max(1, historicalReference), 0.3, 3);
    weightedCenter += index * segment.months;
    totalMonths += segment.months;
  }
  if (!totalMonths) return null;
  const center = weightedCenter / totalMonths;
  return {
    center,
    low: clamp(center * 0.88, 0.3, 3),
    high: clamp(center * 1.12, 0.3, 3),
  };
}

function inferCurrentAccount(monthlyContributionBase, paidMonths) {
  const rough = Math.max(0, monthlyContributionBase) * 0.08 * paidMonths;
  return { center: rough * 0.72, low: rough * 0.58, high: rough * 0.88 };
}

function inferAccountFromHistorySegments(segments, accountInterest, nowYear) {
  if (!segments.length) return null;
  let center = 0;
  for (const segment of segments) {
    const yearsAgo = Math.max(0, nowYear - segment.midpointYear);
    const principal = segment.monthlyContributionBase * 0.08 * segment.months;
    center += principal * Math.pow(1 + accountInterest, yearsAgo);
  }
  return { center: center * 0.9, low: center * 0.72, high: center * 1.08 };
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

function projectAccountSegments({ startingBalance, segments, monthsToClaim, wageGrowth, accountInterest }) {
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
  const fallbackHistoryRange = historyIndexRange(input.avgIndex, avgIndexConfidence);
  const monthlyContributionBase = Math.max(0, safeNumber(input.monthlyContributionBase));
  const wageGrowth = clamp(safeNumber(input.wageGrowth, 0.03), -0.02, 0.15);
  const accountInterest = clamp(safeNumber(input.accountInterest, 0.03), 0, 0.15);
  const inflation = clamp(safeNumber(input.inflation, 0.02), 0, 0.15);

  let currentCalcBase = Math.max(0, safeNumber(input.currentCalcBase));
  const inferredCalcBase = !currentCalcBase && monthlyContributionBase > 0;
  if (inferredCalcBase) currentCalcBase = monthlyContributionBase / Math.max(0.3, fallbackHistoryRange.center || 1);

  const historySegments = normalizeHistorySegments(input, paidMonths, now.year);
  const segmentedHistoryRange = historyRangeFromSegments({
    segments: historySegments,
    currentCalcBase,
    wageGrowth,
    nowYear: now.year,
  });
  const historyRange = segmentedHistoryRange || fallbackHistoryRange;

  const futureSegments = normalizeFutureSegments(input, monthsToClaim, monthlyContributionBase);
  const futureContributionMonths = futureSegments.reduce((sum, s) => sum + s.months, 0);
  const totalContributionMonths = paidMonths + futureContributionMonths;
  const remainingActualContributionMonths = Math.max(0, requiredContributionMonths - paidMonths);
  const plannedContributionShortageMonths = Math.max(0, requiredContributionMonths - totalContributionMonths);
  const eligible = plannedContributionShortageMonths === 0;

  const knownAccount = Math.max(0, safeNumber(input.currentAccount));
  const accountKnown = Boolean(input.accountKnown && knownAccount >= 0);
  const historyAccount = inferAccountFromHistorySegments(historySegments, accountInterest, now.year);
  const accountStart = accountKnown
    ? { center: knownAccount, low: knownAccount, high: knownAccount }
    : historyAccount || inferCurrentAccount(monthlyContributionBase, paidMonths);

  const missing = [];
  const notes = [];
  if (input.amountMode === 'skip') missing.push('本次未估算金额');
  if (!(monthlyContributionBase > 0)) missing.push('缺少当前缴费基数');
  if (!(currentCalcBase > 0)) missing.push('缺少养老金计发基准');
  if (futureSegments.some(s => s.months > 0 && !(s.monthlyContributionBase > 0))) missing.push('未来缴费基数未填完整');
  if (historySegments.length) notes.push(`历史按${historySegments.length}段基数估算`);
  else if (avgIndexConfidence === 'unknown') notes.push('历史缴费水平按中性值估算');
  if (!accountKnown) notes.push('个人账户余额为估算值');
  if (inferredCalcBase) notes.push('计发基准为估算值');
  if (futureSegments.length > 1 || futureSegments.some(s => s.monthlyContributionBase !== monthlyContributionBase)) notes.push('未来按分段基数计算');

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
    const combinedIndex = combinedIndexRange({ historyRange, paidMonths, segments: futureSegments, currentCalcBase });
    const calcCenter = annualize(currentCalcBase, wageGrowth, yearsToClaim);
    const growthBand = yearsToClaim > 10 ? 0.01 : 0.005;
    const calcLow = annualize(currentCalcBase * (inferredCalcBase ? 0.94 : 0.98), Math.max(-0.02, wageGrowth - growthBand), yearsToClaim);
    const calcHigh = annualize(currentCalcBase * (inferredCalcBase ? 1.06 : 1.02), wageGrowth + growthBand, yearsToClaim);

    const accountCenter = projectAccountSegments({ startingBalance: accountStart.center, segments: futureSegments, monthsToClaim, wageGrowth, accountInterest });
    const accountLow = projectAccountSegments({ startingBalance: accountStart.low, segments: futureSegments, monthsToClaim, wageGrowth: Math.max(-0.02, wageGrowth - growthBand), accountInterest: Math.max(0, accountInterest - 0.005) });
    const accountHigh = projectAccountSegments({ startingBalance: accountStart.high, segments: futureSegments, monthsToClaim, wageGrowth: wageGrowth + growthBand, accountInterest: accountInterest + 0.005 });

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

    if (avgIndexConfidence === 'unknown' || inferredCalcBase) amountConfidence = '粗略估算';
    else if (avgIndexConfidence === 'segmented' || uncertaintyRatio > 0.3) amountConfidence = '规划估算';
    else if (uncertaintyRatio <= 0.2 && accountKnown && avgIndexConfidence === 'exact') amountConfidence = '较高';
    else amountConfidence = '中等';
  }

  return {
    currentAgeMonths,
    claimAgeMonths,
    claimDate,
    retirement,
    paidMonths,
    historyContributionSegments: historySegments,
    futureContributionMonths,
    futureContributionSegments: futureSegments,
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