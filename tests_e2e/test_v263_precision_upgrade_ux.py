import pytest
from playwright.sync_api import expect, sync_playwright

from tests_e2e.v26_flow_helpers import tune_page

BASE_URL = "http://127.0.0.1:8765/index.html"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


def fresh_page(browser):
    page = tune_page(browser.new_page(viewport={"width": 390, "height": 844}))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.reload(wait_until="networkidle")
    return page, errors


def quick_result(page):
    page.locator('[data-intent="quick"]').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'quick')
    page.locator('[data-key="regionKey"]').select_option('shaanxi')
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()


def upgrade_to_amount(page):
    quick_result(page)
    page.locator('#quickUpgradeBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'identity')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')


def test_v263_quick_result_has_one_precision_upgrade_cta_and_new_flow(browser):
    page, errors = fresh_page(browser)
    quick_result(page)

    expect(page.locator('#quickUpgradeBtn')).to_be_visible()
    expect(page.locator('#quickUpgradeBtnBottom')).to_have_count(0)
    quick_flow = page.evaluate("sessionStorage.getItem('yanglao-v6-flow')")
    assert page.evaluate("sessionStorage.getItem('yanglao-v6-flow-feature')") == 'quick'

    page.locator('#quickUpgradeBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'identity')
    precise_flow = page.evaluate("sessionStorage.getItem('yanglao-v6-flow')")
    assert precise_flow
    assert precise_flow != quick_flow
    assert page.evaluate("sessionStorage.getItem('yanglao-v6-flow-feature')") == 'normal'
    assert errors == []
    page.close()


def test_v263_future_history_month_is_bounded_and_error_focuses_field(browser):
    page, errors = fresh_page(browser)
    upgrade_to_amount(page)

    page.locator('#regionSelect').select_option('shaanxi')
    page.locator('[data-key="monthlyContributionBase"]').fill('6000')
    page.locator('[data-history-mode="segments"]').click()

    start = page.locator('[data-history-field="startMonth"]').first
    end = page.locator('[data-history-field="endMonth"]').first
    base = page.locator('[data-history-field="monthlyContributionBase"]').first
    expected_max = page.evaluate("() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }")
    expect(start).to_have_attribute('max', expected_max)
    expect(end).to_have_attribute('max', expected_max)

    start.fill('2008-10')
    end.fill('2026-10')
    base.fill('6000')
    page.locator('#nextBtn').click()

    expect(page.locator('#stepError')).to_contain_text('历史缴费结束年月不能晚于当前月份')
    expect(end).to_have_attribute('aria-invalid', 'true')
    expect(end).to_be_focused()
    expect(end.locator('xpath=..').locator('.v263-field-error')).to_contain_text('历史缴费结束年月不能晚于当前月份')

    end.fill(expected_max)
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    assert errors == []
    page.close()


def test_v263_release_notes_are_current(browser):
    page, errors = fresh_page(browser)
    notes = page.locator('#releaseNotes')
    expect(notes.locator('.v23-version-badge')).to_have_text('v2.6.3')
    expect(notes).to_contain_text('v2.6.3 · 2026-09-15')
    expect(notes).to_contain_text('历史缴费年月校验')
    expect(notes).to_contain_text('v2.6.0 · 2026-09-12')
    assert errors == []
    page.close()
