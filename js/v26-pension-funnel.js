const QUICK_MODE_KEY = 'yanglao-v26-pension-quick';
const QUICK_DEFAULTS_KEY = 'yanglao-v26-pension-defaults';
const QUICK_BYPASS_KEY = 'yanglao-v26-pension-bypass';

let queued = false;
let lastBlockedReason = '';
let resultTracked = false;

function sessionGet(key) {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}

function sessionSet(key, value) {
  try {
    if (value === '' || value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {}
}

function quickActive() {
  return sessionGet(QUICK_MODE_KEY) === '1';
}

function track(event, step = '') {
  window.dispatchEvent(new CustomEvent('yanglao:track', {
    detail: { event, feature: 'normal_quick', step },
  }));
}

function startQuickMode(button) {
  sessionSet(QUICK_MODE_KEY, '1');
  sessionSet(QUICK_DEFAULTS_KEY, '');
  resultTracked = false;
  lastBlockedReason = '';
  document.body.classList.add('v26-pension-quick');

  // hotfix-v5 intentionally rewrites the normal entry to flex during capture.
  // V26 restores the original normal intent for the quick path so the existing
  // three-step calculator is reused. The assumption is made explicit in the UI.
  button.dataset.intent = 'normal';
  track('quick_pension_start', 'home');
}

function clearQuickMode() {
  sessionSet(QUICK_MODE_KEY, '');
  sessionSet(QUICK_DEFAULTS_KEY, '');
  document.body.classList.remove('v26-pension-quick');
}

function ensureStyles() {
  if (document.getElementById('v26PensionStyles')) return;
  const style = document.createElement('style');
  style.id = 'v26PensionStyles';
  style.textContent = `
    .v26-quick-note{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f5faf7;border:1px solid rgba(34,103,84,.14);font-size:14px;line-height:1.65;color:#45645a}
    .v26-quick-note strong{display:block;color:#245d4e;margin-bottom:2px}
    .v26-pension-quick #stepBody[data-step="status"] .inline-help{display:none}
    .v26-pension-quick #stepBody[data-step="amount"] [data-v26-amount-mode-field]{display:none}
    .v26-optional{margin-top:4px}
    .v26-optional>summary{cursor:pointer;color:#45645a;font-weight:600;padding:8px 0}
    .v26-optional-body{display:grid;gap:14px;padding-top:8px}
    .v26-result-upgrade{margin:18px 0;padding:18px;border-radius:16px;background:#f7faf8;border:1px solid rgba(34,103,84,.14)}
    .v26-result-upgrade h3{margin:0 0 8px;font-size:18px;color:#1d4f42}
    .v26-result-upgrade p{margin:0 0 12px;color:#60756d;line-height:1.65}
    .v26-result-upgrade .btn{width:100%}
    .v26-error-help{margin-top:8px;font-size:13px;line-height:1.6;color:#687a73}
  `;
  document.head.appendChild(style);
}

function fieldByLabel(body, text) {
  return [...body.querySelectorAll('.field')].find(field => {
    const label = field.querySelector(':scope > label');
    return label && label.textContent.trim().includes(text);
  }) || null;
}

function addQuickNote(body, key, title, text) {
  if (body.querySelector(`[data-v26-note="${key}"]`)) return;
  const note = document.createElement('div');
  note.className = 'v26-quick-note';
  note.dataset.v26Note = key;
  note.innerHTML = `<strong>${title}</strong><span>${text}</span>`;
  body.prepend(note);
}

function enhanceIdentity(body) {
  const title = document.getElementById('stepTitle');
  const desc = document.getElementById('stepDesc');
  if (title) title.textContent = '先确认你的基本信息';
  if (desc) desc.textContent = '这一步只决定退休年龄规则，不涉及养老金金额。';
}

function enhanceStatus(body) {
  const title = document.getElementById('stepTitle');
  const desc = document.getElementById('stepDesc');
  if (title) title.textContent = '你已经缴了多久？';
  if (desc) desc.textContent = '先填累计缴费年限即可；个人账户不知道也能继续。';
  addQuickNote(body, 'status', '先填你知道的', '个人账户余额和视同缴费年限都是补充项。没有或不知道时保持默认即可。');
}

function applyQuickAmountDefaults(body) {
  if (sessionGet(QUICK_DEFAULTS_KEY) === '1') return true;

  const estimate = body.querySelector('[data-amount-mode="estimate"]');
  if (estimate && !estimate.classList.contains('active')) {
    estimate.click();
    return false;
  }

  const quickHistory = body.querySelector('[data-history-mode="quick"]');
  if (quickHistory && !quickHistory.classList.contains('active')) {
    quickHistory.click();
    return false;
  }

  sessionSet(QUICK_DEFAULTS_KEY, '1');
  return true;
}

function collapseOptionalAmountFields(body) {
  if (body.querySelector('[data-v26-optional-amount]')) return;
  const historyMode = fieldByLabel(body, '过去的缴费情况');
  const historyPattern = fieldByLabel(body, '过去大多数年份');
  const exactIndex = fieldByLabel(body, '本人平均缴费工资指数');
  const transition = fieldByLabel(body, '过渡性养老金');
  const historySegments = fieldByLabel(body, '历史缴费基数');
  const fields = [historyMode, historyPattern, exactIndex, transition, historySegments].filter(Boolean);
  if (!fields.length) return;

  const details = document.createElement('details');
  details.className = 'disclosure v26-optional';
  details.dataset.v26OptionalAmount = '1';
  details.innerHTML = '<summary>可选：补充过去缴费情况，让估算更贴近实际</summary><div class="v26-optional-body"></div>';
  const target = details.querySelector('.v26-optional-body');
  fields[0].before(details);
  fields.forEach(field => target.appendChild(field));
}

function enhanceAmount(body) {
  if (!applyQuickAmountDefaults(body)) return;

  const title = document.getElementById('stepTitle');
  const desc = document.getElementById('stepDesc');
  if (title) title.textContent = '最后补 2 项，估个养老金范围';
  if (desc) desc.textContent = '选择预计待遇领取地，再填现在的养老保险月缴费基数。其他细节可以以后再补。';

  const amountMode = body.querySelector('[data-amount-mode]')?.closest('.field');
  if (amountMode) amountMode.dataset.v26AmountModeField = '1';

  addQuickNote(
    body,
    'amount',
    '快速估算默认口径',
    '默认按法定退休时间，并假设你从现在起继续按当前缴费基数参保到退休。结果页可以再进入完整规划，模拟提前停工、灵活就业或不同缴费年限。',
  );
  collapseOptionalAmountFields(body);

  const monthly = body.querySelector('[data-key="monthlyContributionBase"]');
  if (monthly) {
    monthly.placeholder = '例如 7000';
    const help = monthly.closest('.field')?.querySelector('.help');
    if (help) help.textContent = '填社保记录里的“缴费基数”，不是个人每月实际扣款金额。不确定时可在电子社保卡 / 社保权益记录中查询。';
  }
}

function blockedReason(text) {
  if (text.includes('计发基准')) return 'missing_calc_base';
  if (text.includes('月缴费基数')) return 'missing_current_base';
  if (text.includes('过渡性养老金')) return 'missing_transition_info';
  return 'other';
}

function enhanceError(body) {
  const error = body.querySelector('#stepError');
  if (!error || error.dataset.v26Enhanced === '1') return;
  error.dataset.v26Enhanced = '1';
  const reason = blockedReason(error.textContent || '');
  if (reason !== lastBlockedReason) {
    lastBlockedReason = reason;
    track('quick_pension_blocked', body.dataset.step || '');
  }

  const helper = document.createElement('div');
  helper.className = 'v26-error-help';
  if (reason === 'missing_current_base') {
    helper.textContent = '这不是每月扣了多少钱，而是社保记录里的“缴费基数”。电子社保卡或个人权益记录通常可以查到。';
  } else if (reason === 'missing_calc_base') {
    helper.textContent = '这个地区暂时没有达到自动带入标准的可靠计发参数。为了不编造一个看似精确的养老金数字，系统会要求补充当地人社公布值。';
  } else if (reason === 'missing_transition_info') {
    helper.textContent = '存在视同缴费年限时，过渡性养老金受地方规则影响较大，不能直接省略后给出总金额。';
  } else {
    return;
  }
  error.appendChild(helper);
}

function startDetailedPlan() {
  sessionSet(QUICK_BYPASS_KEY, '1');
  clearQuickMode();
  track('quick_pension_upgrade', 'result');
  const entry = document.getElementById('pensionQuickEntry');
  if (!entry) return;
  entry.dataset.analyticsFeature = 'normal';
  entry.click();
  setTimeout(() => { entry.dataset.analyticsFeature = 'normal_quick'; }, 0);
}

function enhanceResult() {
  if (!quickActive()) return;
  const result = document.getElementById('resultView');
  if (!result || result.classList.contains('hidden')) return;

  if (!resultTracked) {
    resultTracked = true;
    const amountAvailable = Boolean(result.querySelector('.amount-decision.amount-good'));
    track(amountAvailable ? 'quick_pension_result' : 'quick_pension_partial_result', 'result');
  }

  if (result.querySelector('[data-v26-result-upgrade]')) return;
  const actions = result.querySelector('.result-actions');
  if (!actions) return;

  const box = document.createElement('div');
  box.className = 'v26-result-upgrade';
  box.dataset.v26ResultUpgrade = '1';
  box.innerHTML = `
    <h3>这是快速估算，还可以继续把方案算细</h3>
    <p>当前默认你持续参保到法定退休。想比较“几年后不工作”“灵活就业继续缴”“多缴几年能多领多少”，再进入完整规划。</p>
    <button class="btn primary" id="v26DetailedPlanBtn" type="button">继续完善退休规划</button>`;
  actions.before(box);
  box.querySelector('#v26DetailedPlanBtn')?.addEventListener('click', startDetailedPlan);
}

function enhanceVisibleStep() {
  if (!quickActive()) return;
  document.body.classList.add('v26-pension-quick');
  const body = document.querySelector('#stepBody');
  if (!body) return;
  const step = body.dataset.step || '';
  if (step === 'identity') enhanceIdentity(body);
  if (step === 'status') enhanceStatus(body);
  if (step === 'amount') enhanceAmount(body);
  enhanceError(body);
  enhanceResult();
}

function queueEnhance() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    enhanceVisibleStep();
    enhanceResult();
  });
}

ensureStyles();
if (quickActive()) document.body.classList.add('v26-pension-quick');

document.addEventListener('click', event => {
  const button = event.target.closest('#pensionQuickEntry');
  if (button) {
    if (sessionGet(QUICK_BYPASS_KEY) === '1') {
      sessionSet(QUICK_BYPASS_KEY, '');
      clearQuickMode();
      return;
    }
    startQuickMode(button);
    return;
  }

  if (event.target.closest('[data-intent="age"], [data-intent="early"], [data-intent="flex"], #residentEntry, #restartBtn, #newPlanBtn')) {
    clearQuickMode();
  }
}, true);

const stepBody = document.getElementById('stepBody');
if (stepBody && window.MutationObserver) {
  new MutationObserver(queueEnhance).observe(stepBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-step', 'class'] });
}

const resultView = document.getElementById('resultView');
if (resultView && window.MutationObserver) {
  new MutationObserver(queueEnhance).observe(resultView, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

window.addEventListener('yanglao:v4-result', queueEnhance);
queueEnhance();
