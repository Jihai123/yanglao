export const RESIDENT_POLICY_VERSION = '2026-08-28';
export const RESIDENT_CLAIM_AGE_MONTHS = 60 * 12;
export const RESIDENT_MIN_CONTRIBUTION_YEARS = 15;
export const RESIDENT_ACCOUNT_DIVISOR = 139;

function parseMonth(value) {
  const [year, month] = String(value || '').split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) throw new Error('出生年月无效');
  return { year, month };
}

function monthIndex({ year, month }) {
  return year * 12 + month - 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function grow(value, rate, years) {
  return Number(value || 0) * Math.pow(1 + Number(rate || 0), Math.max(0, Number(years || 0)));
}

function futurePayments(firstAnnualPayment, interest, years, yearsToClaim) {
  let balance = 0;
  const wholeYears = Math.max(0, Math.floor(years));
  for (let i = 0; i < wholeYears; i += 1) {
    balance = balance * (1 + interest) + firstAnnualPayment;
  }
  const remainingGrowthYears = Math.max(0, yearsToClaim - wholeYears);
  return grow(balance, interest, remainingGrowthYears);
}

export function residentAgeMonths(birthValue, now = { year: 2026, month: 8 }) {
  const birth = typeof birthValue === 'string' ? parseMonth(birthValue) : birthValue;
  return monthIndex(now) - monthIndex(birth);
}

export function residentClaimDate(birthValue) {
  const birth = typeof birthValue === 'string' ? parseMonth(birthValue) : birthValue;
  const total = monthIndex(birth) + RESIDENT_CLAIM_AGE_MONTHS;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function projectResidentPension(input) {
  const now = input.now || { year: 2026, month: 8 };
  const currentAgeMonths = residentAgeMonths(input.birth, now);
  if (currentAgeMonths < 0) throw new Error('出生年月不能晚于当前月份');

  const monthsTo60 = Math.max(0, RESIDENT_CLAIM_AGE_MONTHS - currentAgeMonths);
  const yearsTo60 = monthsTo60 / 12;
  const maxFutureWholeYears = Math.max(0, Math.ceil(yearsTo60 - 1e-9));
  const requestedFutureYears = Math.max(0, Math.floor(Number(input.futureContributionYears || 0)));
  const futureContributionYears = clamp(requestedFutureYears, 0, maxFutureWholeYears);
  const paidYears = Math.max(0, Number(input.paidYears || 0));
  const totalContributionYears = paidYears + futureContributionYears;
  const shortageYears = Math.max(0, RESIDENT_MIN_CONTRIBUTION_YEARS - totalContributionYears);

  const annualContribution = Math.max(0, Number(input.annualContribution || 0));
  const annualSubsidy = Math.max(0, Number(input.annualSubsidy || 0));
  const annualAccountPayment = annualContribution + annualSubsidy;
  const accountInterest = clamp(Number(input.accountInterest ?? 0.03), 0, 0.15);
  const localBasicPension = Math.max(0, Number(input.localBasicPension || 0));
  const localMonthlyBonus = Math.max(0, Number(input.localMonthlyBonus || 0));

  const hasKnownAccount = Number(input.currentAccount) > 0;
  let currentLow;
  let currentHigh;
  if (hasKnownAccount) {
    currentLow = Number(input.currentAccount);
    currentHigh = Number(input.currentAccount);
  } else {
    // 历史缴费档次和地方补贴可能变化，不知道当前账户时只给宽区间。
    const rough = annualAccountPayment * paidYears;
    currentLow = rough * 0.55;
    currentHigh = rough * 0.95;
  }

  const grownCurrentLow = grow(currentLow, accountInterest, yearsTo60);
  const grownCurrentHigh = grow(currentHigh, accountInterest, yearsTo60);
  const futureAccount = futurePayments(annualAccountPayment, accountInterest, futureContributionYears, yearsTo60);
  const accountLow = grownCurrentLow + futureAccount * 0.95;
  const accountHigh = grownCurrentHigh + futureAccount * 1.05;
  const accountPensionLow = accountLow / RESIDENT_ACCOUNT_DIVISOR;
  const accountPensionHigh = accountHigh / RESIDENT_ACCOUNT_DIVISOR;
  const hasLocalBasic = localBasicPension > 0;
  const pensionLow = hasLocalBasic ? localBasicPension + localMonthlyBonus + accountPensionLow : 0;
  const pensionHigh = hasLocalBasic ? localBasicPension + localMonthlyBonus + accountPensionHigh : 0;

  const warnings = [];
  if (!hasKnownAccount) warnings.push('未填写当前个人账户余额，历史账户按当前缴费档次做宽区间估算。');
  if (!hasLocalBasic) warnings.push('未填写当地基础养老金标准，因此暂不输出总养老金，只展示个人账户养老金部分。');
  if (shortageYears > 0) warnings.push(`按当前计划，到60周岁累计缴费仍预计少 ${shortageYears.toFixed(1).replace('.0', '')} 年；补缴或继续缴费规则需按参保地政策核定。`);

  return {
    currentAgeMonths,
    monthsTo60,
    yearsTo60,
    claimDate: residentClaimDate(input.birth),
    maxFutureWholeYears,
    futureContributionYears,
    totalContributionYears,
    shortageYears,
    eligibleAt60: shortageYears <= 1e-9,
    accountLow,
    accountHigh,
    accountPensionLow,
    accountPensionHigh,
    localBasicPension,
    localMonthlyBonus,
    pensionLow,
    pensionHigh,
    confidence: hasKnownAccount && hasLocalBasic ? '较高' : hasLocalBasic ? '估算' : '资格/账户估算',
    warnings,
  };
}
