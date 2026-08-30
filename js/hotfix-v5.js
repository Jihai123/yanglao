const PLAN_KEY = 'yanglao-v4-plan';
const HISTORY_DRAFT_KEY = 'yanglao-v5-history-draft';
const NORMAL_AMOUNT_FLOW_KEY = 'yanglao-v6-normal-amount-flow';

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
  else localStorage.removeItem(NORMAL_AMOUNT_FLOW_KEY);
}

function relabelNormalPlanStep() {
  if (!normalAmountFlowActive()) return;
  const body = document.querySelector('#stepBody[data-step="plan"]');
  if (!body || body.querySelector('[data-v6-normal-plan-marker]')) return;

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

  if (event.target.closest('#restartBtn, #newPlanBtn')) {
    sessionStorage.removeItem(HISTORY_DRAFT_KEY);
    markNormalAmountFlow(false);
    return;
  }

  const rerenderAction = event.target.closest('#historyAddBtn, [data-history-remove], #backBtn, #nextBtn, [data-history-mode], [data-amount-mode]');
  if (rerenderAction) pushVisibleValuesIntoCalculator();
}, true);

document.addEventListener('change', event => {
  if (event.target.matches('[data-history-index][data-history-field]')) collectHistoryRows();
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
    relabelNormalResult();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
