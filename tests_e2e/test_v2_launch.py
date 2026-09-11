import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://127.0.0.1:8765/index.html"

@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

def new_page(browser, width=390, height=844):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.reload(wait_until="networkidle")
    return page, errors

def finish_employee(page, intent):
    page.locator(f'[data-intent="{intent}"]').click()
    for _ in range(8):
        if page.locator("#resultView").is_visible():
            break
        if page.locator('#stepBody').get_attribute('data-step') == 'amount' and page.locator('[data-amount-mode="skip"]').count():
            page.locator('[data-amount-mode="skip"]').click()
        page.locator("#nextBtn").click()
    expect(page.locator("#resultView")).to_be_visible()

def enter_quick_amount(page):
    page.locator('#pensionQuickEntry').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'identity')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')

def finish_quick_amount(page):
    enter_quick_amount(page)
    page.locator('#regionSelect').select_option('beijing')
    page.locator('[data-key="monthlyContributionBase"]').fill('7000')
    expect(page.locator('[data-key="currentCalcBase"]')).not_to_have_value('')
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()


def test_mobile_home_and_birth_input_do_not_overflow(browser):
    page, errors = new_page(browser, 390, 844)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1") is True
    page.locator('[data-intent="age"]').click()
    month_input = page.locator('input[type="month"]')
    card = page.locator('#wizardView .card')
    ib = month_input.bounding_box(); cb = card.bounding_box()
    assert ib and cb
    assert ib["x"] >= cb["x"] - 1
    assert ib["x"] + ib["width"] <= cb["x"] + cb["width"] + 1
    assert errors == []
    page.close()

@pytest.mark.parametrize("intent", ["age", "early", "flex"])
def test_employee_planning_entry_points_reach_result(browser, intent):
    page, errors = new_page(browser)
    finish_employee(page, intent)
    expect(page.locator(".result-hero")).to_be_visible()
    assert errors == []
    page.close()


def test_quick_pension_entry_uses_three_step_funnel(browser):
    page, errors = new_page(browser)
    enter_quick_amount(page)
    expect(page.locator('#stepTitle')).to_contain_text('最后补 2 项')
    expect(page.locator('[data-v26-note="amount"]')).to_contain_text('默认按法定退休时间')
    expect(page.locator('[data-v26-optional-amount]')).to_be_visible()
    features = page.evaluate("window.dataLayer.filter(item => item.event === 'flow_start').map(item => item.feature)")
    assert 'normal_quick' in features
    assert errors == []
    page.close()


def test_quick_pension_reaches_amount_result_with_verified_region(browser):
    page, errors = new_page(browser)
    finish_quick_amount(page)
    expect(page.locator('.amount-decision.amount-good')).to_be_visible()
    expect(page.locator('[data-v26-result-upgrade]')).to_be_visible()
    assert errors == []
    page.close()


def test_quick_result_can_upgrade_to_full_planning(browser):
    page, errors = new_page(browser)
    finish_quick_amount(page)
    page.locator('#v26DetailedPlanBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'identity')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    expect(page.locator('[data-contribution-plan]')).to_have_count(4)
    assert errors == []
    page.close()


def test_retirement_planning_uses_three_modes_not_month_list(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="early"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    expect(page.locator('[data-retirement-mode]')).to_have_count(3)
    expect(page.locator('[data-key="claimAgeMonths"]')).to_have_count(0)
    assert errors == []
    page.close()


def test_planning_qualification_only_mode_reaches_result_without_amount(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="flex"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    page.locator('[data-contribution-plan="stop_with_work"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    page.locator('[data-amount-mode="skip"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('#resultView')).to_contain_text('未估算')
    assert errors == []
    page.close()


def test_resident_flow_reaches_result_and_shows_official_basis(browser):
    page, errors = new_page(browser)
    page.locator('#residentEntry').click()
    expect(page.locator('#residentView')).to_be_visible()
    page.locator('#residentNext').click(); page.locator('#residentNext').click(); page.locator('#residentNext').click()
    expect(page.locator('#residentView .result-hero')).to_be_visible()
    expect(page.locator('#residentView #resultTrustCard')).to_be_visible()
    assert errors == []
    page.close()


def test_front_page_has_user_copy_not_internal_seo_copy(browser):
    page, errors = new_page(browser, 1280, 900)
    expect(page.locator('.seo-guide')).to_be_visible()
    expect(page.locator('#trustSlot .trust-strip')).to_be_visible()
    expect(page.locator('body')).not_to_contain_text('工具优先给结果')
    expect(page.locator('body')).not_to_contain_text('方便搜索')
    expect(page.locator('body')).not_to_contain_text('不会每天把日期自动改成')
    assert errors == []
    page.close()
