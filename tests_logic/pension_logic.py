from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

DIVISOR_TABLE: Dict[int, int] = {
    40: 233,
    41: 230,
    42: 226,
    43: 223,
    44: 220,
    45: 216,
    46: 212,
    47: 207,
    48: 204,
    49: 199,
    50: 195,
    51: 190,
    52: 185,
    53: 180,
    54: 175,
    55: 170,
    56: 164,
    57: 158,
    58: 152,
    59: 145,
    60: 139,
    61: 132,
    62: 125,
    63: 117,
    64: 109,
    65: 101,
    66: 93,
    67: 84,
    68: 75,
    69: 65,
    70: 56,
}


@dataclass(frozen=True)
class RetirementRule:
    base_age: int
    start_birth_year: int
    start_birth_month: int
    step_months: int
    max_delay: int


@dataclass(frozen=True)
class StatutoryRetirement:
    base_age_months: int
    statutory_age_months: int
    statutory_age_text: str
    retire_year: int
    retire_month: int


@dataclass(frozen=True)
class EmployeeResult:
    total: float
    basic_pension: float
    account_pension: float
    transition: float
    extra: float
    divisor: int
    min_years: float
    retire_type: str
    retire_year: int
    retire_month: int
    status: str


@dataclass(frozen=True)
class ResidentResult:
    total: float
    basic_pension: float
    account_pension: float
    bonus: float
    divisor: int
    status: str


RULES = {
    "male": RetirementRule(base_age=60, start_birth_year=1965, start_birth_month=1, step_months=4, max_delay=36),
    "female_cadre": RetirementRule(base_age=55, start_birth_year=1970, start_birth_month=1, step_months=4, max_delay=36),
    "female_worker": RetirementRule(base_age=50, start_birth_year=1975, start_birth_month=1, step_months=2, max_delay=60),
}


def parse_month_value(value: str) -> tuple[int, int]:
    year, month = value.split("-")
    return int(year), int(month)


def add_months(year: int, month: int, add: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + add
    return total // 12, (total % 12) + 1


def format_age(base_years: int, delay_months: int) -> str:
    years = base_years + delay_months // 12
    months = delay_months % 12
    return f"{years}岁{months}个月" if months else f"{years}岁"


def fmt_age_months(age_months: int) -> str:
    years = age_months // 12
    months = age_months % 12
    return f"{years}岁{months}个月" if months else f"{years}岁"


def age_decimal_to_months(age: float) -> int:
    return round(age * 12)


def calc_statutory_retirement(birth_ym: str, category: str) -> StatutoryRetirement:
    year, month = parse_month_value(birth_ym)
    rule = RULES[category]
    original_retire_year, original_retire_month = add_months(year, month, rule.base_age * 12)

    start_cohort_months = rule.start_birth_year * 12 + (rule.start_birth_month - 1)
    birth_months = year * 12 + (month - 1)
    delay_months = 0
    if birth_months >= start_cohort_months:
        delay_months = (birth_months - start_cohort_months) // rule.step_months + 1
        delay_months = min(delay_months, rule.max_delay)

    retire_year, retire_month = add_months(original_retire_year, original_retire_month, delay_months)

    return StatutoryRetirement(
        base_age_months=rule.base_age * 12,
        statutory_age_months=rule.base_age * 12 + delay_months,
        statutory_age_text=format_age(rule.base_age, delay_months),
        retire_year=retire_year,
        retire_month=retire_month,
    )


def get_divisor_by_age_months(age_months: int) -> int:
    rounded = round(age_months / 12)
    return DIVISOR_TABLE.get(rounded, 139)


def get_minimum_contribution_years(year: int) -> float:
    if year <= 2029:
        return 15
    if year >= 2039:
        return 20
    return 15 + (year - 2029) * 0.5


def calc_employee(
    *,
    birth: str,
    category: str,
    base: float,
    index: float,
    years: float,
    account: float,
    transition: float = 0,
    extra: float = 0,
    retire_mode: str = "statutory",
    custom_age: float | None = None,
) -> EmployeeResult:
    stat = calc_statutory_retirement(birth, category)
    used_age_months = stat.statutory_age_months
    retire_type = "按法定退休年龄"
    retire_year = stat.retire_year
    retire_month = stat.retire_month
    min_years_ref_year = stat.retire_year

    if retire_mode == "custom":
        assert custom_age is not None, "custom_age is required in custom mode"
        used_age_months = age_decimal_to_months(custom_age)
        min_allowed = max(stat.base_age_months, stat.statutory_age_months - 36)
        max_allowed = stat.statutory_age_months + 36
        if used_age_months < min_allowed or used_age_months > max_allowed:
            return EmployeeResult(
                total=0,
                basic_pension=0,
                account_pension=0,
                transition=transition,
                extra=extra,
                divisor=0,
                min_years=0,
                retire_type="",
                retire_year=0,
                retire_month=0,
                status=f"计划退休年龄超出可测算范围。当前可选范围约为 {fmt_age_months(min_allowed)} ～ {fmt_age_months(max_allowed)}。",
            )

        birth_year, birth_month = parse_month_value(birth)
        retire_year, retire_month = add_months(birth_year, birth_month, used_age_months)

        if used_age_months < stat.statutory_age_months:
            retire_type = "提前退休测算"
            min_years_ref_year = retire_year
        elif used_age_months > stat.statutory_age_months:
            retire_type = "延迟退休测算"

    divisor = get_divisor_by_age_months(used_age_months)
    min_years = get_minimum_contribution_years(min_years_ref_year)
    basic_pension = base * ((1 + index) / 2) * years * 0.01
    account_pension = account / divisor
    total = basic_pension + account_pension + transition + extra

    if not base:
        status = "请先填写当地养老金计发基数。"
    elif not account:
        status = "个人账户累计储存额不能为空，建议先查询后再计算。"
    elif years < min_years:
        status = f"当前累计缴费年限为 {years} 年，低于本次测算对应的最低缴费年限 {min_years} 年。"
    else:
        status = "已完成测算。"

    return EmployeeResult(
        total=total,
        basic_pension=basic_pension,
        account_pension=account_pension,
        transition=transition,
        extra=extra,
        divisor=divisor,
        min_years=min_years,
        retire_type=retire_type,
        retire_year=retire_year,
        retire_month=retire_month,
        status=status,
    )


def calc_resident(*, base: float, account: float, bonus: float, age: int) -> ResidentResult:
    divisor = 139
    account_pension = account / divisor
    total = base + account_pension + bonus
    if not base:
        status = "请先填写当地基础养老金标准。"
    elif age < 60:
        status = "城乡居民养老通常按满 60 周岁领取，请先核实本地政策。"
    else:
        status = "已完成测算。"

    return ResidentResult(
        total=total,
        basic_pension=base,
        account_pension=account_pension,
        bonus=bonus,
        divisor=divisor,
        status=status,
    )
