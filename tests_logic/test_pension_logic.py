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
        # male
        ("1964-12", "male", "60岁", (2024, 12)),
        ("1965-01", "male", "60岁1个月", (2025, 2)),
        ("1965-04", "male", "60岁1个月", (2025, 5)),
        ("1965-05", "male", "60岁2个月", (2025, 7)),
        ("1976-12", "male", "63岁", (2039, 12)),
        # female cadre
        ("1969-12", "female_cadre", "55岁", (2024, 12)),
        ("1970-01", "female_cadre", "55岁1个月", (2025, 2)),
        ("1970-05", "female_cadre", "55岁2个月", (2025, 7)),
        ("1981-12", "female_cadre", "58岁", (2039, 12)),
        # female worker
        ("1974-12", "female_worker", "50岁", (2024, 12)),
        ("1975-01", "female_worker", "50岁1个月", (2025, 2)),
        ("1975-03", "female_worker", "50岁2个月", (2025, 5)),
        ("1975-11", "female_worker", "50岁6个月", (2026, 5)),
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
        (2028, 15),
        (2029, 15),
        (2030, 15.5),
        (2031, 16),
        (2032, 16.5),
        (2035, 18),
        (2039, 20),
        (2042, 20),
    ],
)
def test_minimum_contribution_year_boundary(year, expected):
    assert get_minimum_contribution_years(year) == expected


@pytest.mark.parametrize(
    ("age", "expected_divisor"),
    [
        (59 * 12, 145),
        (60 * 12, 139),
        (61 * 12, 132),
        (62 * 12, 125),
        (63 * 12, 117),
        (64 * 12, 109),
        (65 * 12, 101),
        (71 * 12, 139),
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


def test_employee_statutory_mode_with_transition_and_extra():
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=120000,
        transition=300,
        extra=200,
    )
    assert math.isclose(result.basic_pension, 3000.0, rel_tol=1e-9)
    assert math.isclose(result.account_pension, 1025.6410256410256, rel_tol=1e-9)
    assert math.isclose(result.total, 4525.641025641025, rel_tol=1e-9)


@pytest.mark.parametrize(
    ("custom_age", "expected_type", "expected_date"),
    [
        (60, "提前退休测算", (2045, 1)),
        (63, "按法定退休年龄", (2048, 1)),
        (66, "延迟退休测算", (2051, 1)),
    ],
)
def test_employee_custom_retirement_types(custom_age, expected_type, expected_date):
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=120000,
        retire_mode="custom",
        custom_age=custom_age,
    )
    assert result.retire_type == expected_type
    assert (result.retire_year, result.retire_month) == expected_date


@pytest.mark.parametrize("custom_age", [59.9, 70])
def test_employee_reject_invalid_custom_age(custom_age):
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=30,
        account=120000,
        retire_mode="custom",
        custom_age=custom_age,
    )
    assert "超出可测算范围" in result.status


@pytest.mark.parametrize(
    ("base", "account", "expected_error"),
    [
        (0, 120000, "请先填写当地养老金计发基数。"),
        (10000, 0, "个人账户累计储存额不能为空"),
    ],
)
def test_employee_required_fields(base, account, expected_error):
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=base,
        index=1,
        years=30,
        account=account,
    )
    assert expected_error in result.status


@pytest.mark.parametrize("years", [10, 14.9, 19.5])
def test_employee_insufficient_contribution_years_status(years):
    result = calc_employee(
        birth="1985-01",
        category="male",
        base=10000,
        index=1,
        years=years,
        account=120000,
    )
    assert "低于本次测算对应的最低缴费年限" in result.status


def test_employee_female_worker_branch_success():
    result = calc_employee(
        birth="1978-05",
        category="female_worker",
        base=9500,
        index=0.8,
        years=28,
        account=80000,
    )
    assert result.retire_type == "按法定退休年龄"
    assert result.divisor > 0
    assert result.total > 0


@pytest.mark.parametrize(
    ("base", "account", "bonus", "age", "expected_status"),
    [
        (961, 60000, 0, 60, "已完成测算。"),
        (961, 60000, 100, 65, "已完成测算。"),
        (961, 60000, 0, 59, "城乡居民养老通常按满 60 周岁领取"),
        (0, 60000, 0, 60, "请先填写当地基础养老金标准。"),
    ],
)
def test_resident_status_cases(base, account, bonus, age, expected_status):
    result = calc_resident(base=base, account=account, bonus=bonus, age=age)
    assert expected_status in result.status


def test_resident_account_component_amount():
    result = calc_resident(base=961, account=60000, bonus=0, age=60)
    assert math.isclose(result.account_pension, 431.6546762589928, rel_tol=1e-9)
    assert math.isclose(result.total, 1392.6546762589928, rel_tol=1e-9)
