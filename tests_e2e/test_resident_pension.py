from playwright.sync_api import expect


def test_resident_flow_updates_result(app_page):
    page = app_page
    page.locator("#res_base").fill("961")
    page.locator("#res_account").fill("60000")
    page.locator("#res_age").fill("60")

    page.locator("#resident-panel").get_by_role("button", name="开始计算").click()

    expect(page.locator("#res_result")).not_to_have_text("—")
    expect(page.locator("#res_status")).to_have_text("已完成测算。")


def test_resident_risk_when_age_under_60(app_page):
    page = app_page
    page.locator("#res_base").fill("961")
    page.locator("#res_account").fill("60000")
    page.locator("#res_age").fill("59")

    page.locator("#resident-panel").get_by_role("button", name="开始计算").click()

    expect(page.locator("#res_status")).to_contain_text("满 60 周岁")
