from playwright.sync_api import expect


def _fill_employee_core_form(page):
    page.locator("#emp_birth").fill("1985-01")
    page.locator("#emp_category").select_option("male")
    page.locator("#emp_region").select_option("beijing")
    page.locator("#emp_years").fill("30")
    page.locator("#emp_account").fill("120000")


def test_employee_default_flow_success(app_page):
    page = app_page
    _fill_employee_core_form(page)

    employee_section = page.locator("#employee-panel")
    employee_section.get_by_role("button", name="开始计算").click()

    expect(page.locator("#emp_result")).not_to_have_text("—")
    expect(page.locator("#emp_status")).to_have_text("已完成测算。")


def test_employee_custom_age_flow_retire_type_changes(app_page):
    page = app_page
    _fill_employee_core_form(page)

    page.get_by_role("button", name="按计划退休年龄测算").click()
    page.locator("#emp_custom_age").fill("60")

    page.locator("#employee-panel").get_by_role("button", name="开始计算").click()

    expect(page.locator("#emp_retire_type")).to_contain_text("提前退休测算")


def test_employee_custom_age_out_of_range_shows_warning(app_page):
    page = app_page
    _fill_employee_core_form(page)

    page.get_by_role("button", name="按计划退休年龄测算").click()
    page.locator("#emp_custom_age").fill("70")

    page.locator("#employee-panel").get_by_role("button", name="开始计算").click()

    expect(page.locator("#emp_status")).to_contain_text("超出可测算范围")
