import json

import pytest
from playwright.sync_api import expect, sync_playwright

from tests_e2e.v26_flow_helpers import tune_page

BASE_URL = "http://127.0.0.1:8765"
ROUTES = [
    ("guides/flexible-employment-pension.html", "flexible-employment-pension", "early"),
    ("guides/minimum-pension-years.html", "minimum-pension-years", "early"),
    ("tools/retirement-age.html", "retirement-age", "age"),
]


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.mark.parametrize("path,slug,entry", ROUTES)
def test_acquisition_landing_directly_starts_existing_wizard(browser, path, slug, entry):
    page = tune_page(browser.new_page(viewport={"width": 390, "height": 844}))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    recorded_requests = []

    def record_event(route):
        recorded_requests.append(route.request.post_data_json)
        route.fulfill(status=200, content_type="application/json", body='{"ok":true}')

    page.route("**/api/event.php", record_event)
    page.goto(f"{BASE_URL}/{path}", wait_until="networkidle")

    expect(page.locator("h1")).to_be_visible()
    expect(page.locator('a[data-landing-cta]')).to_have_count(2)
    assert page.evaluate("() => window.dataLayer.some(e => e.event === 'page_view')")

    page.locator('a[data-landing-cta]').first.click()
    expect(page).to_have_url(f"{BASE_URL}/")
    expect(page.locator("#wizardView")).to_be_visible()
    expect(page.locator("#stepBody")).to_have_attribute("data-step", "identity")
    assert page.evaluate("() => sessionStorage.getItem('yanglao-growth-landing')") == slug

    payloads = page.evaluate("() => window.dataLayer.filter(e => ['flow_start', 'landing_flow_start'].includes(e.event))")
    assert any(p["event"] == "flow_start" and p["feature"] == entry for p in payloads)
    assert any(p["event"] == "landing_flow_start" and p["step"] == slug for p in payloads)
    ctas = [p for p in recorded_requests if p.get("event") == "landing_cta_click"]
    starts = [p for p in recorded_requests if p.get("event") == "landing_flow_start"]
    assert len(ctas) == 1
    assert ctas[0]["page"] == "/" + path
    assert ctas[0]["step"] == slug
    assert starts and starts[0]["step"] == slug
    assert starts[0]["flow_id"]
    assert starts[0]["session_id"] == ctas[0]["session_id"]
    assert errors == []
    page.close()


def test_acquisition_pages_link_each_other_and_skip_sensitive_data(browser):
    page = tune_page(browser.new_page(viewport={"width": 390, "height": 844}))
    page.goto(BASE_URL + "/guides/minimum-pension-years.html", wait_until="networkidle")
    expect(page.locator('a[href="/tools/retirement-age.html"]')).to_have_count(2)
    expect(page.locator('a[href="/guides/flexible-employment-pension.html"]')).to_have_count(2)
    expect(page.locator("table tbody tr")).to_have_count(15)
    assert page.locator("input").count() == 0
    page.close()

@pytest.mark.parametrize("width,height", [(390, 844), (1280, 900)])
def test_home_policy_topics_render_as_accessible_cards(browser, width, height):
    page = tune_page(browser.new_page(viewport={"width": width, "height": height}))
    page.goto(BASE_URL + "/", wait_until="networkidle")

    section = page.locator(".seo-topics")
    expect(section).to_be_visible()
    expect(section.locator("h2")).to_have_text("按自己的问题查退休政策")
    links = section.locator("nav.seo-topic-list a.seo-topic-link")
    expect(links).to_have_count(3)

    expected_paths = ["/" + path for path, _, _ in ROUTES]
    for i, expected_path in enumerate(expected_paths):
        link = links.nth(i)
        expect(link).to_have_attribute("href", expected_path)
        assert link.evaluate("(el) => getComputedStyle(el).textDecorationLine") == "none"
        assert link.evaluate("(el) => getComputedStyle(el).display") == "grid"
        assert link.bounding_box()["height"] >= 60
        assert link.locator("strong").inner_text()
        assert link.locator(".seo-topic-arrow").is_visible()

    # The fix must not introduce sideways scrolling on either viewport.
    assert page.evaluate("() => document.documentElement.scrollWidth <= innerWidth")
    page.close()
