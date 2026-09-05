import pytest
from playwright.sync_api import expect


@pytest.fixture(params=[(1366, 900), (390, 844)])
def live_page(page, request):
    width, height = request.param
    page.set_viewport_size({"width": width, "height": height})
    page.goto("http://127.0.0.1:8765/index.html")
    return page


def advance(page):
    page.locator('#nextBtn').click()


def test_numeric_input_reaches_state_before_change(live_page):
    p = live_page
    p.locator('[data-intent="normal"]').click()
    advance(p)
    # Reading a draft must not depend on blur/change firing first (e.g. autofill).
    p.locator('[data-key="paidYears"]').fill('20')
    p.locator('[data-key="paidYears"]').evaluate("el => el.dispatchEvent(new Event('input', {bubbles:true}))")
    p.locator('[data-account="known"]').dispatch_event('click')
    expect(p.locator('[data-key="paidYears"]')).to_have_value('20')
    advance(p)
    expect(p.locator('[data-contribution-plan="to_minimum"]')).to_contain_text('目前已缴 20年')


def test_flex_birth_change_updates_default_start_age(live_page):
    p = live_page
    p.locator('[data-intent="flex"]').click()
    p.get_by_role('textbox', name='年月，可直接输入，例如1983-01').fill('1976-03')
    advance(p)
    advance(p)
    advance(p)
    expect(p.locator('#stepBody')).to_have_attribute('data-step', 'amount')


def test_resume_available_without_reload_and_keeps_step(live_page):
    p = live_page
    p.locator('[data-intent="normal"]').click()
    advance(p)
    p.locator('[data-key="paidYears"]').fill('21')
    p.locator('#homeBtn').click()
    expect(p.locator('#resumeBtn')).to_be_visible()
    p.locator('#resumeBtn').click()
    expect(p.locator('#stepBody')).to_have_attribute('data-step', 'status')
    expect(p.locator('[data-key="paidYears"]')).to_have_value('21')
    p.reload()
    p.locator('#resumeBtn').click()
    expect(p.locator('#stepBody')).to_have_attribute('data-step', 'status')
    expect(p.locator('[data-key="paidYears"]')).to_have_value('21')


def test_age_result_cites_retirement_rules(live_page):
    p = live_page
    p.locator('[data-intent="age"]').click()
    advance(p)
    expect(p.locator('#resultTrustCard')).not_to_contain_text('养老金计算参考值')
    expect(p.locator('#resultTrustCard')).to_contain_text('退休')


def test_resident_numeric_input_survives_account_toggle(live_page):
    p = live_page
    p.locator('#residentEntry').click()
    p.locator('#residentNext').click()
    p.locator('[data-rkey="annualContribution"]').fill('2000')
    p.locator('[data-raccount="known"]').dispatch_event('click')
    expect(p.locator('[data-rkey="annualContribution"]')).to_have_value('2000')


def test_deemed_choice_keeps_details_open(live_page):
    p = live_page
    p.locator('[data-intent="normal"]').click()
    advance(p)
    p.get_by_text('我有视同缴费年限', exact=True).click()
    p.locator('[data-deemed="yes"]').click()
    expect(p.locator('[data-key="deemedYears"]')).to_be_visible()


@pytest.mark.parametrize('intent', ['normal', 'early', 'flex'])
def test_employee_amount_path(live_page, intent):
    p = live_page
    errors = []
    p.on('pageerror', lambda error: errors.append(str(error)))
    p.locator(f'[data-intent="{intent}"]').click()
    advance(p)
    p.locator('[data-key="paidYears"]').fill('20')
    advance(p)
    advance(p)
    p.locator('#regionSelect').select_option('shaanxi')
    p.locator('[data-key="monthlyContributionBase"]').fill('6000')
    advance(p)
    expect(p.locator('#resultView')).to_be_visible()
    expect(p.locator('#resultView')).to_contain_text('20年')
    assert errors == []
    assert p.evaluate('document.documentElement.scrollWidth <= innerWidth')


def test_resident_result_uses_entered_values(live_page):
    p = live_page
    p.locator('#residentEntry').click()
    p.get_by_role('textbox', name='年月，可直接输入，例如1983-01').fill('1974-02')
    p.locator('[data-rkey="paidYears"]').fill('12')
    p.locator('#residentNext').click()
    p.locator('[data-rkey="annualSubsidy"]').fill('0')
    p.locator('#residentNext').click()
    p.locator('[data-rkey="localBasicPension"]').fill('200')
    p.locator('#residentNext').click()
    expect(p.locator('#residentView')).to_contain_text('17年')
    expect(p.locator('#residentView')).not_to_contain_text('你没有填写当地基础养老金标准')
