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


def enter_normal_status(page):
    page.locator('[data-intent="age"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    page.locator('#continuePlanBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')


def to_amount(page):
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    page.locator('#regionSelect').select_option('shaanxi')
    page.locator('[data-key="monthlyContributionBase"]').fill('6000')


def test_v264_deemed_help_and_unknown_state_do_not_block(browser):
    page, errors = fresh_page(browser)
    enter_normal_status(page)

    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    expect(page.get_by_text('什么是视同缴费年限？怎么确认？', exact=True)).to_be_visible()
    page.locator('[data-deemed-status="unknown"]').click()

    to_amount(page)
    expect(page.locator('#stepBody')).to_contain_text('暂不确定是否有视同缴费年限')
    page.locator('#nextBtn').click()

    expect(page.locator('#resultView')).to_be_visible()
    partial = page.locator('.amount-decision.amount-partial')
    expect(partial).to_be_visible()
    expect(partial).to_contain_text('目前可估算的养老金部分')
    expect(partial).to_contain_text('未包含过渡性养老金')
    expect(partial).to_contain_text('待核定 · 未计入')
    expect(page.locator('#stepError')).to_have_count(0)
    assert errors == []
    page.close()


def test_v264_confirmed_deemed_unknown_transition_returns_partial(browser):
    page, errors = fresh_page(browser)
    enter_normal_status(page)

    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    page.locator('[data-deemed-status="confirmed"]').click()
    page.locator('[data-key="deemedYears"]').fill('5')

    to_amount(page)
    expect(page.get_by_text('什么是过渡性养老金？怎么确认？', exact=True)).to_be_visible()
    expect(page.get_by_text('不知道，先算已知部分', exact=True)).to_be_visible()
    page.locator('#nextBtn').click()

    partial = page.locator('.amount-decision.amount-partial')
    expect(partial).to_be_visible()
    expect(partial).to_contain_text('已经确认有视同缴费年限')
    expect(partial).to_contain_text('不把未知金额按 0 元计算')
    expect(page.locator('[data-v24-share-box]')).to_contain_text('不生成“养老金总额”分享卡')
    expect(page.locator('[data-v24-card]')).to_have_count(0)
    assert errors == []
    page.close()


def test_v264_known_transition_keeps_full_result(browser):
    page, errors = fresh_page(browser)
    enter_normal_status(page)

    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    page.locator('[data-deemed-status="confirmed"]').click()
    page.locator('[data-key="deemedYears"]').fill('5')

    to_amount(page)
    page.locator('[data-transition-known="yes"]').click()
    page.locator('[data-key="transitionAmount"]').fill('500')
    page.locator('#nextBtn').click()

    full = page.locator('.amount-decision.amount-good[data-amount-status="full"]')
    expect(full).to_be_visible()
    expect(full).to_contain_text('过渡性养老金')
    expect(full).to_contain_text('¥500')
    expect(page.locator('.amount-decision.amount-partial')).to_have_count(0)
    assert errors == []
    page.close()


def test_v264_birth_month_is_bounded_and_paid_month_copy_is_clear(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="age"]').click()

    expected_max = page.evaluate("() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }")
    expect(page.locator('[data-key="birth"]')).to_have_attribute('max', expected_max)

    page.locator('#nextBtn').click()
    page.locator('#continuePlanBtn').click()
    expect(page.locator('#stepBody')).to_contain_text('额外月份（0～11）')
    expect(page.locator('#stepBody')).to_contain_text('月份只填不足一年的部分')
    assert errors == []
    page.close()


def test_v264_release_notes_and_faq_are_current(browser):
    page, errors = fresh_page(browser)
    notes = page.locator('#releaseNotes')
    expect(notes.locator('.v23-version-badge')).to_have_text('v2.6.4')
    expect(notes).to_contain_text('v2.6.4 · 2026-09-29')
    expect(notes).to_contain_text('不知道过渡性养老金')
    expect(page.locator('.seo-faq')).to_contain_text('什么是视同缴费年限和过渡性养老金？')
    assert errors == []
    page.close()
