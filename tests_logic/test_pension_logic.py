import math

import pytest

from tests_logic.pension_logic import (
    calc_employee,
    calc_resident,
    calc_statutory_retirement,
    get_divisor_by_age_months,
    get_minimum_contribution_years,
)


@pytest.mark.parametrize(
    ("birth", "category", "exp_age", "exp_retire"),
    [
        ("1964-12", "male", "60岁", (2024, 12)),
        ("1965-01", "male", "60岁1个月", (2025, 2)),
        ("1976-12", "male", "63岁", (2039, 12)),
        ("1969-12", "female_cadre", "55岁", (2024, 12)),
        ("1970-01", "female_cadre", "55岁1个月", (2025, 2)),
        ("1981-12", "female_cadre", "58岁", (2039, 12)),
        ("1974-12", "female_worker", "50岁", (2024, 12)),
        ("1975-01", "female_worker", "50岁1个月", (2025, 2)),
        ("1984-11", "female_worker", "55岁", (2039, 11)),
    ],
)
def test_statutory_retirement_rules_and_boundaries(birth, category, exp_age, exp_retire):
    result = calc_statutory_retirement(birth, category)
    assert result.statutory_age_text == exp_age
    assert (result.retire_year, result.retire_month) == exp_retire


@pytest.mark.parametrize(
    ("year", "expected"),
    [
        (2029, 15),
        (2030, 15.5),
        (2031, 16),
        (2039, 20),
    ],
)
def test_minimum_contribution_year_boundary(year, expected):
    assert get_minimum_contribution_years(year) == expected


@pytest.mark.parametrize(
    ("age", "expected_divisor"),
    [
        (60 * 12, 139),
        (61 * 12, 132),
        (62 * 12, 125),
        (63 * 12, 117),
        (65 * 12, 101),
    ],
)
def test_divisor_mapping(age, expected_divisor):
    assert get_divisor_by_age_months(age) == expected_divisor


def test_employee_statutory_mode_amounts_and_success_status():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=12183,
        index=1,
        years=30,
        account=120000,
    )
    assert result.retire_type == "按法定退休年龄"
    assert result.divisor == 117
    assert math.isclose(result.basic_pension, 3654.9, rel_tol=1e-9)
    assert math.isclose(result.account_pension, 1025.6410256410256, rel_tol=1e-9)
    assert math.isclose(result.total, 4680.541025641026, rel_tol=1e-9)
    assert result.status == "已完成测算。"


def test_employee_early_retirement_mode():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=120000,
        retire_mode="custom",
        custom_age=60,
    )
    assert result.retire_type == "提前退休测算"
    assert (result.retire_year, result.retire_month) == (2045, 1)


def test_employee_delayed_retirement_mode():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=120000,
        retire_mode="custom",
        custom_age=66,
    )
    assert result.retire_type == "延迟退休测算"
    assert (result.retire_year, result.retire_month) == (2051, 1)


def test_employee_reject_invalid_custom_age():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=120000,
        retire_mode="custom",
        custom_age=70,
    )
    assert "超出可测算范围" in result.status


def test_employee_reject_empty_account():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=0,
    )
    assert "个人账户累计储存额不能为空" in result.status


def test_employee_reject_empty_base():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=0,
        index=1,
        years=30,
        account=120000,
    )
    assert result.status == "请先填写当地养老金计发基数。"


def test_employee_insufficient_contribution_years_status():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=10,
        account=120000,
    )
    assert "低于本次测算对应的最低缴费年限" in result.status


def test_resident_normal_age_60():
    result = calc_resident(base=961, account=60000, bonus=0, age=60)
    assert result.status == "已完成测算。"
    assert math.isclose(result.account_pension, 431.6546762589928, rel_tol=1e-9)
    assert math.isclose(result.total, 1392.6546762589928, rel_tol=1e-9)


def test_resident_risk_when_age_below_60():
    result = calc_resident(base=961, account=60000, bonus=0, age=59)
    assert "满 60 周岁领取" in result.status


def test_resident_reject_empty_base():
    result = calc_resident(base=0, account=60000, bonus=0, age=60)
    assert result.status == "请先填写当地基础养老金标准。"
