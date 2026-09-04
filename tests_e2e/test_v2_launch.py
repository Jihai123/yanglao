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

@pytest.mark.parametrize("intent", ["age", "normal", "early", "flex"])
def test_all_employee_entry_points_reach_result(browser, intent):
    page, errors = new_page(browser)
    finish_employee(page, intent)
    expect(page.locator(".result-hero")).to_be_visible()
    assert errors == []
    page.close()

def test_normal_flow_uses_real_future_contribution_choices(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    expect(page.locator('[data-contribution-plan]')).to_have_count(4)
    for index in range(4):
        expect(page.locator('[data-contribution-plan]').nth(index)).to_be_enabled()
    expect(page.locator('#stepTitle')).to_contain_text('养老保险准备怎么缴')
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

def test_qualification_only_mode_reaches_result_without_amount(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="normal"]').click()
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
