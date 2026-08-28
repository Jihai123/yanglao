import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://127.0.0.1:8765/index.html"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


def new_page(browser, width=390, height=844):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.reload(wait_until="networkidle")
    return page, errors


def finish_employee(page, intent):
    page.locator(f'[data-intent="{intent}"]').click()
    for _ in range(7):
        if not page.locator("#resultView").get_attribute("class") or "hidden" not in (page.locator("#resultView").get_attribute("class") or ""):
            break
        page.locator("#nextBtn").click()
    expect(page.locator("#resultView")).to_be_visible()


def test_mobile_home_has_no_horizontal_overflow_and_resident_entry(browser):
    page, errors = new_page(browser, 390, 844)
    expect(page.locator("#residentEntry")).to_be_visible()
    overflow = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    assert overflow is True
    assert errors == []
    page.close()


@pytest.mark.parametrize("intent", ["age", "normal", "early", "flex"])
def test_all_employee_entry_points_reach_result(browser, intent):
    page, errors = new_page(browser)
    finish_employee(page, intent)
    expect(page.locator(".result-hero")).to_be_visible()
    if intent != "age":
        expect(page.locator(".decision-card")).to_be_visible()
    assert errors == []
    page.close()


def test_qualification_only_mode_reaches_useful_result_without_amount(browser):
    page, errors = new_page(browser)
    page.locator('[data-intent="normal"]').click()
    for _ in range(4):
        page.locator("#nextBtn").click()
    expect(page.locator("#qualificationOnlyBtn")).to_be_visible()
    page.locator("#qualificationOnlyBtn").click()
    page.locator("#nextBtn").click()
    expect(page.locator("#resultView")).to_be_visible()
    expect(page.locator(".result-money")).to_contain_text("先看资格与方案")
    expect(page.locator(".decision-card")).to_be_visible()
    assert errors == []
    page.close()


def test_resident_flow_reaches_result_and_shows_official_basis(browser):
    page, errors = new_page(browser)
    page.locator("#residentEntry").click()
    expect(page.locator("#residentView")).to_be_visible()
    page.locator("#residentNext").click()
    page.locator("#residentNext").click()
    page.locator("#residentNext").click()
    expect(page.locator("#residentView .result-hero")).to_be_visible()
    expect(page.locator("#residentView #resultTrustCard")).to_be_visible()
    expect(page.locator("#residentView")).to_contain_text("城乡居民")
    assert errors == []
    page.close()


def test_seo_and_official_trust_content_are_present(browser):
    page, errors = new_page(browser, 1280, 900)
    expect(page.locator(".seo-guide")).to_be_visible()
    expect(page.locator("#homeTrustCard")).to_be_visible()
    expect(page.locator("#homeTrustCard")).to_contain_text("官方来源可核验")
    assert errors == []
    page.close()
