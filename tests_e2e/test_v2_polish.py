import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://127.0.0.1:8765/index.html"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


def fresh_page(browser, width=390, height=844):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.reload(wait_until="networkidle")
    return page, errors


def test_female_unsure_shows_two_possible_retirement_results(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="age"]').click()
    page.locator('[data-sex="female"]').click()
    page.locator('[data-female-category="unsure"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('#resultView')).to_contain_text('两种可能')
    expect(page.locator('.age-result-card')).to_have_count(2)
    assert errors == []
    page.close()


def test_future_gap_plan_supports_flexible_employment_base(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="flex"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    expect(page.locator('[data-contribution-plan="actual_months"]')).to_be_visible()
    page.locator('[data-contribution-plan="actual_months"]').click()
    expect(page.locator('[data-key="actualFutureYears"]')).to_be_visible()
    expect(page.locator('[data-after-stop="flex"]')).to_be_visible()
    expect(page.locator('[data-flex-base-mode="unknown"]')).to_be_visible()
    page.locator('[data-flex-base-mode="custom"]').click()
    expect(page.locator('[data-key="flexMonthlyContributionBase"]')).to_be_visible()
    assert page.locator('[data-key="flexMonthlyContributionBase"]').input_value() == ''
    assert errors == []
    page.close()


def test_unknown_history_still_emits_estimate_when_region_anchor_is_available(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    page.locator('#regionSelect').select_option('shaanxi')
    base = page.locator('[data-key="monthlyContributionBase"]')
    base.fill('8000'); base.dispatch_event('change')
    page.locator('[data-history-mode="quick"]').click()
    page.locator('[data-history-pattern="unknown"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('#resultView')).to_contain_text('预计每月养老金')
    expect(page.locator('#resultView')).to_contain_text('粗略估算')
    assert errors == []
    page.close()


def test_segmented_history_editor_adds_month_rows(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    page.locator('[data-history-mode="segments"]').click()
    expect(page.locator('.history-row')).to_have_count(1)
    expect(page.locator('[data-history-field="startMonth"]')).to_have_count(1)
    page.locator('#historyAddBtn').click()
    expect(page.locator('.history-row')).to_have_count(2)
    assert errors == []
    page.close()


def test_resident_flow_explicitly_uses_resident_rules(browser):
    page, errors = fresh_page(browser)
    page.locator('#residentEntry').click()
    expect(page.locator('#residentView')).to_be_visible()
    expect(page.locator('#residentView')).to_contain_text('城乡居民养老')
    expect(page.locator('#residentView')).to_contain_text('60周岁、累计缴费满15年')
    assert errors == []
    page.close()
