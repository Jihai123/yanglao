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


def flex_to_amount(page):
    page.locator('[data-intent="flex"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')


def test_amount_step_starts_neutral_and_requires_explicit_region_choice(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)

    select = page.locator('#regionSelect')
    expect(select).to_have_value('')
    expect(select.locator('option[data-v25-region-placeholder]')).to_have_text('请选择省份')
    expect(page.locator('#stepBody')).to_contain_text('预计在哪个省份办理退休？')
    expect(page.locator('#stepBody')).to_contain_text('请选择预计办理退休的省份，系统会自动匹配已收录的可靠地区参数。')
    expect(page.locator('[data-v23-calc-warning]')).to_be_hidden()
    expect(page.locator('#stepError')).to_have_count(0)

    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    expect(page.locator('#stepError')).to_contain_text('要估算养老金金额，请先选择预计办理退休的省份')

    select.select_option('beijing')
    expect(page.locator('#stepError')).to_have_count(0)
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('12049')
    assert errors == []
    page.close()


def test_explicit_unknown_region_stays_neutral_instead_of_showing_missing_data_error(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)

    select = page.locator('#regionSelect')
    select.select_option('other')
    expect(page.locator('#regionSelect')).to_have_value('other')
    expect(page.locator('#stepBody')).to_contain_text('暂时不确定办理退休地区时，建议先切换“只看资格”')
    expect(page.locator('[data-v23-calc-warning]')).to_be_hidden()

    page.locator('#nextBtn').click()
    expect(page.locator('#stepError')).to_contain_text('暂时不确定可切换“只看资格”')
    assert errors == []
    page.close()
