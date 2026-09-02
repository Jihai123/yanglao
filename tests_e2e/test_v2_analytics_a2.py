from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8765/index.html"
APP_VERSION = "v2-prod-20260902-d1"


def test_analytics_a2_emits_flow_and_step_events():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.add_init_script(
            """
            window.__yanglaoEvents = [];
            window.addEventListener('yanglao:analytics', event => {
              window.__yanglaoEvents.push(event.detail);
            });
            """
        )
        page.goto(BASE)
        page.wait_for_function(
            f"""() => (window.dataLayer || []).some(e => e.event === 'page_view' && e.app_version === '{APP_VERSION}')"""
        )

        page.locator('[data-intent="normal"]').click()
        page.wait_for_function(
            """() => (window.dataLayer || []).some(e => e.event === 'step_view' && e.step === 'identity')"""
        )

        events = page.evaluate("window.__yanglaoEvents")
        data_layer = page.evaluate("window.dataLayer || []")
        starts = [e for e in events if e.get("event") == "flow_start" and e.get("feature") == "normal"]
        clicks = [e for e in events if e.get("event") == "intent_click" and e.get("feature") == "normal"]
        steps = [e for e in events if e.get("event") == "step_view" and e.get("step") == "identity"]

        debug = {"events": events, "data_layer": data_layer}
        assert starts, debug
        assert clicks, debug
        assert steps, debug
        flow_id = starts[-1]["flow_id"]
        assert flow_id
        assert clicks[-1]["flow_id"] == flow_id
        assert steps[-1]["flow_id"] == flow_id
        assert starts[-1]["source"] == "direct"
        assert starts[-1]["device"] in {"desktop", "mobile", "tablet"}
        assert starts[-1]["app_version"] == APP_VERSION

        visitor = page.evaluate("localStorage.getItem('yanglao-v5-visitor')")
        assert visitor
        assert starts[-1]["visitor_id"] == visitor
        browser.close()
