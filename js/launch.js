import { ageText } from './policy.js';
import { projectPlan } from './projection.js';
import { buildContributionGuidance } from './guidance.js';

const QUAL_KEY = 'yanglao-v2-qualification-only';
const PLAN_KEY = 'yanglao-v2-plan';
const stepTitle = document.getElementById('stepTitle');
const stepBody = document.getElementById('stepBody');
const nextBtn = document.getElementById('nextBtn');
const resultView = document.getElementById('resultView');

function qualificationOnly() {
  return sessionStorage.getItem(QUAL_KEY) === '1';
}
function setQualificationOnly(value) {
  if (value) sessionStorage.setItem(QUAL_KEY, '1');
  else sessionStorage.removeItem(QUAL_KEY);
}
function ageYearsText(years) {
  return ageText(Math.round(Number(years || 0) * 12));
}
function yearsText(n) {
  const months = Math.max(0, Math.round(Number(n || 0) * 12));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}年${m}个月` : `${y}年`;
}
function money(n) {
  return `¥${Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}
function loadPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; }
}
function calcInput(plan) {
  const d = new Date();
  return {
    ...plan,
    now: { year: d.getFullYear(), month: d.getMonth() + 1 },
    currentAccount: plan.knowsAccount ? Number(plan.currentAccount || 0) : 0,
    currentCalcBase: plan.precision === 'precise' ? Number(plan.currentCalcBase || 0) : 0,
  };
}

function injectQualificationChoice() {
  if (!stepTitle?.textContent.includes('最后补两项') || !stepBody) return;
  const precisionSegment = stepBody.querySelector('[data-precision]')?.closest('.segment');
  if (!precisionSegment || document.getElementById('qualificationOnlyBtn')) return;
  precisionSegment.classList.add('segment-three');
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'qualificationOnlyBtn';
  button.textContent = '先不估金额';
  button.className = qualificationOnly() ? 'active' : '';
  precisionSegment.appendChild(button);
  button.addEventListener('click', () => {
    setQualificationOnly(true);
    applyQualificationUi();
    window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'qualification_only_selected' } }));
  });
  stepBody.querySelectorAll('[data-precision]').forEach(btn => btn.addEventListener('click', () => setQualificationOnly(false), { capture: true }));
  applyQualificationUi();
}

function applyQualificationUi() {
  if (!stepTitle?.textContent.includes('最后补两项')) return;
  const on = qualificationOnly();
  const button = document.getElementById('qualificationOnlyBtn');
  if (button) button.classList.toggle('active', on);
  stepBody.querySelectorAll('[data-precision]').forEach(btn => btn.classList.toggle('active', !on && btn.classList.contains('active')));

  const amountSelectors = ['monthlyContributionBase', 'avgIndex', 'currentCalcBase'];
  amountSelectors.forEach(key => {
    const field = stepBody.querySelector(`[data-key="${key}"]`)?.closest('.field');
    if (field) field.classList.toggle('qualification-hidden', on);
  });
  stepBody.querySelectorAll('details.disclosure').forEach(el => el.classList.toggle('qualification-hidden', on));
  document.getElementById('regionTrustField')?.classList.toggle('qualification-hidden', on);

  let note = document.getElementById('qualificationNote');
  if (on && !note) {
    note = document.createElement('div');
    note.id = 'qualificationNote';
    note.className = 'qualification-note';
    note.innerHTML = '<strong>可以先不估养老金金额</strong><span>退休年龄、最低缴费年限、停止工作/停缴方案和养老空窗期仍然可以正常计算。以后查到缴费基数和个人账户余额，再回来补金额即可。</span>';
    precisionSegmentParent()?.after(note);
  }
  if (!on && note) note.remove();
}
function precisionSegmentParent() {
  return stepBody.querySelector('[data-precision]')?.closest('.field');
}

nextBtn?.addEventListener('click', () => {
  if (!qualificationOnly() || !stepTitle?.textContent.includes('最后补两项')) return;
  // app.js 的金额模式校验仍要求一个正数。资格模式仅借此通过最后一步，结果增强层会完全隐藏金额输出；资格判断本身与此值无关。
  const input = stepBody.querySelector('[data-key="monthlyContributionBase"]');
  if (input && !(Number(input.value) > 0)) {
    input.value = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, { capture: true });

function qualificationPostProcess() {
  if (!qualificationOnly()) return;
  const hero = resultView.querySelector('.result-hero');
  if (!hero) return;
  const moneyEl = hero.querySelector('.result-money');
  if (moneyEl) moneyEl.textContent = '先看资格与方案';
  const soft = hero.querySelectorAll('.soft');
  if (soft[1]) soft[1].textContent = '本次未估算养老金金额';

  resultView.querySelectorAll('.scenario-money').forEach(el => { el.textContent = '未估金额'; });
  resultView.querySelectorAll('.scenario-meta').forEach(meta => {
    const spans = meta.querySelectorAll('span');
    if (spans.length >= 4) spans[3].classList.add('hidden');
  });
  resultView.querySelectorAll('.policy-row').forEach(row => {
    if (row.textContent.includes('养老金金额')) row.querySelector('strong').textContent = '本次未测算';
  });
  resultView.querySelectorAll('p.muted').forEach(p => {
    if (p.textContent.includes('按今天购买力折算')) p.remove();
  });
}

function conclusionHtml(plan, result, guidance) {
  if (!guidance.eligible) {
    const shortage = yearsText(guidance.shortageYears);
    let action;
    if (guidance.canFixBeforeClaim) {
      action = `把养老保险至少继续缴到 <strong>${ageYearsText(guidance.recommendedContributionEndAge)}</strong>，按当前规则可补齐这部分缴费年限。`;
    } else if (guidance.claimOnlyEligible) {
      action = `当前停缴时间太早；如果一直缴到 <strong>${ageText(plan.claimAgeMonths)}</strong>，预计可以满足最低缴费年限。`;
    } else {
      action = `即使一直缴到当前计划领取年龄，预计仍少约 <strong>${yearsText(guidance.claimOnlyShortageYears)}</strong>。需要核对历史缴费记录，并向参保地经办机构确认续缴/补缴等处理方式。`;
    }
    return `<div class="decision-card decision-danger"><span class="decision-label">先看结论</span><strong>当前方案还不能满足最低缴费年限</strong><p>预计还差约 <strong>${shortage}</strong>。${action}</p></div>`;
  }

  const amount = qualificationOnly() || !(result.pensionLow > 0)
    ? '本次先不估养老金金额。'
    : `预计养老金约 <strong>${money(result.pensionLow)}–${money(result.pensionHigh)}/月</strong>。`;
  return `<div class="decision-card decision-good"><span class="decision-label">先看结论</span><strong>按当前政策假设，这个退休计划基本可行</strong><p>${ageYearsText(plan.stopWorkAge)}停止工作，${ageYearsText(plan.contributionEndAge)}停止缴费，${ageText(plan.claimAgeMonths)}办理退休；中间养老空窗期约 <strong>${yearsText(result.gapYears)}</strong>。${amount}</p></div>`;
}

function precisionFollowupHtml() {
  if (!qualificationOnly()) return '';
  return `<div class="card section precision-followup"><h2>以后想把金额算出来，只需要补这些</h2><p class="muted">优先从个人权益记录或参保地人社渠道找到：当前养老保险缴费基数、个人账户累计储存额；如果当地公布待遇计发参数，再补当地最新参数。查不到也不影响你先用退休资格和缴费方案。</p><button type="button" class="btn secondary" id="addAmountDataBtn">返回补金额参数</button></div>`;
}

function enhanceEmployeeResult() {
  if (!resultView || resultView.classList.contains('hidden') || resultView.dataset.launchEnhanced === '1') return;
  const plan = loadPlan();
  if (!plan || plan.intent === 'age') return;
  const hero = resultView.querySelector('.result-hero');
  if (!hero) return;

  const result = projectPlan(calcInput(plan));
  const guidance = buildContributionGuidance(calcInput(plan), result);
  hero.insertAdjacentHTML('afterend', conclusionHtml(plan, result, guidance));
  if (qualificationOnly()) {
    qualificationPostProcess();
    const actions = resultView.querySelector('.section[style*="display:grid"]');
    if (actions) actions.insertAdjacentHTML('beforebegin', precisionFollowupHtml());
    document.getElementById('addAmountDataBtn')?.addEventListener('click', () => {
      setQualificationOnly(false);
      document.getElementById('editPlanBtn')?.click();
      setTimeout(() => {
        const plan2 = loadPlan();
        if (plan2) {
          plan2.step = 4;
          localStorage.setItem(PLAN_KEY, JSON.stringify(plan2));
        }
      }, 0);
    });
  }
  resultView.dataset.launchEnhanced = '1';
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'employee_result', intent: plan.intent, eligible: result.eligible, qualification_only: qualificationOnly() } }));
}

const observer = new MutationObserver(() => {
  injectQualificationChoice();
  if (resultView && resultView.children.length) queueMicrotask(enhanceEmployeeResult);
});
observer.observe(document.body, { childList: true, subtree: true });
injectQualificationChoice();
