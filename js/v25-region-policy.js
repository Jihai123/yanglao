import {
  calcBaseSourceLabelV5,
  contributionSourceLabelV5,
  getRegionV5,
  resolveRegionV5,
  subregionOptionsV5,
} from './sources-v5.js?v=20260904-r3';

const SUBREGION_PREFIX = 'yanglao-v25-subregion:';
const FLEX_MODE_KEY = 'yanglao-v25-flex-mode';
const FLEX_CUSTOM_KEY = 'yanglao-v25-flex-custom-base';
let applyingPolicy = false;
let queued = false;
let manualCalcOverride = false;

function sessionGet(key) {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}

function sessionSet(key, value) {
  try {
    if (value === '' || value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {}
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `¥${Math.round(n).toLocaleString('zh-CN')}` : '—';
}

function selectedRegionKey() {
  return document.querySelector('#stepBody[data-step="amount"] #regionSelect')?.value || 'other';
}

function selectedSubregionKey(regionKey = selectedRegionKey()) {
  const select = document.querySelector('#stepBody[data-step="amount"] #subregionSelect');
  return select?.value || sessionGet(`${SUBREGION_PREFIX}${regionKey}`);
}

function setFieldValue(key, value) {
  const input = document.querySelector(`#stepBody[data-step="amount"] [data-key="${key}"]`);
  if (!input) return;
  const next = value === '' || value === null || value === undefined ? '' : String(value);
  if (String(input.value) === next) return;
  applyingPolicy = true;
  input.value = next;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  applyingPolicy = false;
}

function setNumericInternalState(key, value) {
  const bridge = document.querySelector('#stepBody[data-step="amount"] [data-key="monthlyContributionBase"]');
  if (!bridge) return;
  const originalKey = bridge.dataset.key;
  const originalValue = bridge.value;
  applyingPolicy = true;
  bridge.dataset.v25Internal = '1';
  bridge.dataset.key = key;
  bridge.value = String(Number(value) || 0);
  bridge.dispatchEvent(new Event('change', { bubbles: true }));
  bridge.dataset.key = originalKey;
  bridge.value = originalValue;
  delete bridge.dataset.v25Internal;
  applyingPolicy = false;
}

function resolvedPolicy() {
  const regionKey = selectedRegionKey();
  const region = getRegionV5(regionKey);
  if (!region?.needsSubregion) return resolveRegionV5(regionKey, '');
  return resolveRegionV5(regionKey, selectedSubregionKey(regionKey));
}

function ensureSubregionField() {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  const regionSelect = body?.querySelector('#regionSelect');
  const regionField = regionSelect?.closest('.field');
  if (!body || !regionSelect || !regionField) return;
  body.querySelector('[data-v25-subregion-field]')?.remove();

  const regionKey = regionSelect.value || 'other';
  const region = getRegionV5(regionKey);
  if (!region?.needsSubregion) return;

  const options = subregionOptionsV5(regionKey);
  const saved = sessionGet(`${SUBREGION_PREFIX}${regionKey}`);
  const validSaved = options.some(item => item.key === saved) ? saved : '';
  const field = document.createElement('div');
  field.className = 'field';
  field.dataset.v25SubregionField = '1';
  field.innerHTML = `
    <label>再选一下地区范围</label>
    <select id="subregionSelect">
      <option value="">请选择</option>
      ${options.map(item => `<option value="${item.key}" ${item.key === validSaved ? 'selected' : ''}>${item.name}</option>`).join('')}
    </select>
    <div class="help">这个地区的养老参数存在明确分档，选对后才能自动带入对应标准。</div>`;
  regionField.after(field);
  field.querySelector('#subregionSelect')?.addEventListener('change', event => {
    sessionSet(`${SUBREGION_PREFIX}${regionKey}`, event.target.value || '');
    manualCalcOverride = false;
    applyAmountPolicy();
  });
}

function updateRegionSummary(policy) {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  const regionField = body?.querySelector('#regionSelect')?.closest('.field');
  if (!regionField) return;
  let inline = regionField.querySelector('.region-inline');
  if (!inline) {
    inline = document.createElement('div');
    inline.className = 'region-inline';
    regionField.appendChild(inline);
  }

  if (manualCalcOverride) {
    const input = body.querySelector('[data-key="currentCalcBase"]');
    const year = body.querySelector('[data-key="currentCalcBaseYear"]')?.value;
    inline.classList.remove('muted-inline');
    inline.innerHTML = `<strong>养老金计算参考值 ${money(input?.value)}/月</strong><span>${year ? `${year}年 · ` : ''}已手动修改</span>`;
    return;
  }

  if (policy?.calcBase?.runtimeEligible && Number(policy.calcBase.value) > 0) {
    inline.classList.remove('muted-inline');
    const area = policy.subregionName ? ` · ${policy.subregionName}` : '';
    inline.innerHTML = `<strong>养老金计算参考值 ${money(policy.calcBase.value)}/月</strong><span>${calcBaseSourceLabelV5(policy.calcBase)}${area}</span>`;
  } else {
    inline.classList.add('muted-inline');
    inline.textContent = policy?.subregionRequired
      ? '请先选择地区细分，再自动匹配养老金计算参考值。'
      : '暂未收录可自动带入的可靠养老金计算参考值，可在“高级参数”中手动填写。';
  }
}

function applyCalcBase(policy) {
  if (manualCalcOverride) return;
  if (policy?.calcBase?.runtimeEligible && Number(policy.calcBase.value) > 0) {
    setFieldValue('currentCalcBase', policy.calcBase.value);
    setFieldValue('currentCalcBaseYear', policy.calcBase.year);
  } else {
    setFieldValue('currentCalcBase', '');
    setFieldValue('currentCalcBaseYear', '');
  }
}

function repurposeFutureBase(policy) {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  const wrapper = body?.querySelector('[data-v23-future-base]');
  if (!wrapper || wrapper.dataset.v25Managed === '1') return;
  wrapper.dataset.v25Managed = '1';

  const contribution = policy?.contribution;
  const canUseMinimum = Boolean(contribution?.runtimeEligible && Number(contribution.min) > 0);
  const savedCustom = sessionGet(FLEX_CUSTOM_KEY);
  let mode = sessionGet(FLEX_MODE_KEY);
  if (mode !== 'minimum' && mode !== 'custom') mode = canUseMinimum ? 'minimum' : 'custom';
  if (!canUseMinimum) mode = 'custom';
  sessionSet(FLEX_MODE_KEY, mode);

  if (mode === 'minimum') setNumericInternalState('flexMonthlyContributionBase', contribution.min);
  else setNumericInternalState('flexMonthlyContributionBase', savedCustom);

  wrapper.innerHTML = `
    <label>未来灵活就业准备按什么基数缴？</label>
    <div class="choice-stack compact-choices">
      ${canUseMinimum ? `<button type="button" class="choice ${mode === 'minimum' ? 'active' : ''}" data-v25-flex-mode="minimum"><strong>${contribution.current ? '按当地当前最低标准' : '按最近官方最低标准'}</strong><span>${money(contribution.min)}/月 · ${contributionSourceLabelV5(contribution)}</span></button>` : ''}
      <button type="button" class="choice ${mode === 'custom' ? 'active' : ''}" data-v25-flex-mode="custom"><strong>我自己填写未来缴费基数</strong></button>
    </div>
    ${mode === 'custom' ? `<div class="field nested-field"><label>未来月缴费基数（元）</label><input data-v23-flex-custom-input type="number" min="0" step="1" value="${savedCustom}"><div class="help">这里填“缴费基数”，不是每月实际扣款/缴费金额。</div></div>` : ''}
    ${canUseMinimum
      ? `<div class="help">${contribution.current ? '使用当前已核验地区标准。' : `当前年度新值尚未核验，先用${contribution.year}年最近官方值做规划；年份已明确显示。`}</div>`
      : `<div class="v23-warning">${policy?.subregionRequired ? '请先选择地区细分。' : '该地区最低缴费基数尚未达到自动带入标准。'} 请自己填写未来缴费基数。</div>`}`;

  wrapper.querySelectorAll('[data-v25-flex-mode]').forEach(button => button.addEventListener('click', () => {
    sessionSet(FLEX_MODE_KEY, button.dataset.v25FlexMode || 'custom');
    wrapper.dataset.v25Managed = '0';
    wrapper.innerHTML = '';
    repurposeFutureBase(resolvedPolicy());
  }));
  wrapper.querySelector('[data-v23-flex-custom-input]')?.addEventListener('input', event => {
    const value = Number(event.target.value);
    sessionSet(FLEX_CUSTOM_KEY, Number.isFinite(value) && value > 0 ? value : '');
    setNumericInternalState('flexMonthlyContributionBase', value);
  });
}

function applyAmountPolicy() {
  const body = document.querySelector('#stepBody[data-step="amount"]');
  if (!body || !body.querySelector('[data-amount-mode="estimate"].active')) return;
  ensureSubregionField();
  const policy = resolvedPolicy();
  applyCalcBase(policy);
  updateRegionSummary(policy);
  const wrapper = body.querySelector('[data-v23-future-base]');
  if (wrapper) {
    delete wrapper.dataset.v25Managed;
    repurposeFutureBase(policy);
  }
}

function unlockNextButton() {
  const button = document.getElementById('nextBtn');
  if (!button) return;
  button.removeAttribute('aria-busy');
  button.removeAttribute('aria-disabled');
  if (button.dataset.v23OriginalText) {
    button.textContent = button.dataset.v23OriginalText;
    delete button.dataset.v23OriginalText;
  }
}

function showSubregionError() {
  document.getElementById('stepError')?.remove();
  const field = document.querySelector('[data-v25-subregion-field]');
  if (!field) return;
  field.classList.add('v23-field-error');
  const box = document.createElement('div');
  box.id = 'stepError';
  box.className = 'status danger';
  box.textContent = '这个地区的养老参数存在分档，请先选择对应地区范围。';
  document.querySelector('#stepBody[data-step="amount"]')?.appendChild(box);
  field.querySelector('select')?.focus({ preventScroll: true });
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyAmountPolicy();
  });
}

document.addEventListener('change', event => {
  if (event.target.matches('#regionSelect')) {
    manualCalcOverride = false;
    sessionSet(FLEX_MODE_KEY, '');
    queueApply();
    return;
  }
  if (!applyingPolicy && event.target.matches('[data-key="currentCalcBase"], [data-key="currentCalcBaseYear"]')) {
    manualCalcOverride = true;
    updateRegionSummary(resolvedPolicy());
  }
}, true);

document.addEventListener('click', event => {
  const next = event.target.closest('#nextBtn');
  const body = document.querySelector('#stepBody[data-step="amount"]');
  if (!next || !body || !body.querySelector('[data-amount-mode="estimate"].active')) return;
  const region = getRegionV5(selectedRegionKey());
  if (region?.needsSubregion && !selectedSubregionKey()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    unlockNextButton();
    showSubregionError();
  }
}, true);

new MutationObserver(queueApply).observe(document.body, { childList: true, subtree: true });
queueApply();
