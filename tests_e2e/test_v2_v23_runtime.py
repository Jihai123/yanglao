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


def normal_to_amount(page, stop_with_work=False):
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    if stop_with_work:
        page.locator('[data-contribution-plan="stop_with_work"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')


def test_v23_homepage_exposes_public_version_history(browser):
    page, errors = fresh_page(browser)
    expect(page.locator('#releaseNotes')).to_be_visible()
    expect(page.locator('#releaseNotes')).to_contain_text('版本与更新记录')
    expect(page.locator('#releaseNotes')).to_contain_text('v2.3')
    expect(page.locator('#releaseNotes')).to_contain_text('连续点击“查看结果”')
    assert errors == []
    page.close()


def test_v23_verified_beijing_minimum_is_offered_and_unknown_is_removed(browser):
    page, errors = fresh_page(browser)
    normal_to_amount(page)
    page.locator('#regionSelect').select_option('beijing')

    expect(page.locator('[data-v23-flex-mode="minimum"]')).to_be_visible()
    expect(page.locator('[data-v23-flex-mode="minimum"]')).to_contain_text('7,270')
    expect(page.locator('[data-v23-flex-mode="custom"]')).to_be_visible()
    expect(page.locator('#stepBody')).not_to_contain_text('还没决定')
    assert errors == []
    page.close()


def test_v23_unverified_shaanxi_minimum_falls_back_to_custom_without_guessing(browser):
    page, errors = fresh_page(browser)
    normal_to_amount(page)
    page.locator('#regionSelect').select_option('shaanxi')

    expect(page.locator('[data-v23-flex-mode="minimum"]')).to_have_count(0)
    expect(page.locator('[data-v23-flex-mode="custom"]')).to_be_visible()
    expect(page.locator('[data-v23-flex-custom-input]')).to_be_visible()
    expect(page.locator('#stepBody')).to_contain_text('暂未核验')
    assert errors == []
    page.close()


def test_v23_missing_current_base_highlights_and_focuses_field(browser):
    page, errors = fresh_page(browser)
    normal_to_amount(page, stop_with_work=True)
    page.locator('#regionSelect').select_option('shaanxi')
    page.locator('#nextBtn').click()

    current = page.locator('[data-key="monthlyContributionBase"]')
    expect(current).to_have_attribute('aria-invalid', 'true')
    assert 'v23-field-error' in (current.locator('xpath=..').get_attribute('class') or '')
    expect(page.locator('#stepError')).to_contain_text('请填写现在的养老保险月缴费基数')
    assert errors == []
    page.close()


def test_v23_repeated_result_clicks_render_only_once(browser):
    page, errors = fresh_page(browser)
    normal_to_amount(page)
    page.locator('#regionSelect').select_option('beijing')
    base = page.locator('[data-key="monthlyContributionBase"]')
    base.fill('8000')
    base.dispatch_event('change')

    flow_id = page.evaluate("sessionStorage.getItem('yanglao-v6-flow')")
    page.evaluate("""
      const button = document.getElementById('nextBtn');
      for (let i = 0; i < 5; i += 1) {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    """)

    expect(page.locator('#resultView')).to_be_visible()
    result_events = page.evaluate(
        """flow => (window.dataLayer || []).filter(e => e.event === 'result_view' && e.flow_id === flow).length""",
        flow_id,
    )
    assert result_events == 1
    assert errors == []
    page.close()


def test_v23_continue_from_age_starts_normal_analytics_flow(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="age"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    page.locator('#continuePlanBtn').click()

    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')
    latest_normal = page.evaluate("""
      () => (window.dataLayer || []).filter(e => e.event === 'flow_start' && e.feature === 'normal').slice(-1)[0] || null
    """)
    assert latest_normal and latest_normal['flow_id']
    assert errors == []
    page.close()
