const PLAN_KEY = 'yanglao-v4-plan';
const HISTORY_DRAFT_KEY = 'yanglao-v5-history-draft';
const NORMAL_AMOUNT_FLOW_KEY = 'yanglao-v6-normal-amount-flow';
const NORMAL_CURRENT_AGE_KEY = 'yanglao-v6-normal-current-age';
const FUTURE_GROWTH_OVERRIDE_KEY = 'yanglao-v6-future-growth-override';
const STATIC_RATE = Number.EPSILON;

const KNOWN_CALC_BASES = {
  beijing: { value: 12049, year: 2025, sourceQuality: 'direct' },
  shaanxi: { value: 7881, year: 2025, sourceQuality: 'corroborated' },
};

function migrateSavedPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return;
    const plan = JSON.parse(raw);
    let changed = false;

    if (Array.isArray(plan.historySegments)) {
      plan.historySegments = plan.historySegments.map(item => {
        if (item?.startMonth || item?.endMonth) return item;
        const startYear = Number(item?.startYear || 0);
        const endYear = Number(item?.endYear || 0);
        changed = true;
        return {
          startMonth: startYear ? `${startYear}-01` : '',
          endMonth: endYear ? `${endYear}-12` : '',
          monthlyContributionBase: item?.monthlyContributionBase ?? '',
        };
      });
    }

    const known = KNOWN_CALC_BASES[plan.regionKey];
    if (known && !(Number(plan.currentCalcBase) > 0)) {
      plan.currentCalcBase = known.value;
      plan.currentCalcBaseYear = known.year;
      plan.calcBaseSourceQuality = known.sourceQuality;
      plan.calcBaseMode = 'auto';
      changed = true;
    }

    if (plan.calcBaseMode === 'manual' && !(Number(plan.currentCalcBase) > 0)) {
      plan.calcBaseMode = 'auto';
      changed = true;
    }

    if (changed) localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    // A broken old draft must never block the calculator.
  }
}

function historyInputs() {
  return [...document.querySelectorAll('[data-history-index][data-history-field]')];
}

function collectHistoryRows() {
  const rows = [];
  for (const input of historyInputs()) {
    const index = Number(input.dataset.historyIndex);
    const field = input.dataset.historyField;
    if (!Number.isInteger(index) || !field) continue;
    rows[index] ||= { startMonth: '', endMonth: '', monthlyContributionBase: '' };
    rows[index][field] = input.value;
  }
  if (rows.length) sessionStorage.setItem(HISTORY_DRAFT_KEY, JSON.stringify(rows));
  return rows;
}

function loadHistoryDraft() {
  try {
    const rows = JSON.parse(sessionStorage.getItem(HISTORY_DRAFT_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function pushVisibleValuesIntoCalculator() {
  const inputs = historyInputs();
  if (!inputs.length) return;

  const total = document.getElementById('historyTotalText');
  const originalId = total?.id || '';
  if (total) total.id = 'historyTotalText-syncing';
  try {
    for (const input of inputs) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } finally {
    if (total) total.id = originalId;
  }

  inputs[inputs.length - 1]?.dispatchEvent(new Event('input', { bubbles: true }));
  collectHistoryRows();
}

function restoreVisibleHistoryDraft() {
  const inputs = historyInputs();
  if (!inputs.length) return;
  const draft = loadHistoryDraft();
  if (!draft.length) {
    collectHistoryRows();
    return;
  }

  let restored = false;
  for (const input of inputs) {
    if (input.value) continue;
    const index = Number(input.dataset.historyIndex);
    const field = input.dataset.historyField;
    const value = draft[index]?.[field];
    if (value === undefined || value === null || value === '') continue;
    input.value = String(value);
    restored = true;
  }
  if (restored) pushVisibleValuesIntoCalculator();
  else collectHistoryRows();
}

function explainCalcBaseError() {
  const error = document.getElementById('stepError');
  if (!error || !error.textContent.includes('计发基准')) return;
  const input = document.querySelector('[data-key="currentCalcBase"]');
  if (!input) return;
  const details = input.closest('details');
  if (details) details.open = true;
  input.closest('.field')?.classList.add('v5-needs-attention');
  error.textContent = '这个地区暂未收录可自动带入的计发基准。请在下面“当前养老金计发基准”填写当地人社公布值；如果只是想先看退休资格，可切换为“只看资格”。';
}

function normalAmountFlowActive() {
  return localStorage.getItem(NORMAL_AMOUNT_FLOW_KEY) === '1';
}

function markNormalAmountFlow(active) {
  if (active) localStorage.setItem(NORMAL_AMOUNT_FLOW_KEY, '1');
  else {
    localStorage.removeItem(NORMAL_AMOUNT_FLOW_KEY);
    sessionStorage.removeItem(NORMAL_CURRENT_AGE_KEY);
  }
}

function captureNormalCurrentAge() {
  if (!normalAmountFlowActive()) return;
  const birthInput = document.querySelector('#stepBody[data-step="identity"] [data-key="birth"]');
  const value = String(birthInput?.value || '');
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const now = new Date();
  const currentMonths = (now.getFullYear() * 12 + now.getMonth()) - (birthYear * 12 + birthMonth - 1);
  if (currentMonths >= 0) sessionStorage.setItem(NORMAL_CURRENT_AGE_KEY, String(currentMonths / 12));
}

function alignNormalPlanToCurrentMonth(body) {
  const stopInput = body.querySelector('[data-key="stopWorkAge"]');
  const exactAge = Number(sessionStorage.getItem(NORMAL_CURRENT_AGE_KEY));
  if (!stopInput || !Number.isFinite(exactAge) || exactAge < 0) return false;
  if (Math.abs(Number(stopInput.value) - exactAge) < 0.000001) return false;
  stopInput.value = String(exactAge);
  stopInput.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function relabelNormalPlanStep() {
  if (!normalAmountFlowActive()) return;
  const body = document.querySelector('#stepBody[data-step="plan"]');
  if (!body || body.querySelector('[data-v6-normal-plan-marker]')) return;

  // Flex planning internally splits "before stop" vs "after stop". For the normal
  // pension amount flow there is no hidden pre-stop period: the user's chosen future
  // base applies from the current month. Align the hidden stop point exactly to now.
  if (alignNormalPlanToCurrentMonth(body)) return;

  const marker = document.createElement('span');
  marker.hidden = true;
  marker.dataset.v6NormalPlanMarker = '1';
  body.appendChild(marker);

  const title = document.getElementById('stepTitle');
  const desc = document.getElementById('stepDesc');
  if (title) title.textContent = '从现在起，养老保险准备怎么缴？';
  if (desc) desc.textContent = '这里决定未来实际缴多久、按什么基数缴。不会默认替你一直缴到退休。';

  body.querySelector('[data-key="stopWorkAge"]')?.closest('.field')?.setAttribute('hidden', '');
  body.querySelector('[data-retirement-mode]')?.closest('.field')?.setAttribute('hidden', '');

  const planField = body.querySelector('[data-contribution-plan]')?.closest('.field');
  const planLabel = planField?.querySelector('label');
  if (planLabel) planLabel.textContent = '从现在起，还准备缴多久？';
  const stopChoice = planField?.querySelector('[data-contribution-plan="stop_with_work"] strong');
  if (stopChoice) stopChoice.textContent = '从现在起不再缴';

  const actualField = body.querySelector('[data-key="actualFutureYears"]')?.closest('.field');
  const actualLabel = actualField?.querySelector('label');
  if (actualLabel) actualLabel.textContent = '预计还会实际缴';

  const futureModeField = body.querySelector('[data-after-stop]')?.closest('.field');
  const futureModeLabel = futureModeField?.querySelector('label');
  if (futureModeLabel) futureModeLabel.textContent = '以后继续缴时';
  const flexButton = futureModeField?.querySelector('[data-after-stop="flex"]');
  if (flexButton) flexButton.textContent = '按另一个基数缴';
  const sameButton = futureModeField?.querySelector('[data-after-stop="same"]');
  if (sameButton) sameButton.textContent = '按现在基数缴';

  const baseField = body.querySelector('[data-flex-base-mode]')?.closest('.field');
  const baseLabel = baseField?.querySelector('label');
  if (baseLabel) baseLabel.textContent = '以后准备按什么缴费基数？';
  const customStrong = baseField?.querySelector('[data-flex-base-mode="custom"] strong');
  if (customStrong) customStrong.textContent = '我自己填写未来缴费基数';
  const nested = body.querySelector('[data-key="flexMonthlyContributionBase"]')?.closest('.field');
  const nestedLabel = nested?.querySelector('label');
  if (nestedLabel) nestedLabel.textContent = '未来月缴费基数（元）';
  if (nested && !nested.querySelector('[data-v6-base-help]')) {
    const help = document.createElement('div');
    help.className = 'help';
    help.dataset.v6BaseHelp = '1';
    help.textContent = '这里填“缴费基数”，不是每月实际扣款/缴费金额。';
    nested.appendChild(help);
  }
}

function setLegacyBoundState(input, key, value) {
  const originalKey = input.dataset.key;
  const originalValue = input.value;
  input.dataset.v6InternalAssumption = '1';
  input.dataset.key = key;
  input.value = String(value);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dataset.key = originalKey;
  input.value = originalValue;
  delete input.dataset.v6InternalAssumption;
}

function enforceStaticFutureAssumptions() {
  const input = document.querySelector('#stepBody[data-step="amount"] [data-key="socialWageGrowthPercent"]');
  if (!input || input.dataset.v6StaticApplied === '1') return;

  const explicit = sessionStorage.getItem(FUTURE_GROWTH_OVERRIDE_KEY);
  const requestedPercent = explicit === null ? 0 : Number(explicit);
  const effectiveRate = requestedPercent === 0 ? STATIC_RATE : requestedPercent / 100;

  input.dataset.v6InternalAssumption = '1';
  input.value = String(requestedPercent === 0 ? Number.EPSILON * 100 : requestedPercent);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.value = String(requestedPercent);
  delete input.dataset.v6InternalAssumption;

  // accountInterest has no user-facing control in the legacy calculator. Reuse an
  // already-bound input listener to set the internal state without adding a hidden
  // 3% assumption. Number.EPSILON is used because the legacy code treats literal 0
  // as "missing" and falls back to 3%; numerically it behaves as zero.
  setLegacyBoundState(input, 'accountInterest', STATIC_RATE);
  input.dataset.v6StaticApplied = '1';
}

function annotateStaticProjectionResult() {
  const result = document.getElementById('resultView');
  if (!result || result.classList.contains('hidden') || result.querySelector('[data-v6-static-assumption]')) return;
  const amountCard = [...result.querySelectorAll('.card.section')].find(card => card.textContent.includes('养老金金额'));
  if (!amountCard) return;
  const note = document.createElement('div');
  note.className = 'plain-note section';
  note.dataset.v6StaticAssumption = '1';
  note.innerHTML = '<strong>默认静态估算口径</strong><span>未来养老金计发基准、未来缴费基数和个人账户记账利率均按0%增长/计息估算，不预设2046年的工资或利率涨幅。高级参数可自行调整未来社会工资增长率。</span>';
  amountCard.before(note);
}

function relabelNormalResult() {
  if (!normalAmountFlowActive()) return;
  const result = document.getElementById('resultView');
  if (!result || result.classList.contains('hidden') || result.querySelector('[data-v6-normal-result-marker]')) return;

  const marker = document.createElement('span');
  marker.hidden = true;
  marker.dataset.v6NormalResultMarker = '1';
  result.appendChild(marker);

  const cells = [...result.querySelectorAll('.result-cell')];
  if (cells[0]) {
    const key = cells[0].querySelector('.k');
    const value = cells[0].querySelector('.v');
    if (key) key.textContent = '未来计划';
    if (value) value.textContent = '按填写方案';
  }

  const timelineItems = [...result.querySelectorAll('.timeline .tl-item')];
  const stopItem = timelineItems.find(item => item.textContent.includes('停止工作'));
  stopItem?.remove();

  const planNote = [...result.querySelectorAll('.plain-note')].find(item => item.textContent.includes('未来缴费安排'));
  if (planNote) planNote.innerHTML = planNote.innerHTML.replace(/灵活就业/g, '未来缴费');
}

migrateSavedPlan();

// The old normal amount path silently assumed continuous contributions until claim age.
// Route that entry through the planning-capable engine, while presenting a neutral
// "future contribution plan" UI. This keeps the existing projection engine but makes
// duration and future contribution base explicit instead of hidden assumptions.
document.addEventListener('click', event => {
  const intentButton = event.target.closest('[data-intent]');
  if (intentButton) {
    const requestedIntent = intentButton.dataset.intent;
    if (requestedIntent === 'normal') {
      markNormalAmountFlow(true);
      intentButton.dataset.intent = 'flex';
      setTimeout(() => { intentButton.dataset.intent = 'normal'; }, 0);
    } else {
      markNormalAmountFlow(false);
    }
  }

  if (normalAmountFlowActive() && event.target.closest('#nextBtn') && document.querySelector('#stepBody[data-step="identity"]')) {
    captureNormalCurrentAge();
  }

  if (event.target.closest('#restartBtn, #newPlanBtn')) {
    sessionStorage.removeItem(HISTORY_DRAFT_KEY);
    sessionStorage.removeItem(FUTURE_GROWTH_OVERRIDE_KEY);
    markNormalAmountFlow(false);
    return;
  }

  const rerenderAction = event.target.closest('#historyAddBtn, [data-history-remove], #backBtn, #nextBtn, [data-history-mode], [data-amount-mode]');
  if (rerenderAction) pushVisibleValuesIntoCalculator();
}, true);

document.addEventListener('change', event => {
  if (event.target.matches('[data-history-index][data-history-field]')) collectHistoryRows();
  if (event.target.matches('[data-key="socialWageGrowthPercent"]') && event.target.dataset.v6InternalAssumption !== '1') {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) sessionStorage.setItem(FUTURE_GROWTH_OVERRIDE_KEY, String(value));
  }
}, true);

document.addEventListener('input', event => {
  if (event.target.matches('[data-history-index][data-history-field]')) collectHistoryRows();
}, true);

let restoreQueued = false;
const observer = new MutationObserver(() => {
  if (restoreQueued) return;
  restoreQueued = true;
  queueMicrotask(() => {
    restoreQueued = false;
    restoreVisibleHistoryDraft();
    explainCalcBaseError();
    relabelNormalPlanStep();
    enforceStaticFutureAssumptions();
    relabelNormalResult();
    annotateStaticProjectionResult();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
