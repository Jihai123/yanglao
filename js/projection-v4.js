import {
  calcStatutoryRetirement,
  claimDateFromAge,
  divisorRangeForAgeMonths,
  minimumContributionReferenceYear,
  minimumContributionYears,
  parseMonth,
} from './policy.js?v=20260829-v4';

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

function monthIndex(value) {
  const parsed = parseMonth(value);
  return parsed.year * 12 + parsed.month - 1;
}

function monthValue(index) {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function yearFraction(year, month = 7) {
  return year + (month - 1) / 12;
}

function grow(value, rate, years) {
  return value * Math.pow(1 + rate, years);
}

function historyIndexRange(avgIndex, confidence) {
  const center = clamp(safeNumber(avgIndex, 1), 0.3, 3);
  if (confidence === 'exact') return { center, low: center, high: center, method: 'exact' };
  if (confidence === 'rough') {
    return {
      center,
      low: clamp(center * 0.9, 0.3, 3),
      high: clamp(center * 1.1, 0.3, 3),
      method: 'rough',
    };
  }
  return { center: 1, low: 0.6, high: 1.4, method: 'unknown' };
}

function normalizeHistorySegments(input, now) {
  if (!Array.isArray(input.historyContributionSegments)) return [];
  const nowIndex = now.year * 12 + now.month - 1;
  return input.historyContributionSegments.map(item => {
    try {
      const startIndex = monthIndex(item.startMonth);
      const endIndex = monthIndex(item.endMonth);
      const monthlyContributionBase = Math.max(0, safeNumber(item.monthlyContributionBase));
      if (startIndex > endIndex || endIndex > nowIndex || !(monthlyContributionBase > 0)) return null;
      const months = endIndex - startIndex + 1;
      const midpoint = monthValue(Math.floor((startIndex + endIndex) / 2));
      return {
        startMonth: item.startMonth,
        endMonth: item.endMonth,
        startIndex,
        endIndex,
        months,
        midpointYear: yearFraction(midpoint.year, midpoint.month),
        monthlyContributionBase,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function historyRangeFromSegments({ segments, currentCalcBase, calcBaseYear, historicalReferenceGrowth }) {
  if (!segments.length || !(currentCalcBase > 0) || !(calcBaseYear > 0)) return null;
  let totalMonths = 0;
  let weighted = 0;
  for (const segment of segments) {
    const deltaYears = segment.midpointYear - yearFraction(calcBaseYear, 7);
    const reference = grow(currentCalcBase, historicalReferenceGrowth, deltaYears);
    const index = clamp(segment.monthlyContributionBase / Math.max(1, reference), 0.3, 3);
    weighted += index * segment.months;
    totalMonths += segment.months;
  }
  if (!totalMonths) return null;
  const center = weighted / totalMonths;
  return {
    center,
    low: clamp(center * 0.9, 0.3, 3),
    high: clamp(center * 1.1, 0.3, 3),
    method: 'segments-estimated-reference',
  };
}

function inferAccountFromHistorySegments(segments, accountInterest, now) {
  if (!segments.length) return null;
  const nowFraction = yearFraction(now.year, now.month);
  let center = 0;
  for (const segment of segments) {
    const yearsAgo = Math.max(0, nowFraction - segment.midpointYear);
    const principal = segment.monthlyContributionBase * 0.08 * segment.months;
    center += grow(principal, accountInterest, yearsAgo);
  }
  return { center, low: center * 0.84, high: center * 1.16 };
}

function inferAccountFallback(monthlyContributionBase, paidMonths) {
  const center = Math.max(0, monthlyContributionBase) * 0.08 * Math.max(0, paidMonths) * 0.75;
  return { center, low: center * 0.65, high: center * 1.15 };
}

function normalizeFutureSegments(input, monthsToClaim, fallbackBase) {
  const raw = Array.isArray(input.futureContributionSegments)
    ? input.futureContributionSegments
    : [];
  const capacity = Math.max(0, Math.round(monthsToClaim));
  const result = [];
  let used = 0;
  for (const item of raw) {
    if (used >= capacity) break;
    const startOffsetMonths = clamp(Math.round(safeNumber(item.startOffsetMonths, used)), 0, capacity);
    const remaining = Math.max(0, capacity - used);
    const months = clamp(Math.round(safeNumber(item.months)), 0, remaining);
    if (!months) continue;
    result.push({
      months,
      startOffsetMonths,
      monthlyContributionBase: Math.max(0, safeNumber(item.monthlyContributionBase, fallbackBase)),
      contributionGrowth: clamp(safeNumber(item.contributionGrowth, input.contributionGrowth), -0.02, 0.15),
      spread: Boolean(item.spread),
      label: item.label || '',
    });
    used += months;
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

function projectAccount({ startingBalance, segments, monthsToClaim, accountInterest, band = 0 }) {
  const total = Math.max(0, Math.round(monthsToClaim));
  const monthlyInterest = Math.pow(1 + Math.max(0, accountInterest + band), 1 / 12) - 1;
  let balance = Math.max(0, startingBalance);
  for (let month = 0; month < total; month += 1) {
    balance *= 1 + monthlyInterest;
    for (const segment of segments) {
      if (!segmentPaidAtMonth(segment, month, total)) continue;
      const growth = clamp(segment.contributionGrowth + band, -0.02, 0.15);
      const base = grow(segment.monthlyContributionBase, growth, month / 12);
      balance += Math.max(0, base) * 0.08;
    }
  }
  return balance;
}

function futureIndexRange({ segments, currentCalcBase, socialWageGrowth }) {
  let totalMonths = 0;
  let centerSum = 0;
  let lowSum = 0;
  let highSum = 0;
  for (const segment of segments) {
    const midpointYears = (segment.startOffsetMonths + segment.months / 2) / 12;
    const socialBase = grow(currentCalcBase, socialWageGrowth, midpointYears);
    const contributionBase = grow(segment.monthlyContributionBase, segment.contributionGrowth, midpointYears);
    const center = clamp(contributionBase / Math.max(1, socialBase), 0.3, 3);
    centerSum += center * segment.months;
    lowSum += clamp(center * 0.96, 0.3, 3) * segment.months;
    highSum += clamp(center * 1.04, 0.3, 3) * segment.months;
    totalMonths += segment.months;
  }
  if (!totalMonths) return null;
  return { center: centerSum / totalMonths, low: lowSum / totalMonths, high: highSum / totalMonths };
}

function combinedIndexRange({ historyRange, paidMonths, futureRange, futureMonths }) {
  const total = paidMonths + futureMonths;
  if (!total) return historyRange;
  if (!futureRange || !futureMonths) return historyRange;
  return {
    center: (historyRange.center * paidMonths + futureRange.center * futureMonths) / total,
    low: (historyRange.low * paidMonths + futureRange.low * futureMonths) / total,
    high: (historyRange.high * paidMonths + futureRange.high * futureMonths) / total,
  };
}

export function projectPlanV4(input) {
  const birth = parseMonth(input.birth);
  const now = input.now || currentYearMonth();
  const currentAgeMonths = (now.year * 12 + now.month - 1) - (birth.year * 12 + birth.month - 1);
  if (currentAgeMonths < 0) throw new Error('出生年月不能晚于当前月份');

  const claimAgeMonths = Math.round(safeNumber(input.claimAgeMonths));
  if (!(claimAgeMonths > 0)) throw new Error('退休年龄无效');
  const claimDate = claimDateFromAge(input.birth, claimAgeMonths);
  const retirement = calcStatutoryRetirement(input.birth, input.category);
  const minYearsReferenceYear = minimumContributionReferenceYear(input.birth, input.category, claimAgeMonths);
  const minYears = minimumContributionYears(minYearsReferenceYear);
  const requiredContributionMonths = Math.round(minYears * 12);
  const monthsToClaim = Math.max(0, claimAgeMonths - currentAgeMonths);

  const paidMonths = Math.max(0, Math.round(safeNumber(input.paidMonths)));
  const deemedMonths = Math.max(0, Math.round(safeNumber(input.deemedMonths)));
  const monthlyContributionBase = Math.max(0, safeNumber(input.monthlyContributionBase));
  const socialWageGrowth = clamp(safeNumber(input.socialWageGrowth, 0.03), -0.02, 0.12);
  const historicalReferenceGrowth = clamp(safeNumber(input.historicalReferenceGrowth, 0.03), 0, 0.12);
  const accountInterest = clamp(safeNumber(input.accountInterest, 0.03), 0, 0.12);
  const inflation = clamp(safeNumber(input.inflation, 0.02), 0, 0.12);
  const currentCalcBase = Math.max(0, safeNumber(input.currentCalcBase));
  const calcBaseYear = Math.round(safeNumber(input.currentCalcBaseYear, now.year - 1));
  const calcBaseSourceQuality = input.calcBaseSourceQuality || 'manual';

  const historySegments = normalizeHistorySegments(input, now);
  const fallbackHistoryRange = historyIndexRange(input.avgIndex, input.avgIndexConfidence || 'unknown');
  const segmentedHistoryRange = historyRangeFromSegments({
    segments: historySegments,
    currentCalcBase,
    calcBaseYear,
    historicalReferenceGrowth,
  });
  const historyRange = segmentedHistoryRange || fallbackHistoryRange;

  const futureSegments = normalizeFutureSegments(input, monthsToClaim, monthlyContributionBase);
  const futureContributionMonths = futureSegments.reduce((sum, segment) => sum + segment.months, 0);
  const totalContributionMonths = paidMonths + futureContributionMonths;
  const remainingActualContributionMonths = Math.max(0, requiredContributionMonths - paidMonths);
  const plannedContributionShortageMonths = Math.max(0, requiredContributionMonths - totalContributionMonths);
  const eligible = plannedContributionShortageMonths === 0;

  const accountKnown = Boolean(input.accountKnown && safeNumber(input.currentAccount) >= 0);
  const knownAccount = Math.max(0, safeNumber(input.currentAccount));
  const historyAccount = inferAccountFromHistorySegments(historySegments, accountInterest, now);
  const accountStart = accountKnown
    ? { center: knownAccount, low: knownAccount, high: knownAccount }
    : historyAccount || inferAccountFallback(monthlyContributionBase, paidMonths);

  const missing = [];
  const confidenceReasons = [];
  if (input.amountMode === 'skip') missing.push('本次选择只看退休资格');
  if (!(monthlyContributionBase > 0)) missing.push('缺少当前月缴费基数');
  if (!(currentCalcBase > 0)) missing.push('缺少待遇领取地可用的养老金计发基准');
  if (futureSegments.some(item => item.months > 0 && !(item.monthlyContributionBase > 0))) missing.push('未来缴费基数没有填完整');
  if (deemedMonths > 0 && !(safeNumber(input.transitionAmount) >= 0 && input.transitionAmountKnown)) {
    missing.push('存在视同缴费年限，需要当地过渡性养老金规则或已核定金额');
  }

  if (calcBaseSourceQuality === 'direct') confidenceReasons.push('计发基准来自政府公开来源');
  else if (calcBaseSourceQuality === 'corroborated') confidenceReasons.push('计发基准为公开文件引述的人社数据');
  else if (currentCalcBase > 0) confidenceReasons.push('计发基准由用户手动填写');
  if (historySegments.length) confidenceReasons.push(`历史缴费已按${historySegments.length}段录入`);
  else if ((input.avgIndexConfidence || 'unknown') === 'exact') confidenceReasons.push('历史平均缴费指数为已知值');
  else confidenceReasons.push('历史平均缴费指数仍含估算');
  confidenceReasons.push(accountKnown ? '个人账户余额为已知值' : '个人账户余额为估算值');

  const divisorInfo = divisorRangeForAgeMonths(claimAgeMonths);
  const divisorCenter = (divisorInfo.maxDivisor + divisorInfo.minDivisor) / 2;
  let pensionCenter = 0;
  let pensionLow = 0;
  let pensionHigh = 0;
  let basicCenter = 0;
  let personalCenter = 0;
  let transitionCenter = Math.max(0, safeNumber(input.transitionAmount));
  let todayPowerCenter = 0;
  let uncertaintyRatio = null;
  let amountConfidence = '暂不估金额';
  const amountAvailable = missing.length === 0;

  if (amountAvailable) {
    const baseYearPoint = yearFraction(calcBaseYear, 7);
    const claimYearPoint = yearFraction(claimDate.year, claimDate.month);
    const yearsFromBase = Math.max(0, claimYearPoint - baseYearPoint);
    const calcCenter = grow(currentCalcBase, socialWageGrowth, yearsFromBase);
    const calcLow = grow(currentCalcBase, Math.max(-0.02, socialWageGrowth - 0.0075), yearsFromBase);
    const calcHigh = grow(currentCalcBase, socialWageGrowth + 0.0075, yearsFromBase);

    const futureRange = futureIndexRange({ segments: futureSegments, currentCalcBase, socialWageGrowth });
    const combinedIndex = combinedIndexRange({
      historyRange,
      paidMonths,
      futureRange,
      futureMonths: futureContributionMonths,
    });

    const accountCenter = projectAccount({
      startingBalance: accountStart.center,
      segments: futureSegments,
      monthsToClaim,
      accountInterest,
      band: 0,
    });
    const accountLow = projectAccount({
      startingBalance: accountStart.low,
      segments: futureSegments,
      monthsToClaim,
      accountInterest,
      band: -0.005,
    });
    const accountHigh = projectAccount({
      startingBalance: accountStart.high,
      segments: futureSegments,
      monthsToClaim,
      accountInterest,
      band: 0.005,
    });

    const totalYears = totalContributionMonths / 12;
    basicCenter = calcCenter * ((1 + combinedIndex.center) / 2) * totalYears * 0.01;
    const basicLow = calcLow * ((1 + combinedIndex.low) / 2) * totalYears * 0.01;
    const basicHigh = calcHigh * ((1 + combinedIndex.high) / 2) * totalYears * 0.01;
    personalCenter = accountCenter / divisorCenter;
    const personalLow = accountLow / divisorInfo.maxDivisor;
    const personalHigh = accountHigh / divisorInfo.minDivisor;

    pensionCenter = basicCenter + personalCenter + transitionCenter;
    pensionLow = basicLow + personalLow + transitionCenter;
    pensionHigh = basicHigh + personalHigh + transitionCenter;
    todayPowerCenter = pensionCenter / Math.pow(1 + inflation, monthsToClaim / 12);
    uncertaintyRatio = pensionCenter > 0 ? (pensionHigh - pensionLow) / pensionCenter : 1;

    const historyStrong = input.avgIndexConfidence === 'exact' || historySegments.length > 0;
    if (calcBaseSourceQuality === 'direct' && accountKnown && input.avgIndexConfidence === 'exact' && uncertaintyRatio <= 0.2) amountConfidence = '较高';
    else if ((calcBaseSourceQuality === 'direct' || calcBaseSourceQuality === 'corroborated') && historyStrong && uncertaintyRatio <= 0.35) amountConfidence = '中等';
    else amountConfidence = '粗略估算';
  }

  return {
    currentAgeMonths,
    claimAgeMonths,
    claimDate,
    retirement,
    minYears,
    minYearsReferenceYear,
    requiredContributionMonths,
    paidMonths,
    deemedMonths,
    futureContributionMonths,
    futureContributionSegments: futureSegments,
    totalContributionMonths,
    remainingActualContributionMonths,
    plannedContributionShortageMonths,
    eligible,
    monthsToClaim,
    historyContributionSegments: historySegments,
    amountAvailable,
    amountMissingReasons: missing,
    amountConfidence,
    confidenceReasons,
    pensionCenter,
    pensionLow,
    pensionHigh,
    basicCenter,
    personalCenter,
    transitionCenter,
    todayPowerCenter,
    uncertaintyRatio,
    currentCalcBase,
    calcBaseYear,
    calcBaseSourceQuality,
    divisorExact: divisorInfo.exact,
    divisorMin: divisorInfo.minDivisor,
    divisorMax: divisorInfo.maxDivisor,
  };
}
