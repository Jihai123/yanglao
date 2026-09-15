const FLOW_KEY = 'yanglao-v6-flow';
const FLOW_FEATURE_KEY = 'yanglao-v6-flow-feature';

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const CURRENT_MONTH = currentMonthValue();

function safeSessionSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

function randomFlowId() {
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function dispatchTrack(event, params = {}) {
  window.dispatchEvent(new CustomEvent('yanglao:track', {
    detail: { event, ...params },
  }));
}

function ensureUxStyles() {
  if (document.getElementById('v263PrecisionUxStyles')) return;
  const style = document.createElement('style');
  style.id = 'v263PrecisionUxStyles';
  style.textContent = `
    #stepBody [data-v263-error-target="1"] {
      border-color: #b54747 !important;
      box-shadow: 0 0 0 3px rgba(181, 71, 71, .12);
    }
    .v263-field-error {
      margin-top: 6px;
      color: #9f3434;
      font-size: 12px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

function removeDuplicateQuickUpgrade() {
  document.getElementById('quickUpgradeBtnBottom')?.remove();
}

function constrainHistoryMonths() {
  document.querySelectorAll('[data-history-field="startMonth"], [data-history-field="endMonth"]').forEach(input => {
    input.max = CURRENT_MONTH;
  });
}

function clearV263FieldError() {
  document.querySelectorAll('#stepBody [data-v263-error-target="1"]').forEach(input => {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('data-v263-error-target');
  });
  document.querySelectorAll('#stepBody .v263-field-error').forEach(node => node.remove());
}

function monthIndex(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if (!match) return NaN;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function firstHistoryInput(field, predicate = null) {
  const inputs = [...document.querySelectorAll(`[data-history-field="${field}"]`)];
  if (!predicate) return inputs[0] || null;
  return inputs.find(predicate) || inputs[0] || null;
}

function historyValidationTarget(message) {
  const text = String(message || '');
  const nowIndex = monthIndex(CURRENT_MONTH);

  if (text.includes('结束年月不能晚于当前月份')) {
    return firstHistoryInput('endMonth', input => monthIndex(input.value) > nowIndex);
  }
  if (text.includes('结束年月不能早于开始年月')) {
    const starts = [...document.querySelectorAll('[data-history-field="startMonth"]')];
    const ends = [...document.querySelectorAll('[data-history-field="endMonth"]')];
    for (let i = 0; i < Math.max(starts.length, ends.length); i += 1) {
      if (monthIndex(ends[i]?.value) < monthIndex(starts[i]?.value)) return ends[i] || starts[i] || null;
    }
    return ends[0] || null;
  }
  if (text.includes('开始、结束年月填完整')) {
    return firstHistoryInput('startMonth', input => !input.value)
      || firstHistoryInput('endMonth', input => !input.value);
  }
  if (text.includes('每一段的月缴费基数')) {
    return firstHistoryInput('monthlyContributionBase', input => !(Number(input.value) > 0));
  }
  if (text.includes('至少填写一段历史缴费')) {
    return firstHistoryInput('startMonth');
  }
  if (text.includes('历史分段合计') || text.includes('历史缴费时间段不能重叠')) {
    return firstHistoryInput('startMonth');
  }
  return null;
}

function focusValidationError() {
  const error = document.getElementById('stepError');
  if (!error || !error.textContent) return;
  const target = historyValidationTarget(error.textContent);
  if (!target) return;

  clearV263FieldError();
  target.setAttribute('data-v263-error-target', '1');
  target.setAttribute('aria-invalid', 'true');
  const holder = target.closest('.history-month, .history-base, .field') || target.parentElement;
  if (holder && !holder.querySelector('.v263-field-error')) {
    const hint = document.createElement('div');
    hint.className = 'v263-field-error';
    hint.textContent = error.textContent;
    holder.appendChild(hint);
  }

  try { target.focus({ preventScroll: true }); } catch { target.focus(); }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function patchRenderedUi() {
  ensureUxStyles();
  removeDuplicateQuickUpgrade();
  constrainHistoryMonths();
}

function startPreciseUpgradeFlow() {
  const flowId = randomFlowId();
  safeSessionSet(FLOW_KEY, flowId);
  safeSessionSet(FLOW_FEATURE_KEY, 'normal');
  dispatchTrack('flow_start', { feature: 'normal' });
  setTimeout(() => {
    const body = document.getElementById('stepBody');
    if (body?.dataset.step === 'identity') {
      dispatchTrack('step_view', { feature: 'normal', step: 'identity' });
    }
  }, 0);
}

// The calculator's target-level click handler records pension_upgrade_click while the
// original quick flow is still active. This document-level handler runs afterwards,
// so the follow-on precise journey gets its own flow instead of polluting quick errors.
document.addEventListener('click', event => {
  if (event.target.closest('#quickUpgradeBtn, #quickUpgradeBtnBottom')) {
    startPreciseUpgradeFlow();
    return;
  }

  if (event.target.closest('#nextBtn')) {
    clearV263FieldError();
    setTimeout(() => {
      patchRenderedUi();
      focusValidationError();
    }, 0);
  }
});

document.addEventListener('input', event => {
  if (!event.target.matches('[data-history-index][data-history-field]')) return;
  if (event.target.dataset.v263ErrorTarget === '1') clearV263FieldError();
});

document.addEventListener('change', event => {
  if (!event.target.matches('[data-history-index][data-history-field]')) return;
  constrainHistoryMonths();
});

const observer = new MutationObserver(patchRenderedUi);
observer.observe(document.body, { childList: true, subtree: true });
patchRenderedUi();
