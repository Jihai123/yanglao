from playwright.sync_api import expect


def test_quick_retirement_updates_age_and_date(app_page):
    page = app_page
    page.locator("#quick_birth").fill("1985-01")
    page.locator("#quick_category").select_option("male")
    page.get_by_role("button", name="查看退休年龄").click()

    expect(page.locator("#quick_age")).to_have_text("63岁")
    expect(page.locator("#quick_date")).to_have_text("2048年1月")
