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

    expect(page.locator('#stepBody')).to_contain_text('累计实际缴费（不含视同缴费）')
    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    expect(page.get_by_text('什么是视同缴费年限？怎么确认？', exact=True)).to_be_visible()
    page.locator('[data-deemed-status="unknown"]').click()

    to_amount(page)
    expect(page.locator('#stepBody')).to_contain_text('暂不确定是否有视同缴费年限')
    page.locator('#nextBtn').click()

    partial = page.locator('.amount-decision.amount-partial')
    expect(partial).to_be_visible()
    expect(partial).to_have_attribute('data-amount-status', 'partial_deemed_unknown')
    expect(partial).to_contain_text('按当前已确认资料可估算的部分')
    expect(partial).to_contain_text('这不是完整养老金总额')
    expect(partial).to_contain_text('最低缴费年限判断、基础养老金和是否涉及过渡性养老金都可能变化')
    expect(partial).to_contain_text('是否适用待确认')
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
    expect(partial).to_have_attribute('data-amount-status', 'partial_transition_unknown')
    expect(partial).to_contain_text('已确认的视同缴费年限已计入最低缴费年限判断')
    expect(partial).to_contain_text('未包含未知的过渡性养老金')
    expect(page.locator('#resultView')).to_contain_text('已认定视同')
    expect(page.locator('[data-v24-share-box]')).to_contain_text('不生成“养老金总额”分享卡')
    expect(page.locator('[data-v24-card]')).to_have_count(0)
    assert errors == []
    page.close()


def test_v264_known_transition_still_partial_when_local_deemed_rules_are_unknown(browser):
    page, errors = fresh_page(browser)
    enter_normal_status(page)

    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    page.locator('[data-deemed-status="confirmed"]').click()
    page.locator('[data-key="deemedYears"]').fill('5')

    to_amount(page)
    page.locator('[data-transition-known="yes"]').click()
    page.locator('[data-key="transitionAmount"]').fill('500')
    page.locator('#nextBtn').click()

    partial = page.locator('.amount-decision.amount-partial')
    expect(partial).to_be_visible()
    expect(partial).to_have_attribute('data-amount-status', 'partial_deemed_rules_unknown')
    expect(partial).to_contain_text('已计入你填写的过渡性养老金金额')
    expect(partial).to_contain_text('仍不是完整总额')
    expect(partial).to_contain_text('¥500')
    expect(page.locator('.amount-decision.amount-good')).to_have_count(0)
    assert errors == []
    page.close()


def test_v264_confirmed_deemed_requires_positive_recognised_duration(browser):
    page, errors = fresh_page(browser)
    enter_normal_status(page)

    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    page.locator('[data-deemed-status="confirmed"]').click()
    page.locator('#nextBtn').click()

    expect(page.locator('#stepError')).to_contain_text('请填写已确认的视同缴费年限')
    expect(page.locator('[data-key="deemedYears"]')).to_have_attribute('aria-invalid', 'true')
    expect(page.locator('[data-key="deemedYears"]')).to_be_focused()
    assert errors == []
    page.close()


def test_v264_known_transition_requires_explicit_amount(browser):
    page, errors = fresh_page(browser)
    enter_normal_status(page)

    page.get_by_text('是否有被认定的视同缴费年限？', exact=True).click()
    page.locator('[data-deemed-status="confirmed"]').click()
    page.locator('[data-key="deemedYears"]').fill('5')
    to_amount(page)

    page.locator('[data-transition-known="yes"]').click()
    page.locator('#nextBtn').click()

    expect(page.locator('#stepError')).to_contain_text('填写过渡性养老金月额')
    expect(page.locator('[data-key="transitionAmount"]')).to_have_attribute('aria-invalid', 'true')
    expect(page.locator('[data-key="transitionAmount"]')).to_be_focused()
    assert errors == []
    page.close()


def test_v264_legacy_has_deemed_saved_plan_is_migrated_and_forced_to_review(browser):
    page, errors = fresh_page(browser)
    page.evaluate("""() => {
      localStorage.setItem('yanglao-v4-plan', JSON.stringify({
        intent: 'normal',
        estimateMode: 'precise',
        step: 2,
        birth: '1983-01',
        sex: 'male',
        femaleCategory: 'worker50',
        paidYears: 15,
        paidMonthsExtra: 0,
        hasDeemed: true,
        deemedYears: 5,
        deemedMonthsExtra: 0,
        transitionAmountKnown: false,
        transitionAmount: 0,
        regionKey: 'shaanxi'
      }));
    }""")
    page.reload(wait_until="networkidle")

    expect(page.locator('#resumeText')).to_contain_text('新版拆分了实际缴费与视同缴费口径')
    page.locator('#resumeBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')
    expect(page.locator('[data-deemed-status="confirmed"]')).to_have_class(pytest.approx if False else "choice active")
    expect(page.locator('#stepBody')).to_contain_text('请确认一次旧数据口径')
    expect(page.locator('[data-key="paidYears"]')).to_have_value('15')
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

    months = page.locator('[data-key="paidMonthsExtra"]')
    months.fill('18')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepError')).to_contain_text('累计缴费月数请填0到11')
    expect(months).to_have_attribute('aria-invalid', 'true')
    expect(months).to_be_focused()

    assert errors == []
    page.close()


def test_v264_release_notes_and_faq_are_current(browser):
    page, errors = fresh_page(browser)
    notes = page.locator('#releaseNotes')
    expect(notes.locator('.v23-version-badge')).to_have_text('v2.6.4')
    expect(notes).to_contain_text('v2.6.4 · 2026-09-29')
    expect(notes).to_contain_text('视同缴费年限会计入最低缴费年限判断')
    expect(page.locator('.seo-faq')).to_contain_text('什么是视同缴费年限和过渡性养老金？')
    expect(page.locator('.seo-faq')).to_contain_text('不把未知规则或金额当作 0')
    assert errors == []
    page.close()
