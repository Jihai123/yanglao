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


def normal_result(page):
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
    page.locator('#regionSelect').select_option('beijing')
    base = page.locator('[data-key="monthlyContributionBase"]')
    base.fill('8000')
    base.dispatch_event('change')
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()


def test_v24_homepage_has_related_tools_and_public_release(browser):
    page, errors = fresh_page(browser)
    expect(page.locator('#relatedTools')).to_be_visible()
    expect(page.locator('#relatedTools')).to_contain_text('退休之外，也可以顺手算算')
    expect(page.locator('[data-v24-tool="job_value"]')).to_have_attribute('href', 'https://jobtest.chatgpt5x.com/')
    expect(page.locator('[data-v24-tool="livable_city"]')).to_have_attribute('href', 'https://yiju.zhibeimao.com/')
    expect(page.locator('#releaseNotes')).to_contain_text('v2.4.1')
    expect(page.locator('#releaseNotes')).to_contain_text('退休结果分享')
    expect(page.locator('#releaseNotes')).to_contain_text('入口地址错误')
    assert errors == []
    page.close()


def test_v24_result_share_box_uses_result_amount_and_generates_card(browser):
    page, errors = fresh_page(browser)
    normal_result(page)

    share = page.locator('[data-v24-share-box]')
    expect(share).to_be_visible()
    expect(share).to_contain_text('退休后大概')
    expect(share).to_contain_text('¥')
    expect(share).not_to_contain_text('出生年月')
    expect(share).not_to_contain_text('个人账户余额')

    page.locator('[data-v24-card]').click()
    modal = page.locator('#shareCardModal')
    expect(modal).to_be_visible()
    page.wait_for_function("""() => document.querySelector('#shareCardModal img')?.src.startsWith('blob:')""")

    events = page.evaluate("window.dataLayer || []")
    assert any(event.get('event') == 'share_open' for event in events)
    assert any(event.get('event') == 'share_card_generate' for event in events)
    assert errors == []
    page.close()


def test_v24_share_copy_actions_do_not_put_amount_in_analytics(browser):
    page, errors = fresh_page(browser)
    normal_result(page)
    page.evaluate("""
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => true }
      });
    """)
    page.locator('[data-v24-copy-text]').click()
    page.wait_for_function("""() => (window.dataLayer || []).some(e => e.event === 'share_copy_text')""")
    event = page.evaluate("""() => (window.dataLayer || []).filter(e => e.event === 'share_copy_text').slice(-1)[0]""")
    assert 'amount' not in event
    assert 'birth' not in event
    assert 'currentAccount' not in event
    assert errors == []
    page.close()
