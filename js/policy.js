export const POLICY_VERSION = '2026-08-28';

export const DIVISOR_TABLE = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212,
  47: 208, 48: 204, 49: 199, 50: 195, 51: 190, 52: 185, 53: 180,
  54: 175, 55: 170, 56: 164, 57: 158, 58: 152, 59: 145, 60: 139,
  61: 132, 62: 125, 63: 117, 64: 109, 65: 101, 66: 93, 67: 84,
  68: 75, 69: 65, 70: 56,
};

export function parseMonth(value) {
  const [year, month] = String(value || '').split('-').map(Number);
  if (!year || !month) throw new Error('出生年月无效');
  return { year, month };
}

export function addMonths(year, month, months) {
  const total = year * 12 + (month - 1) + Math.round(months);
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function monthsBetween(fromYear, fromMonth, toYear, toMonth) {
  return (toYear * 12 + (toMonth - 1)) - (fromYear * 12 + (fromMonth - 1));
}

export function ageMonthsAt(birth, target) {
  return monthsBetween(birth.year, birth.month, target.year, target.month);
}

export function ageText(ageMonths) {
  const months = Math.max(0, Math.round(ageMonths));
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
  return { originalAgeMonths: 50 * 12, startBirth: { year: 1975, month: 1 }, stepBirthMonths: 2, maxDelayMonths: 60 };
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
  if (y <= 2029) return 15;
  if (y >= 2039) return 20;
  return 15 + (y - 2029) * 0.5;
}

export function divisorForAgeMonths(ageMonths) {
  // 国家计发月数表按退休时“周岁年龄”对应，不能四舍五入。
  const fullAge = Math.floor(Number(ageMonths) / 12);
  const bounded = Math.max(40, Math.min(70, fullAge));
  return DIVISOR_TABLE[bounded];
}

export function claimDateFromAge(birthValue, ageMonths) {
  const birth = typeof birthValue === 'string' ? parseMonth(birthValue) : birthValue;
  return addMonths(birth.year, birth.month, ageMonths);
}

export function clampClaimAge(requestedAgeMonths, retirement) {
  return Math.max(retirement.earliestAgeMonths, Math.min(retirement.latestAgeMonths, requestedAgeMonths));
}
