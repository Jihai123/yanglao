const CATEGORY_PROMPT = '退休前主要属于哪种情况？';

function normalizeMonthText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let match = raw.match(/^(\d{4})[-/.年](\d{1,2})(?:月)?$/);
  if (!match) match = raw.match(/^(\d{4})(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function enhanceMonthInput(source) {
  if (!source || source.dataset.v6MonthEnhanced === '1') return;
  source.dataset.v6MonthEnhanced = '1';
  source.classList.add('v6-native-month');

  const editor = document.createElement('div');
  editor.className = 'v6-month-editor';
  source.parentNode.insertBefore(editor, source);

  const row = document.createElement('div');
  row.className = 'v6-month-row';
  editor.appendChild(row);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.inputMode = 'numeric';
  textInput.autocomplete = 'off';
  textInput.maxLength = 8;
  textInput.placeholder = '例如 1983-01';
  textInput.className = 'v6-month-text';
  textInput.value = source.value || '';
  textInput.setAttribute('aria-label', '年月，可直接输入，例如1983-01');
  row.appendChild(textInput);

  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = 'v6-month-choose';
  choose.textContent = '选择年月';
  choose.setAttribute('aria-expanded', 'false');
  row.appendChild(choose);

  const panel = document.createElement('div');
  panel.className = 'v6-month-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="v6-month-panel-head">
      <label>年份 <input class="v6-picker-year" type="text" inputmode="numeric" maxlength="4" placeholder="例如 1983"></label>
      <button class="v6-month-close" type="button" aria-label="关闭年月选择">×</button>
    </div>
    <div class="v6-month-grid" aria-label="选择月份">
      ${Array.from({ length: 12 }, (_, index) => `<button type="button" data-v6-month="${index + 1}">${index + 1}月</button>`).join('')}
    </div>`;
  editor.appendChild(panel);

  const help = document.createElement('div');
  help.className = 'help v6-month-help';
  help.textContent = '可以直接输入“1983-01”（也支持 1983/1），或点“选择年月”；不用在日历里滚动找年份。';
  editor.appendChild(help);

  const nativeRow = document.createElement('div');
  nativeRow.className = 'v6-native-month-row';
  const nativeLabel = document.createElement('span');
  nativeLabel.className = 'v6-native-month-label';
  nativeLabel.textContent = '也可以使用系统日期选择：';
  nativeRow.appendChild(nativeLabel);
  nativeRow.appendChild(source);
  editor.appendChild(nativeRow);

  const yearInput = panel.querySelector('.v6-picker-year');
  const close = panel.querySelector('.v6-month-close');

  function applyValue(value) {
    const normalized = normalizeMonthText(value);
    if (normalized === null) {
      textInput.classList.add('v6-input-error');
      return false;
    }
    textInput.classList.remove('v6-input-error');
    textInput.value = normalized;
    source.value = normalized;
    source.dispatchEvent(new Event('input', { bubbles: true }));
    source.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function syncFromSource() {
    textInput.value = source.value || '';
    textInput.classList.remove('v6-input-error');
  }

  function currentYear() {
    const match = String(textInput.value || source.value || '').match(/^(\d{4})-/);
    return match ? match[1] : String(new Date().getFullYear());
  }

  function setOpen(open) {
    panel.hidden = !open;
    choose.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      yearInput.value = currentYear();
      requestAnimationFrame(() => yearInput.focus());
    }
  }

  choose.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));

  panel.querySelectorAll('[data-v6-month]').forEach(button => {
    button.addEventListener('click', () => {
      const year = Number(yearInput.value);
      const month = Number(button.dataset.v6Month);
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        yearInput.classList.add('v6-input-error');
        yearInput.focus();
        return;
      }
      yearInput.classList.remove('v6-input-error');
      if (applyValue(`${year}-${String(month).padStart(2, '0')}`)) setOpen(false);
    });
  });

  yearInput.addEventListener('input', () => {
    yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
    yearInput.classList.remove('v6-input-error');
  });

  textInput.addEventListener('blur', () => {
    applyValue(textInput.value);
  });

  textInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyValue(textInput.value);
      textInput.blur();
    }
  });

  source.addEventListener('input', syncFromSource);
  source.addEventListener('change', syncFromSource);

  document.addEventListener('click', event => {
    if (!panel.hidden && !editor.contains(event.target)) setOpen(false);
  });
}

function enhanceRetirementCategoryHelp() {
  document.querySelectorAll('.field').forEach(field => {
    if (!field.textContent.includes(CATEGORY_PROMPT)) return;
    if (field.querySelector('[data-v6-category-help]')) return;

    const details = document.createElement('details');
    details.className = 'inline-help v6-category-help';
    details.dataset.v6CategoryHelp = '1';
    details.innerHTML = `
      <summary>不知道怎么选？去哪里查</summary>
      <div class="v6-category-help-body">
        <p><strong>不要只按现在的职位名称猜。</strong>退休年龄分类最终以单位档案和参保地社保经办机构认定为准。</p>
        <ol>
          <li>先看劳动合同、单位人事档案、岗位/身份记录或退休申报资料。</li>
          <li>在单位参保的，可直接问人事或社保经办人员：退休申报时按原50岁口径还是原55岁口径认定。</li>
          <li>仍不确定，可咨询参保地 12333 或社保经办窗口，并说明自己的参保身份和岗位经历。</li>
        </ol>
        <p>拿不准时可以先选“不确定”看两种可能，最终办理时间以当地经办机构核定为准。</p>
      </div>`;
    field.appendChild(details);
  });
}

function enhanceAll() {
  document.querySelectorAll('input[type="month"]:not([data-v6-month-enhanced])').forEach(enhanceMonthInput);
  enhanceRetirementCategoryHelp();
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    enhanceAll();
  });
});

observer.observe(document.documentElement, { childList: true, subtree: true });
enhanceAll();
