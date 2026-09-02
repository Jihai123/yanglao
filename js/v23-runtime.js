import { getRegionV4 } from './sources-v4.js?v=20260829-v4';

const PLAN_KEY = 'yanglao-v4-plan';
const NORMAL_AMOUNT_FLOW_KEY = 'yanglao-v6-normal-amount-flow';
const AFTER_STOP_MODE_KEY = 'yanglao-v23-after-stop-mode';
const CONTRIBUTION_PLAN_KEY = 'yanglao-v23-contribution-plan';
const FLEX_MODE_KEY = 'yanglao-v23-flex-mode';
const FLEX_CUSTOM_KEY = 'yanglao-v23-flex-custom-base';
const PUBLIC_VERSION = 'v2.3';

let resultSubmitting = false;
let observerQueued = false;

function sessionGet(key) {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}

function sessionSet(key, value) {
  try {
    if (value === '' || value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {}
}

function normalAmountFlowActive() {
  try { return localStorage.getItem(NORMAL_AMOUNT_FLOW_KEY) === '1'; } catch { return false; }
}

function savedPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; }
}

function installStyles() {
  if (document.getElementById('v23RuntimeStyles')) return;
  const style = document.createElement('style');
  style.id = 'v23RuntimeStyles';
  style.textContent = `
    .v23-field-error { outline: 2px solid #c85b46 !important; outline-offset: 2px; border-radius: 14px; }
    .v23-field-error input, .v23-field-error select { border-color: #c85b46 !important; box-shadow: 0 0 0 2px rgba(200,91,70,.10); }
    .v23-inline-error { margin-top: 8px; color: #a33f2f; font-size: 13px; line-height: 1.55; }
    .v23-warning { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #fff4ef; color: #8c4738; line-height: 1.55; }
    .v23-warning button { margin-left: 6px; border: 0; background: transparent; color: #0f675b; font-weight: 700; cursor: pointer; }
    .v23-future-base { margin-top: 14px; }
    .v23-release { margin-top: 22px; padding: 22px; border: 1px solid var(--line, #dde5e1); border-radius: 18px; background: rgba(255,255,255,.68); }
    .v23-release-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .v23-release h2 { margin: 4px 0 0; }
    .v23-release details { padding: 10px 0; border-top: 1px solid var(--line, #dde5e1); }
    .v23-release details:first-of-type { margin-top: 12px; }
    .v23-version-badge { display:inline-flex; align-items:center; padding:4px 9px; border-radius:999px; background:#e5f2ee; color:#145f55; font-size:12px; font-weight:800; }
    .v23-release ul { margin:10px 0 0 18px; padding:0; line-height:1.8; }
    #nextBtn[aria-busy="true"] { opacity:.72; cursor:wait; }
  `;
  document.head.appendChild(style);
}

function injectReleaseNotes() {
  const home = document.getElementById('homeView');
  if (!home || document.getElementById('releaseNotes')) return;
  const anchor = home.querySelector('.seo-guide') || home.querySelector('#feedbackWall');
  if (!anchor) return;
  const section = document.createElement('section');
  section.id = 'releaseNotes';
  section.className = 'v23-release';
  section.setAttribute('aria-labelledby', 'releaseNotesTitle');
  section.innerHTML = `
    <div class="v23-release-head">
      <div><span class="eyebrow">持续维护</span><h2 id="releaseNotesTitle">版本与更新记录</h2></div>
      <span class="v23-version-badge">${PUBLIC_VERSION}</span>
    </div>
    <p class="muted">我们会根据政策变化、真实使用数据和用户反馈持续修正。计算口径与地区参数有更新时会同步记录。</p>
    <details open><summary>${PUBLIC_VERSION} · 2026-09-02</summary><ul>
      <li>优化养老金金额流程：未来灵活就业基数改为“当地最低标准 / 自己填写”，移除会造成阻塞的“还没决定”。</li>
      <li>修复连续点击“查看结果”可能导致页面卡顿或无响应的问题。</li>
      <li>缺失字段会直接高亮并定位；未收录计发基准的地区会提前提示补充入口。</li>
      <li>增强匿名失败诊断并修正流程归类，继续根据真实完成率优化。</li>
      <li>地区社保参数进入持续维护机制：已核验数值优先自动带入，未核验数据不猜测。</li>
    </ul></details>
    <details><summary>v2.2 · 2026-09-01</summary><ul>
      <li>明确未来养老金、缴费基数和个人账户记账利率的静态估算口径。</li>
      <li>优化历史缴费、未来缴费和方案比较的输入与结果表达。</li>
    </ul></details>
    <details><summary>v2.1 · 2026-08-28</summary><ul>
      <li>支持渐进式延迟退休年龄、几年后不工作、离职 / 灵活就业和城乡居民养老等场景。</li>
      <li>增加政策来源、数据核验状态和官方渠道交叉验证提示。</li>
    </ul></details>`;
  anchor.before(section);
}

function clearFieldError(target) {
  const field = target?.closest?.('.field');
  field?.classList.remove('v23-field-error');
  target?.removeAttribute?.('aria-invalid');
  field?.querySelector('.v23-inline-error[data-runtime-error]')?.remove();
}

function markFieldError(target, message) {
  if (!target) return null;
  const field = target.closest('.field') || target;
  field.classList.add('v23-field-error');
  if (target.matches?.('input,select,textarea')) target.setAttribute('aria-invalid', 'true');
  if (message && !field.querySelector('.v23-inline-error[data-runtime-error]')) {
    const note = document.createElement('div');
    note.className = 'v23-inline-error';
    note.dataset.runtimeError = '1';
    note.textContent = message;
    field.appendChild(note);
  }
  return target;
}

function currentAmountIssues() {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  if (!body || !body.querySelector('[data-amount-mode="estimate"].active')) return [];
  const issues = [];
  const currentBase = body.querySelector('[data-key="monthlyContributionBase"]');
  if (currentBase && !(Number(currentBase.value) > 0)) issues.push({ target: currentBase, message: '请填写现在的养老保险月缴费基数。' });
  const futureBase = body.querySelector('[data-v23-flex-custom-input]');
  if (futureBase && !(Number(futureBase.value) > 0)) issues.push({ target: futureBase, message: '请填写未来灵活就业月缴费基数。' });
  const avgIndex = body.querySelector('[data-key="avgIndex"]');
  if (avgIndex && !(Number(avgIndex.value) >= 0.3 && Number(avgIndex.value) <= 3)) issues.push({ target: avgIndex, message: '平均缴费工资指数请填写 0.3 到 3。' });
  const calcBase = body.querySelector('[data-key="currentCalcBase"]');
  if (calcBase && !(Number(calcBase.value) > 0)) issues.push({ target: calcBase, message: '该地区金额估算需要当前养老金计发基准。' });
  return issues;
}

function enhanceStepError() {
  const error = document.getElementById('stepError');
  if (!error) return;
  const text = String(error.textContent || '');
  let primary = null;
  if (text.includes('现在的养老保险月缴费基数')) {
    primary = markFieldError(document.querySelector('[data-key="monthlyContributionBase"]'), '这里填“缴费基数”，不是每月实际扣款金额。');
  } else if (text.includes('灵活就业缴费基数')) {
    primary = markFieldError(document.querySelector('[data-v23-flex-custom-input]'), '未来基数还未填写。');
  } else if (text.includes('计发基准')) {
    const input = document.querySelector('[data-key="currentCalcBase"]');
    const details = input?.closest('details');
    if (details) details.open = true;
    primary = markFieldError(input, '请填写当地人社公布的养老金计发基准。');
    if (!error.dataset.v23Rewritten) {
      error.textContent = '这个地区暂未收录可自动带入的计发基准。请填写“当前养老金计发基准”；如果只想看退休资格，可切换为“只看资格”。';
      error.dataset.v23Rewritten = '1';
    }
  } else if (text.includes('平均缴费工资指数')) {
    primary = markFieldError(document.querySelector('[data-key="avgIndex"]'), '请输入 0.3 到 3 之间的指数。');
  }

  const issues = currentAmountIssues();
  for (const issue of issues) markFieldError(issue.target, issue.message);
  if (issues.length > 1 && !error.querySelector('[data-v23-summary]')) {
    const summary = document.createElement('div');
    summary.dataset.v23Summary = '1';
    summary.style.marginTop = '8px';
    summary.textContent = `本页还有 ${issues.length} 项需要补充，已用红框标出。`;
    error.appendChild(summary);
  }

  const first = primary || issues[0]?.target;
  first?.focus?.({ preventScroll: true });
  first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  unlockResultButton();
}

function forceLegacyFlexModeCustom(body) {
  const custom = body.querySelector('[data-flex-base-mode="custom"]');
  if (!custom) return false;
  if (!custom.classList.contains('active')) {
    custom.click();
    return true;
  }
  return false;
}

function simplifyPlanBaseChoice() {
  const body = document.querySelector('#stepBody[data-step="plan"]');
  if (!body) return;
  const baseField = body.querySelector('[data-flex-base-mode]')?.closest('.field');
  if (!baseField) return;
  if (forceLegacyFlexModeCustom(body)) return;
  if (!body.querySelector('[data-v23-base-next-step-note]')) {
    const note = document.createElement('div');
    note.className = 'help';
    note.dataset.v23BaseNextStepNote = '1';
    note.textContent = '未来灵活就业缴费基数会在下一步结合地区标准选择。';
    baseField.before(note);
  }
  baseField.remove();
}

function setNumericInternalState(key, value) {
  const bridge = document.querySelector('#stepBody[data-step="amount"] [data-key="monthlyContributionBase"]');
  if (!bridge) return;
  const originalKey = bridge.dataset.key;
  const originalValue = bridge.value;
  bridge.dataset.v23Internal = '1';
  bridge.dataset.key = key;
  bridge.value = String(Number(value) || 0);
  bridge.dispatchEvent(new Event('change', { bubbles: true }));
  bridge.dataset.key = originalKey;
  bridge.value = originalValue;
  delete bridge.dataset.v23Internal;
}

function futureFlexNeeded() {
  if (sessionGet(CONTRIBUTION_PLAN_KEY) === 'stop_with_work') return false;
  return sessionGet(AFTER_STOP_MODE_KEY) !== 'same';
}

function applyFutureBase(value) {
  setNumericInternalState('flexMonthlyContributionBase', Number(value) || 0);
}

function injectFutureBaseChoice() {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  if (!body || !body.querySelector('[data-amount-mode="estimate"].active') || !futureFlexNeeded()) return;
  if (body.querySelector('[data-v23-future-base]')) return;
  const regionSelect = body.querySelector('#regionSelect');
  const currentBaseField = body.querySelector('[data-key="monthlyContributionBase"]')?.closest('.field');
  if (!regionSelect || !currentBaseField) return;

  const region = getRegionV4(regionSelect.value || 'other');
  const hasMinimum = Boolean(region.contribution?.current && Number(region.contribution?.min) > 0);
  let mode = sessionGet(FLEX_MODE_KEY);
  if (mode !== 'minimum' && mode !== 'custom') mode = hasMinimum ? 'minimum' : 'custom';
  if (mode === 'minimum' && !hasMinimum) mode = 'custom';
  sessionSet(FLEX_MODE_KEY, mode);

  const customSaved = sessionGet(FLEX_CUSTOM_KEY) || String(savedPlan()?.flexMonthlyContributionBase || '');
  if (mode === 'minimum') applyFutureBase(region.contribution.min);
  else applyFutureBase(customSaved);

  const wrapper = document.createElement('div');
  wrapper.className = 'field v23-future-base';
  wrapper.dataset.v23FutureBase = '1';
  wrapper.innerHTML = `
    <label>未来灵活就业准备按什么基数缴？</label>
    <div class="choice-stack compact-choices">
      ${hasMinimum ? `<button type="button" class="choice ${mode === 'minimum' ? 'active' : ''}" data-v23-flex-mode="minimum"><strong>按当地最低标准</strong><span>当前已核验 ${Number(region.contribution.min).toLocaleString('zh-CN')} 元/月 · ${region.contribution.year}年</span></button>` : ''}
      <button type="button" class="choice ${mode === 'custom' ? 'active' : ''}" data-v23-flex-mode="custom"><strong>我自己填写未来缴费基数</strong></button>
    </div>
    ${mode === 'custom' ? `<div class="field nested-field"><label>未来月缴费基数（元）</label><input data-v23-flex-custom-input type="number" min="0" step="1" value="${customSaved}"><div class="help">这里填“缴费基数”，不是每月实际扣款/缴费金额。</div></div>` : ''}
    ${hasMinimum ? '<div class="help">最低标准来自当前已核验的地区缴费基数参数；政策更新后会继续核验。</div>' : '<div class="v23-warning">该地区最新灵活就业最低缴费基数暂未核验，因此不替你猜数值；请自己填写未来缴费基数。</div>'}`;
  currentBaseField.after(wrapper);

  wrapper.querySelectorAll('[data-v23-flex-mode]').forEach(button => button.addEventListener('click', () => {
    const nextMode = button.dataset.v23FlexMode;
    sessionSet(FLEX_MODE_KEY, nextMode);
    if (nextMode === 'minimum') applyFutureBase(region.contribution.min);
    else applyFutureBase(sessionGet(FLEX_CUSTOM_KEY));
    wrapper.remove();
    injectFutureBaseChoice();
  }));

  wrapper.querySelector('[data-v23-flex-custom-input]')?.addEventListener('input', event => {
    const value = Number(event.target.value);
    sessionSet(FLEX_CUSTOM_KEY, Number.isFinite(value) && value > 0 ? value : '');
    applyFutureBase(value);
    clearFieldError(event.target);
  });
}

function surfaceCalcBaseRequirement() {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  if (!body || !body.querySelector('[data-amount-mode="estimate"].active')) return;
  const calcBase = body.querySelector('[data-key="currentCalcBase"]');
  const regionField = body.querySelector('#regionSelect')?.closest('.field');
  if (!calcBase || !regionField || Number(calcBase.value) > 0 || regionField.querySelector('[data-v23-calc-warning]')) return;
  const warning = document.createElement('div');
  warning.className = 'v23-warning';
  warning.dataset.v23CalcWarning = '1';
  warning.innerHTML = '该地区暂未收录可自动带入的养老金计发基准。要估算金额，需要补充当地人社公布值。<button type="button" data-v23-open-calc-base>现在填写</button>；只想看退休资格可切换“只看资格”。';
  regionField.appendChild(warning);
  warning.querySelector('[data-v23-open-calc-base]')?.addEventListener('click', () => {
    const details = calcBase.closest('details');
    if (details) details.open = true;
    markFieldError(calcBase, '请填写当地人社公布的养老金计发基准。');
    calcBase.focus({ preventScroll: true });
    calcBase.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function lockResultButton(button) {
  resultSubmitting = true;
  button.dataset.v23OriginalText = button.dataset.v23OriginalText || button.textContent;
  button.textContent = '正在计算…';
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('aria-disabled', 'true');
}

function unlockResultButton() {
  const button = document.getElementById('nextBtn');
  resultSubmitting = false;
  if (!button) return;
  button.removeAttribute('aria-busy');
  button.removeAttribute('aria-disabled');
  if (button.dataset.v23OriginalText) {
    button.textContent = button.dataset.v23OriginalText;
    delete button.dataset.v23OriginalText;
  }
}

function emitLocalValidation(reasonCode) {
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'wizard_next', step: 'amount' } }));
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'validation_error', step: 'amount', reason_code: reasonCode } }));
}

function guardFutureCustomBase(event) {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  if (!body || !body.querySelector('[data-amount-mode="estimate"].active')) return false;
  const input = body.querySelector('[data-v23-flex-custom-input]');
  if (!input || Number(input.value) > 0) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  markFieldError(input, '请填写未来灵活就业月缴费基数。');
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus({ preventScroll: true });
  emitLocalValidation('missing_flex_base');
  return true;
}

function resetFlowRuntime() {
  sessionSet(AFTER_STOP_MODE_KEY, '');
  sessionSet(CONTRIBUTION_PLAN_KEY, '');
  sessionSet(FLEX_MODE_KEY, '');
  sessionSet(FLEX_CUSTOM_KEY, '');
  unlockResultButton();
}

installStyles();
injectReleaseNotes();

document.addEventListener('click', event => {
  const intent = event.target.closest('[data-intent]');
  if (intent) {
    const effectiveIntent = normalAmountFlowActive() ? 'normal' : String(intent.dataset.intent || '');
    if (['normal', 'early', 'flex'].includes(effectiveIntent)) {
      sessionSet(AFTER_STOP_MODE_KEY, 'flex');
      sessionSet(CONTRIBUTION_PLAN_KEY, 'to_minimum');
      sessionSet(FLEX_MODE_KEY, '');
      sessionSet(FLEX_CUSTOM_KEY, '');
    }
  }

  if (event.target.closest('#continuePlanBtn')) {
    sessionSet(AFTER_STOP_MODE_KEY, 'same');
    sessionSet(CONTRIBUTION_PLAN_KEY, 'continuous_to_claim');
    sessionSet(FLEX_MODE_KEY, '');
    sessionSet(FLEX_CUSTOM_KEY, '');
  }

  const afterStop = event.target.closest('[data-after-stop]');
  if (afterStop) sessionSet(AFTER_STOP_MODE_KEY, afterStop.dataset.afterStop || 'flex');
  const contributionPlan = event.target.closest('[data-contribution-plan]');
  if (contributionPlan) sessionSet(CONTRIBUTION_PLAN_KEY, contributionPlan.dataset.contributionPlan || '');

  if (event.target.closest('#restartBtn, #newPlanBtn')) {
    resetFlowRuntime();
    return;
  }

  const next = event.target.closest('#nextBtn');
  if (next && document.querySelector('#stepBody[data-step="amount"]')) {
    if (resultSubmitting) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (guardFutureCustomBase(event)) return;
    lockResultButton(next);
  }
}, true);

document.addEventListener('input', event => {
  if (event.target.matches('input,textarea')) clearFieldError(event.target);
}, true);
document.addEventListener('change', event => {
  if (event.target.matches('input,select,textarea')) clearFieldError(event.target);
}, true);

const observer = new MutationObserver(() => {
  if (observerQueued) return;
  observerQueued = true;
  queueMicrotask(() => {
    observerQueued = false;
    simplifyPlanBaseChoice();
    injectFutureBaseChoice();
    surfaceCalcBaseRequirement();
    enhanceStepError();
    injectReleaseNotes();

    const result = document.getElementById('resultView');
    const wizard = document.getElementById('wizardView');
    if (result && !result.classList.contains('hidden')) unlockResultButton();
    else if (wizard && !wizard.classList.contains('hidden') && document.getElementById('stepError')) unlockResultButton();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
