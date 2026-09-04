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


def goto_amount(page, intent="normal"):
    page.locator(f'[data-intent="{intent}"]').click()
    page.locator('#nextBtn').click()  # identity -> status
    page.locator('#nextBtn').click()  # status -> plan
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    if intent == "normal":
        page.locator('[data-contribution-plan="stop_with_work"]').click()
    page.locator('#nextBtn').click()  # plan -> amount
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')


def test_homepage_has_clear_single_line_value_proposition_and_hierarchy(browser):
    page, errors = new_page(browser, 1280, 900)
    expect(page.locator('.hero h1')).to_have_text('什么时候退休，能领多少？')
    assert '<br' not in page.locator('.hero h1').inner_html().lower()
    expect(page.locator('.primary-intent')).to_have_count(2)
    expect(page.locator('#feedbackWall')).to_be_visible()
    expect(page.locator('#releaseNotes')).to_be_visible()
    expect(page.locator('#releaseNotes')).to_contain_text('v2.3')
    assert errors == []
    page.close()


def test_home_button_returns_from_wizard_without_clearing(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="age"]').click()
    expect(page.locator('#wizardView')).to_be_visible()
    page.locator('#homeBtn').click()
    expect(page.locator('#homeView')).to_be_visible()
    assert errors == []
    page.close()


def test_account_balance_has_lookup_help(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_contain_text('个人账户余额在哪查？')
    assert errors == []
    page.close()


def test_plan_moves_future_base_choice_to_amount_and_offers_verified_minimum(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="early"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    expect(page.locator('[data-contribution-plan="to_minimum"]')).to_be_visible()
    expect(page.locator('#stepBody')).to_contain_text('缴够最低要求就停')
    expect(page.locator('[data-flex-base-mode="unknown"]')).to_have_count(0)
    expect(page.locator('#stepBody')).to_contain_text('下一步结合地区标准选择')

    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    page.locator('#regionSelect').select_option('beijing')
    expect(page.locator('[data-v25-flex-mode="minimum"]')).to_be_visible()
    expect(page.locator('[data-v25-flex-mode="minimum"]')).to_contain_text('7,270')
    expect(page.locator('[data-v25-flex-mode="custom"]')).to_be_visible()
    expect(page.locator('#stepBody')).not_to_contain_text('还没决定')
    assert errors == []
    page.close()


def test_amount_step_uses_benefit_location_wording(browser):
    page, errors = new_page(browser)
    goto_amount(page, 'normal')
    expect(page.locator('#stepBody')).to_contain_text('预计在哪个省份办理退休？')
    expect(page.locator('#stepBody')).to_contain_text('不是退休后居住地')
    expect(page.locator('#stepBody')).not_to_contain_text('参保 / 退休地区')
    assert errors == []
    page.close()


def test_history_segments_use_months_and_preserve_exact_user_value(browser):
    page, errors = new_page(browser)
    goto_amount(page, 'normal')
    page.locator('[data-history-mode="segments"]').click()
    start = page.locator('[data-history-field="startMonth"]').first
    end = page.locator('[data-history-field="endMonth"]').first
    base = page.locator('[data-history-field="monthlyContributionBase"]').first
    start.fill('2020-01')
    end.fill('2020-12')
    base.fill('20000')
    expect(base).to_have_value('20000')
    page.locator('#historyAddBtn').click()
    expect(page.locator('[data-history-field="monthlyContributionBase"]').first).to_have_value('20000')
    assert page.locator('[data-history-field="startMonth"]').first.get_attribute('type') == 'month'
    assert errors == []
    page.close()


def test_valid_shaanxi_plan_shows_breakdown_and_multi_year_comparison(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="early"]').click()
    page.locator('#nextBtn').click()  # identity -> status
    page.locator('#nextBtn').click()  # status -> plan
    page.locator('#nextBtn').click()  # plan -> amount

    page.locator('#regionSelect').select_option('shaanxi')
    page.locator('[data-v25-flex-mode="custom"]').click()
    future = page.locator('[data-v23-flex-custom-input]')
    expect(future).to_be_visible()
    future.fill('4000')
    future.dispatch_event('input')
    current_base = page.locator('[data-key="monthlyContributionBase"]')
    current_base.fill('8000')
    current_base.dispatch_event('change')
    page.locator('[data-history-mode="exact"]').click()
    avg = page.locator('[data-key="avgIndex"]')
    avg.fill('1')
    avg.dispatch_event('change')
    page.locator('#nextBtn').click()

    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('.pension-breakdown')).to_be_visible()
    expect(page.locator('.pension-breakdown')).to_contain_text('基础养老金')
    expect(page.locator('.pension-breakdown')).to_contain_text('个人账户养老金')
    expect(page.locator('.compare-card')).to_be_visible()
    expect(page.locator('.compare-card')).to_contain_text('多缴几年，能多领多少？')
    expect(page.locator('#homeResultBtn')).to_be_visible()
    assert errors == []
    page.close()
