const AMOUNT_STEP_SELECTOR = '#stepBody[data-step="amount"]';
const REGION_PLACEHOLDER_VALUE = '';
const REGION_OTHER_VALUE = 'other';
let queued = false;

function amountBody() {
  return document.querySelector(AMOUNT_STEP_SELECTOR);
}

function estimateActive(body = amountBody()) {
  return Boolean(body?.querySelector('[data-amount-mode="estimate"].active'));
}

function regionSelect(body = amountBody()) {
  return body?.querySelector('#regionSelect') || null;
}

function ensurePlaceholder(select) {
  if (!select) return;
  let placeholder = select.querySelector('option[data-v25-region-placeholder]');
  if (!placeholder) {
    placeholder = document.createElement('option');
    placeholder.value = REGION_PLACEHOLDER_VALUE;
    placeholder.textContent = '请选择省份';
    placeholder.disabled = true;
    placeholder.dataset.v25RegionPlaceholder = '1';
    select.prepend(placeholder);
  }

  const other = select.querySelector(`option[value="${REGION_OTHER_VALUE}"]`);
  if (other && other.textContent !== '暂时不确定（建议先只看资格）') {
    other.textContent = '暂时不确定（建议先只看资格）';
  }

  if (!select.dataset.v25RegionChoiceInitialized) {
    select.dataset.v25RegionChoiceInitialized = '1';
    if (select.value === REGION_OTHER_VALUE) select.value = REGION_PLACEHOLDER_VALUE;
  }
}

function fieldFor(select) {
  return select?.closest('.field') || null;
}

function ensureNeutralHint(select) {
  const field = fieldFor(select);
  if (!field) return;
  const label = field.querySelector('label');
  if (label && label.textContent !== '预计在哪个省份办理退休？') {
    label.textContent = '预计在哪个省份办理退休？';
  }

  const help = field.querySelector('.help');
  if (help && help.textContent !== '这里指预计办理退休待遇的省份，不是退休后居住地。跨省缴过社保、暂时拿不准时，可以先只看资格。') {
    help.textContent = '这里指预计办理退休待遇的省份，不是退休后居住地。跨省缴过社保、暂时拿不准时，可以先只看资格。';
  }

  const unselected = !select.value || select.value === REGION_OTHER_VALUE;
  if (!unselected) {
    field.querySelector('[data-v25-region-choice-hint]')?.remove();
    return;
  }

  field.querySelector('[data-v23-calc-warning]')?.remove();
  const inline = field.querySelector('.region-inline');
  if (inline) {
    inline.classList.add('muted-inline');
    const text = select.value === REGION_OTHER_VALUE
      ? '暂时不确定办理退休地区时，建议先切换“只看资格”；确定地区后再回来估算金额。'
      : '请选择预计办理退休的省份，系统会自动匹配已收录的可靠地区参数。';
    if (inline.textContent !== text) inline.textContent = text;
  }

  let hint = field.querySelector('[data-v25-region-choice-hint]');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'help';
    hint.dataset.v25RegionChoiceHint = '1';
    field.appendChild(hint);
  }
  const nextText = select.value === REGION_OTHER_VALUE
    ? '暂时不确定也没关系：可先切换“只看资格”，不影响退休年龄和最低缴费年限判断。'
    : '先选省份后再估算金额；暂时不确定时，可以切换“只看资格”。';
  if (hint.textContent !== nextText) hint.textContent = nextText;
}

function clearRegionError() {
  const error = document.getElementById('stepError');
  if (error?.dataset.v25RegionChoiceError === '1') error.remove();
  fieldFor(regionSelect())?.classList.remove('v23-field-error');
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

function showRegionRequired(select) {
  clearRegionError();
  const field = fieldFor(select);
  field?.classList.add('v23-field-error');
  const error = document.createElement('div');
  error.id = 'stepError';
  error.className = 'status danger';
  error.dataset.v25RegionChoiceError = '1';
  error.textContent = '要估算养老金金额，请先选择预计办理退休的省份；暂时不确定可切换“只看资格”。';
  amountBody()?.appendChild(error);
  select?.focus({ preventScroll: true });
  select?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function applyRegionChoiceUx() {
  const body = amountBody();
  if (!body || !estimateActive(body)) return;
  const select = regionSelect(body);
  if (!select) return;
  ensurePlaceholder(select);
  ensureNeutralHint(select);
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyRegionChoiceUx();
  });
}

document.addEventListener('change', event => {
  if (!event.target.matches('#regionSelect')) return;
  clearRegionError();
  queueApply();
}, true);

document.addEventListener('click', event => {
  const next = event.target.closest('#nextBtn');
  const body = amountBody();
  if (!next || !body || !estimateActive(body)) return;
  const select = regionSelect(body);
  if (!select || (select.value && select.value !== REGION_OTHER_VALUE)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  unlockNextButton();
  showRegionRequired(select);
}, true);

new MutationObserver(queueApply).observe(document.body, { childList: true, subtree: true });
queueApply();
