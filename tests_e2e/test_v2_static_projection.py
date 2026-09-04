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


def test_default_future_projection_is_static_zero_growth(browser):
    page, errors = fresh_page(browser)
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click()  # identity -> status
    page.locator('#nextBtn').click()  # status -> future plan
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')
    page.locator('#nextBtn').click()  # plan -> amount
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')

    growth = page.locator('[data-key="socialWageGrowthPercent"]')
    expect(growth).to_have_value('0')

    page.locator('[data-amount-mode="skip"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()

    saved = page.evaluate("JSON.parse(localStorage.getItem('yanglao-v4-plan'))")
    assert abs(float(saved['socialWageGrowth'])) < 1e-12
    assert abs(float(saved['contributionGrowth'])) < 1e-12
    assert abs(float(saved['accountInterest'])) < 1e-12
    assert errors == []
    page.close()
