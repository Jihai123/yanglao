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
    page.close(); browser.close(); p.stop()

def test_female_unsure_shows_two_possible_retirement_results():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="age"]').click()
    page.locator('[data-sex="female"]').click()
    page.locator('[data-female-category="unsure"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('#resultView')).to_contain_text('先看两种可能')
    expect(page.locator('.age-result-card')).to_have_count(2)
    assert errors == []
    close_all(p, browser, page)

def test_future_gap_plan_asks_for_actual_contribution_months():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="flex"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    expect(page.locator('[data-contribution-plan="actual_months"]')).to_be_visible()
    expect(page.locator('[data-key="actualFutureYears"]')).to_be_visible()
    expect(page.locator('#stepBody')).to_contain_text('真正缴费的累计月数')
    assert errors == []
    close_all(p, browser, page)

def test_variable_history_does_not_emit_huge_pension_range():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    page.locator('[data-history="variable"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('#resultView')).to_contain_text('当前信息不足，先不报数字')
    assert errors == []
    close_all(p, browser, page)

def test_resident_flow_explicitly_separates_employee_retirement_rules():
    p, browser, page, errors = fresh_page()
    page.locator('#residentEntry').click()
    expect(page.locator('#residentPolicyClarity')).to_be_visible()
    expect(page.locator('#residentPolicyClarity')).to_contain_text('不套用职工渐进式延迟退休')
    assert errors == []
    close_all(p, browser, page)
