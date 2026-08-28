from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://127.0.0.1:8765/index.html"


def fresh_page(width=390, height=844):
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.reload(wait_until="networkidle")
    return p, browser, page, errors


def close_all(p, browser, page):
    page.close()
    browser.close()
    p.stop()


def test_resident_flow_explicitly_separates_employee_retirement_rules():
    p, browser, page, errors = fresh_page()
    page.locator("#residentEntry").click()
    expect(page.locator("#residentPolicyClarity")).to_be_visible()
    expect(page.locator("#residentPolicyClarity")).to_contain_text("不套用职工渐进式延迟退休")
    expect(page.locator("#residentPolicyClarity")).to_contain_text("60周岁、累计缴费满15年")

    page.locator("#residentNext").click()
    page.locator("#residentNext").click()
    page.locator("#residentNext").click()
    expect(page.locator("#residentView .result-hero")).to_be_visible()
    expect(page.locator("#residentPolicyClarity")).to_be_visible()
    assert errors == []
    close_all(p, browser, page)


def test_qualification_result_can_return_directly_to_amount_inputs():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="normal"]').click()
    for _ in range(4):
        page.locator("#nextBtn").click()
    expect(page.locator("#qualificationOnlyBtn")).to_be_visible()
    page.locator("#qualificationOnlyBtn").click()
    page.locator("#nextBtn").click()
    expect(page.locator("#addAmountDataBtn")).to_be_visible()

    page.locator("#addAmountDataBtn").click()
    expect(page.locator("#wizardView")).to_be_visible()
    expect(page.locator("#stepTitle")).to_contain_text("最后补两项")
    expect(page.locator('[data-key="monthlyContributionBase"]')).to_be_visible()
    assert errors == []
    close_all(p, browser, page)
