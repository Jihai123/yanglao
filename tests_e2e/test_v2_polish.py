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
    expect(page.locator('#resultView')).to_contain_text('两种可能')
    expect(page.locator('.age-result-card')).to_have_count(2)
    assert errors == []
    close_all(p, browser, page)

def test_future_gap_plan_supports_flexible_employment_base():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="flex"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    expect(page.locator('[data-contribution-plan="actual_months"]')).to_be_visible()
    expect(page.locator('[data-key="actualFutureYears"]')).to_be_visible()
    expect(page.locator('[data-after-stop="flex"]')).to_be_visible()
    expect(page.locator('[data-key="flexMonthlyContributionBase"]')).to_be_visible()
    assert errors == []
    close_all(p, browser, page)

def test_unknown_history_still_emits_pension_estimate():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    page.locator('[data-history-mode="quick"]').click()
    page.locator('[data-history-pattern="unknown"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    expect(page.locator('#resultView')).to_contain_text('预计每月养老金')
    assert errors == []
    close_all(p, browser, page)

def test_segmented_history_editor_adds_rows():
    p, browser, page, errors = fresh_page()
    page.locator('[data-intent="normal"]').click()
    page.locator('#nextBtn').click(); page.locator('#nextBtn').click()
    page.locator('[data-history-mode="segments"]').click()
    expect(page.locator('.history-row')).to_have_count(1)
    page.locator('#historyAddBtn').click()
    expect(page.locator('.history-row')).to_have_count(2)
    assert errors == []
    close_all(p, browser, page)

def test_resident_flow_explicitly_separates_employee_retirement_rules():
    p, browser, page, errors = fresh_page()
    page.locator('#residentEntry').click()
    expect(page.locator('#residentPolicyClarity')).to_be_visible()
    expect(page.locator('#residentPolicyClarity')).to_contain_text('不套用职工渐进式延迟退休')
    assert errors == []
    close_all(p, browser, page)
