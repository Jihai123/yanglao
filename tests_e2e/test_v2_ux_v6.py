from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:8765/index.html"


def test_ux_v6_month_input_category_help_and_product_promise():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")

        expect(page.locator('.v6-mission')).to_contain_text('一站式，把退休这件事算清楚')
        expect(page.locator('.v6-mission')).to_contain_text('每一条意见我们都会认真看')

        page.locator('[data-intent="age"]').click()
        birth = page.locator('[data-key="birth"]')
        manual = page.locator('.v6-month-text')
        expect(birth).to_have_attribute('type', 'month')
        expect(manual).to_have_attribute('placeholder', '例如 1983-01')
        expect(page.locator('.v6-month-help')).to_contain_text('可以直接输入')
        expect(page.locator('.v6-native-month-label')).to_contain_text('系统日期选择')

        manual.fill('1983/1')
        manual.press('Tab')
        expect(manual).to_have_value('1983-01')
        expect(birth).to_have_value('1983-01')

        page.locator('.v6-month-choose').click()
        year = page.locator('.v6-picker-year')
        year.fill('1984')
        page.locator('[data-v6-month="9"]').click()
        expect(manual).to_have_value('1984-09')
        expect(birth).to_have_value('1984-09')

        page.locator('[data-sex="female"]').click()
        expect(page.locator('[data-v6-category-help]')).to_have_count(1)
        expect(page.locator('[data-v6-category-help] summary')).to_contain_text('不知道怎么选？去哪里查')
        expect(page.locator('[data-v6-category-help]')).to_contain_text('12333')
        expect(page.locator('[data-v6-category-help]')).to_contain_text('最终办理时间以当地经办机构核定为准')

        assert errors == []
        browser.close()
