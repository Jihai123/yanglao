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


def test_v25_recent_fallback_minimum_is_offered_with_year_not_disguised_as_current(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('sichuan')

    minimum = page.locator('[data-v25-flex-mode="minimum"]')
    expect(minimum).to_be_visible()
    expect(minimum).to_contain_text('按最近官方最低标准')
    expect(minimum).to_contain_text('4,588')
    expect(minimum).to_contain_text('2025年最近官方标准')
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('')
    expect(page.locator('#stepBody')).to_contain_text('暂未收录可自动带入的可靠养老金计算参考值')
    assert errors == []
    page.close()


def test_v25_beijing_auto_fills_calc_reference_and_labels_fallback_year(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('beijing')

    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('12049')
    expect(page.locator('[data-key="currentCalcBaseYear"]')).to_have_value('2025')
    region_field = page.locator('#regionSelect').locator('xpath=..')
    expect(region_field).to_contain_text('养老金计算参考值')
    expect(region_field).to_contain_text('12,049')
    expect(region_field).to_contain_text('2025年最近可核验官方值')
    assert errors == []
    page.close()


def test_v25_liaoning_requires_subregion_then_uses_shenyang_calc_base(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('liaoning')

    expect(page.locator('#subregionSelect')).to_be_visible()
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('')
    page.locator('#subregionSelect').select_option('shenyang')
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('8390')
    expect(page.locator('#stepBody')).to_contain_text('沈阳')
    assert errors == []
    page.close()


def test_v25_subregion_guard_blocks_result_until_required_area_is_selected(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('liaoning')
    page.locator('#nextBtn').click()

    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    expect(page.locator('#stepError')).to_contain_text('请先选择对应地区范围')
    expect(page.locator('#nextBtn')).not_to_have_attribute('aria-busy', 'true')
    assert errors == []
    page.close()


def test_v25_shandong_never_leaks_non_heze_calc_base_into_heze(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('shandong')

    page.locator('#subregionSelect').select_option('province_except_heze')
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('7831')

    page.locator('#subregionSelect').select_option('heze')
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('')
    expect(page.locator('#stepBody')).to_contain_text('暂未收录可自动带入的可靠养老金计算参考值')
    assert errors == []
    page.close()


def test_v25_guangdong_uses_verified_shenzhen_calc_base_but_keeps_contribution_manual(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('guangdong')

    page.locator('#subregionSelect').select_option('other_excluding_shenzhen')
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('9493')
    expect(page.locator('[data-v25-flex-mode="minimum"]')).to_contain_text('4,775')

    page.locator('#subregionSelect').select_option('shenzhen')
    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('11293')
    expect(page.locator('#stepBody')).to_contain_text('养老金计算参考值 ¥11,293/月')
    expect(page.locator('[data-v25-flex-mode="minimum"]')).to_have_count(0)
    expect(page.locator('[data-v25-flex-mode="custom"]')).to_be_visible()
    assert errors == []
    page.close()


def test_v25_yunnan_uses_current_2026_minimum_and_calc_fallback(browser):
    page, errors = fresh_page(browser)
    flex_to_amount(page)
    page.locator('#regionSelect').select_option('yunnan')

    expect(page.locator('[data-key="currentCalcBase"]')).to_have_value('8265')
    minimum = page.locator('[data-v25-flex-mode="minimum"]')
    expect(minimum).to_be_visible()
    expect(minimum).to_contain_text('按当地当前最低标准')
    expect(minimum).to_contain_text('4,403')
    expect(minimum).to_contain_text('2026年当前官方标准')
    assert errors == []
    page.close()
