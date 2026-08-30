import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://127.0.0.1:8765/index.html"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


def fresh_page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.reload(wait_until="networkidle")
    return page, errors


def go_to_early_amount(page):
    page.locator('[data-intent="early"]').click()
    page.locator('#nextBtn').click()  # identity -> status
    page.locator('#nextBtn').click()  # status -> plan
    page.locator('[data-contribution-plan="stop_with_work"]').click()
    page.locator('#nextBtn').click()  # plan -> amount
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    page.locator('[data-history-mode="segments"]').click()


def test_history_months_survive_add_row(browser):
    page, errors = fresh_page(browser)
    go_to_early_amount(page)

    page.locator('[data-history-field="startMonth"]').first.fill('2008-09')
    page.locator('[data-history-field="endMonth"]').first.fill('2026-08')
    page.locator('[data-history-field="monthlyContributionBase"]').first.fill('10000')
    page.locator('#historyAddBtn').click()

    expect(page.locator('[data-history-field="startMonth"]').first).to_have_value('2008-09')
    expect(page.locator('[data-history-field="endMonth"]').first).to_have_value('2026-08')
    expect(page.locator('[data-history-field="monthlyContributionBase"]').first).to_have_value('10000')
    assert errors == []
    page.close()


def test_history_months_survive_back_and_forward(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="early"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    page.locator('[data-contribution-plan="to_minimum"]').click()
    page.locator('[data-after-stop="flex"]').click()
    page.locator('[data-flex-base-mode="custom"]').click()
    page.locator('[data-key="flexMonthlyContributionBase"]').fill('4000')
    page.locator('[data-key="flexMonthlyContributionBase"]').press('Tab')
    page.locator('#nextBtn').click()

    page.locator('[data-history-mode="segments"]').click()
    page.locator('[data-history-field="startMonth"]').first.fill('2008-09')
    page.locator('[data-history-field="endMonth"]').first.fill('2026-08')
    page.locator('[data-history-field="monthlyContributionBase"]').first.fill('10000')

    page.locator('#backBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')

    expect(page.locator('[data-history-field="startMonth"]').first).to_have_value('2008-09')
    expect(page.locator('[data-history-field="endMonth"]').first).to_have_value('2026-08')
    expect(page.locator('[data-history-field="monthlyContributionBase"]').first).to_have_value('10000')
    assert errors == []
    page.close()


def test_old_shaanxi_blank_manual_calc_base_is_migrated(browser):
    page, errors = fresh_page(browser)
    page.evaluate("""
      localStorage.setItem('yanglao-v4-plan', JSON.stringify({
        regionKey: 'shaanxi',
        calcBaseMode: 'manual',
        currentCalcBase: '',
        currentCalcBaseYear: ''
      }));
    """)
    page.reload(wait_until='networkidle')
    saved = page.evaluate("JSON.parse(localStorage.getItem('yanglao-v4-plan'))")
    assert saved['currentCalcBase'] == 7881
    assert saved['currentCalcBaseYear'] == 2025
    assert saved['calcBaseMode'] == 'auto'
    assert errors == []
    page.close()


def test_feedback_no_longer_requires_github(browser):
    page, errors = fresh_page(browser)
    expect(page.locator('body')).not_to_contain_text('需要登录 GitHub')
    expect(page.locator('#feedbackSubmit')).to_contain_text('提交吐槽')
    assert errors == []
    page.close()
