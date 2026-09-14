from playwright.sync_api import expect


def tune_page(page):
    """Fail stale selectors quickly so CI does not burn 30 seconds per broken path."""
    page.set_default_timeout(7000)
    return page


def enter_normal_status(page):
    """Enter the current V2.6 precise employee flow through the public age result."""
    page.locator('[data-intent="age"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#resultView')).to_be_visible()
    page.locator('#continuePlanBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'status')


def normal_to_amount(page):
    enter_normal_status(page)
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')


def early_to_plan(page):
    """Enter the public retirement-planning flow that owns stop-work/flex choices in V2.6."""
    page.locator('[data-intent="early"]').click()
    page.locator('#nextBtn').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'plan')


def early_to_amount(page, contribution_plan=None):
    early_to_plan(page)
    if contribution_plan:
        page.locator(f'[data-contribution-plan="{contribution_plan}"]').click()
    page.locator('#nextBtn').click()
    expect(page.locator('#stepBody')).to_have_attribute('data-step', 'amount')
