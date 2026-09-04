export const POLICY_VERSION = '2026-08-28';
export const PENSION_SCOPE = '企业职工基本养老保险（含按职工养老参保的灵活就业人员）';

// 企业职工基本养老保险现行个人账户养老金计发月数表（国发〔2005〕38号口径）。
export const DIVISOR_TABLE = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212,
  47: 208, 48: 204, 49: 199, 50: 195, 51: 190, 52: 185, 53: 180,
  54: 175, 55: 170, 56: 164, 57: 158, 58: 152, 59: 145, 60: 139,
  61: 132, 62: 125, 63: 117, 64: 109, 65: 101, 66: 93, 67: 84,
  68: 75, 69: 65, 70: 56,
};

export function parseMonth(value) {
  const [year, month] = String(value || '').split('-').map(Number);
  if (!Number.isInteger(year) || year < 1900 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('出生年月无效');
  }
  return { year, month };
}

export function addMonths(year, month, months) {
  const add = Math.round(Number(months));
  if (!Number.isFinite(add)) throw new Error('月份参数无效');
  const total = year * 12 + (month - 1) + add;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function monthsBetween(fromYear, fromMonth, toYear, toMonth) {
  return (toYear * 12 + (toMonth - 1)) - (fromYear * 12 + (fromMonth - 1));
}

export function ageMonthsAt(birth, target) {
  return monthsBetween(birth.year, birth.month, target.year, target.month);
}

export function ageText(ageMonths) {
  const months = Math.max(0, Math.round(Number(ageMonths) || 0));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}岁${m}个月` : `${y}岁`;
}

function retirementRule(category) {
  if (category === 'base60') {
    return { originalAgeMonths: 60 * 12, startBirth: { year: 1965, month: 1 }, stepBirthMonths: 4, maxDelayMonths: 36 };
  }
  if (category === 'base55') {
    return { originalAgeMonths: 55 * 12, startBirth: { year: 1970, month: 1 }, stepBirthMonths: 4, maxDelayMonths: 36 };
  }
  if (category === 'base50') {
    return { originalAgeMonths: 50 * 12, startBirth: { year: 1975, month: 1 }, stepBirthMonths: 2, maxDelayMonths: 60 };
  }
  throw new Error('人员退休年龄类别无效');
}

export function calcStatutoryRetirement(birthValue, category) {
  const birth = typeof birthValue === 'string' ? parseMonth(birthValue) : birthValue;
  const rule = retirementRule(category);
  const birthIndex = birth.year * 12 + (birth.month - 1);
  const startIndex = rule.startBirth.year * 12 + (rule.startBirth.month - 1);
  let delay = 0;
  if (birthIndex >= startIndex) {
    delay = Math.floor((birthIndex - startIndex) / rule.stepBirthMonths) + 1;
    delay = Math.min(delay, rule.maxDelayMonths);
  }
  const statutoryAgeMonths = rule.originalAgeMonths + delay;
  const retireDate = addMonths(birth.year, birth.month, statutoryAgeMonths);
  const earliestAgeMonths = Math.max(rule.originalAgeMonths, statutoryAgeMonths - 36);
  const latestAgeMonths = statutoryAgeMonths + 36;
  return {
    originalAgeMonths: rule.originalAgeMonths,
    statutoryAgeMonths,
    earliestAgeMonths,
    latestAgeMonths,
    retireDate,
  };
}

export function minimumContributionYears(claimYear) {
  const y = Number(claimYear);
  if (!Number.isFinite(y)) throw new Error('领取年份无效');
  if (y <= 2029) return 15;
  if (y >= 2039) return 20;
  return 15 + (y - 2029) * 0.5;
}

export function minimumContributionReferenceYear(birthValue, category, claimAgeMonths) {
  const retirement = calcStatutoryRetirement(birthValue, category);
  const claimDate = claimDateFromAge(birthValue, claimAgeMonths);
  // 人社部发〔2024〕94号第七条：弹性提前按所选退休年份；
  // 弹性延迟按本人法定退休年龄对应年份。
  return Number(claimAgeMonths) > retirement.statutoryAgeMonths
    ? retirement.retireDate.year
    : claimDate.year;
}

export function requiredContributionYears(birthValue, category, claimAgeMonths) {
  return minimumContributionYears(minimumContributionReferenceYear(birthValue, category, claimAgeMonths));
}

export function divisorForAgeMonths(ageMonths) {
  const fullAge = Math.floor(Number(ageMonths) / 12);
  const bounded = Math.max(40, Math.min(70, fullAge));
  return DIVISOR_TABLE[bounded];
}

// 现行国家表按整岁列示。对于“60岁1个月”这类非整岁退休年龄，
// V2 不自行宣称一个全国统一的精确月数，而用相邻整岁档形成透明区间。
export function divisorRangeForAgeMonths(ageMonths) {
  const months = Number(ageMonths);
  if (!Number.isFinite(months)) throw new Error('退休年龄无效');
  const fullAge = Math.floor(months / 12);
  const remainder = ((Math.round(months) % 12) + 12) % 12;
  const lowerAge = Math.max(40, Math.min(70, fullAge));
  const lowerDivisor = DIVISOR_TABLE[lowerAge];
  if (remainder === 0 || lowerAge >= 70) {
    return {
      exact: true,
      lowerAge,
      upperAge: lowerAge,
      maxDivisor: lowerDivisor,
      minDivisor: lowerDivisor,
    };
  }
  const upperAge = Math.min(70, lowerAge + 1);
  return {
    exact: false,
    lowerAge,
    upperAge,
    maxDivisor: lowerDivisor,
    minDivisor: DIVISOR_TABLE[upperAge],
  };
}

export function claimDateFromAge(birthValue, ageMonths) {
  const birth = typeof birthValue === 'string' ? parseMonth(birthValue) : birthValue;
  return addMonths(birth.year, birth.month, ageMonths);
}

export function clampClaimAge(requestedAgeMonths, retirement) {
  return Math.max(retirement.earliestAgeMonths, Math.min(retirement.latestAgeMonths, requestedAgeMonths));
}
