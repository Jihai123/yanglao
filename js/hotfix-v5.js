const PLAN_KEY = 'yanglao-v4-plan';
const HISTORY_DRAFT_KEY = 'yanglao-v5-history-draft';

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
  for (const input of historyInputs()) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
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
    input.dispatchEvent(new Event('input', { bubbles: true }));
    restored = true;
  }
  if (restored) collectHistoryRows();
}

migrateSavedPlan();

// The V4 month controls can visually contain a value before that value reaches its
// internal state. Flush the visible editor before any action that may re-render it.
document.addEventListener('click', event => {
  if (event.target.closest('#restartBtn')) {
    sessionStorage.removeItem(HISTORY_DRAFT_KEY);
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
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
