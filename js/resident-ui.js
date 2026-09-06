import { projectResidentPension, RESIDENT_ACCOUNT_DIVISOR, RESIDENT_MIN_CONTRIBUTION_YEARS } from './resident.js';

const nowDate = new Date();
const NOW = { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 };
const STORAGE_KEY = 'yanglao-v2-resident-plan';
const OFFICIAL_RULE = 'https://www.mohrss.gov.cn/SYrlzyhshbzb/shehuibaozhang/zcwj/201405/t20140527_131029.html';
const OFFICIAL_ADJUSTMENT = 'https://www.mohrss.gov.cn/wap/zc/zcwj/201803/t20180329_291008.html';
const OFFICIAL_2026_UPDATE = 'https://www.mohrss.gov.cn/SYrlzyhshbzb/dongtaixinwen/buneiyaowen/rsxw/202607/t20260722_580692.html';

const state = {
  step: 0,
  birth: '1970-01',
  paidYears: 10,
  knowsAccount: false,
  currentAccount: '',
  futureContributionYears: 5,
  annualContribution: 1000,
  annualSubsidy: 100,
  localBasicPension: '',
  localMonthlyBonus: 0,
  accountInterest: 0.03,
};

const residentView = document.getElementById('residentView');
const homeView = document.getElementById('homeView');
const wizardView = document.getElementById('wizardView');
const resultView = document.getElementById('resultView');
const stickyActions = document.getElementById('stickyActions');

function money(n) {
  return `¥${Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}
function yearsText(n) {
  const months = Math.max(0, Math.round(Number(n || 0) * 12));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}年${m}个月` : `${y}年`;
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
}
function showResident() {
  homeView.classList.add('hidden');
  wizardView.classList.add('hidden');
  resultView.classList.add('hidden');
  stickyActions.classList.add('hidden');
  residentView.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function startResident() {
  state.step = 0;
  showResident();
  render();
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'resident_start' } }));
}

function render() {
  if (state.step === 0) renderIdentity();
  if (state.step === 1) renderAccount();
  if (state.step === 2) renderLocal();
}

function shell(title, desc, body, nextLabel = '下一步') {
  residentView.innerHTML = `
    <div class="card resident-card">
      <div class="wizard-head">
        <div class="progress"><span style="width:${((state.step + 1) / 3) * 100}%"></span></div>
        <div class="step-kicker">城乡居民养老 · 第 ${state.step + 1} / 3 步</div>
        <h2>${title}</h2><p class="muted">${desc}</p>
      </div>
      <div class="form-stack">${body}</div>
      <div id="residentError" class="status danger hidden"></div>
      <div class="resident-actions">
        <button class="btn secondary" id="residentBack" type="button">${state.step === 0 ? '返回首页' : '上一步'}</button>
        <button class="btn primary" id="residentNext" type="button">${nextLabel}</button>
      </div>
    </div>`;
  bindFields();
  document.getElementById('residentBack').addEventListener('click', () => {
    if (state.step === 0) location.reload();
    else { state.step -= 1; render(); }
  });
  document.getElementById('residentNext').addEventListener('click', next);
}

function renderIdentity() {
  shell('先看60岁时能不能满足领取条件', '国家统一规则是年满60周岁、累计缴费满15年；特殊历史过渡情形仍以当地经办认定为准。', `
    <div class="field"><label>出生年月</label><input data-rkey="birth" type="month" value="${state.birth}"></div>
    <div class="field"><label>目前累计缴费年限</label><input data-rkey="paidYears" type="number" min="0" step="1" value="${state.paidYears}"><div class="help">城乡居民养老通常按年度缴费；请优先按个人权益记录填写。</div></div>`);
}

function renderAccount() {
  shell('再看个人账户能积累多少', '缴费档次和政府补贴由各地确定。这里用你实际选择的年度缴费额来规划。', `
    <div class="field"><label>当前个人账户余额</label>
      <div class="segment"><button type="button" data-raccount="known" class="${state.knowsAccount ? 'active' : ''}">我知道</button><button type="button" data-raccount="unknown" class="${!state.knowsAccount ? 'active' : ''}">不知道，先估算</button></div>
    </div>
    ${state.knowsAccount ? `<div class="field"><label>个人账户余额（元）</label><input data-rkey="currentAccount" type="number" min="0" step="100" value="${state.currentAccount}"></div>` : ''}
    <div class="field"><label>以后每年准备缴多少（元）</label><input data-rkey="annualContribution" type="number" min="0" step="100" value="${state.annualContribution}"></div>
    <div class="field"><label>当地每年政府缴费补贴（元，不知道可填0）</label><input data-rkey="annualSubsidy" type="number" min="0" step="10" value="${state.annualSubsidy}"></div>
    <div class="field"><label>60岁前还计划缴多少年</label><input data-rkey="futureContributionYears" type="number" min="0" step="1" value="${state.futureContributionYears}"><div class="help">如果到60岁时间不足以缴这么多年，系统会自动按可缴时间截断，并提示缺口。</div></div>`);
  residentView.querySelectorAll('[data-raccount]').forEach(btn => btn.addEventListener('click', () => {
    state.knowsAccount = btn.dataset.raccount === 'known';
    render();
  }));
}

function renderLocal() {
  shell('最后补当地基础养老金', '各地基础养老金、长缴加发差异很大；不知道可以留空，系统仍会算领取资格和个人账户养老金。', `
    <div class="field"><label>当地当前基础养老金标准（元/月，可留空）</label><input data-rkey="localBasicPension" type="number" min="0" step="1" value="${state.localBasicPension}"><div class="help">请以户籍/参保地人社部门最新公布标准为准。2026年国家仍在推进全国最低标准调整，各地落地时间和金额可能不同。</div></div>
    <div class="field"><label>当地长缴/高龄等每月加发（没有或不知道填0）</label><input data-rkey="localMonthlyBonus" type="number" min="0" step="1" value="${state.localMonthlyBonus}"></div>
    <details class="disclosure"><summary>调整个人账户长期记账收益假设</summary><div class="field" style="margin-top:12px"><label>年收益假设</label><input data-rkey="accountInterestPct" type="number" min="0" max="15" step="0.5" value="${state.accountInterest * 100}"><div class="help">默认3%，只是长期规划假设，不是政策保证。</div></div></details>`, '查看结果');
}

function bindFields() {
  residentView.querySelectorAll('[data-rkey]').forEach(el => {
    const sync = () => {
    const key = el.dataset.rkey;
    if (key === 'birth') state.birth = el.value;
    else if (key === 'accountInterestPct') state.accountInterest = Number(el.value) / 100;
    else state[key] = el.value === '' ? '' : Number(el.value);
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  });
}

function validate() {
  try {
    if (state.step === 0) {
      const result = projectResidentPension({ ...state, now: NOW });
      if (result.currentAgeMonths < 0) return '出生年月不能晚于当前月份。';
      if (!(Number(state.paidYears) >= 0)) return '请填写有效的累计缴费年限。';
    }
    if (state.step === 1) {
      if (!(Number(state.annualContribution) >= 0)) return '请填写有效的年度缴费金额。';
      if (!(Number(state.futureContributionYears) >= 0)) return '请填写有效的未来缴费年数。';
      if (state.knowsAccount && !(Number(state.currentAccount) >= 0)) return '请填写有效的个人账户余额。';
    }
  } catch (error) { return error.message || '输入有误，请检查。'; }
  return '';
}

function next() {
  const error = validate();
  if (error) {
    const box = document.getElementById('residentError');
    box.textContent = error; box.classList.remove('hidden'); return;
  }
  if (state.step < 2) { state.step += 1; render(); return; }
  renderResult();
}

function renderResult() {
  const result = projectResidentPension({
    ...state,
    now: NOW,
    currentAccount: state.knowsAccount ? Number(state.currentAccount || 0) : 0,
  });
  const hasTotal = result.pensionLow > 0;
  const mainAmount = hasTotal
    ? `${money(result.pensionLow)} – ${money(result.pensionHigh)} / 月`
    : `${money(result.accountPensionLow)} – ${money(result.accountPensionHigh)} / 月`;
  const mainLabel = hasTotal ? '预计城乡居民养老金' : '预计个人账户养老金部分';
  const shortage = result.shortageYears > 0 ? Math.ceil(result.shortageYears * 10) / 10 : 0;
  const decision = result.eligibleAt60
    ? `按当前计划，到60周岁预计累计缴费 ${yearsText(result.totalContributionYears)}，满足国家15年基本领取条件。`
    : `按当前计划，到60周岁预计累计缴费 ${yearsText(result.totalContributionYears)}，仍少约 ${yearsText(shortage)}。是否可补缴、如何补缴需按参保地具体政策核定。`;

  residentView.innerHTML = `
    <div class="result-hero">
      <div class="soft">${mainLabel}</div><div class="result-money">${mainAmount}</div>
      <div class="soft">60周岁 · 个人账户按 ÷${RESIDENT_ACCOUNT_DIVISOR} 计发</div>
      <div class="result-grid"><div class="result-cell"><div class="k">60岁时间</div><div class="v">${result.claimDate.year}年${result.claimDate.month}月</div></div><div class="result-cell"><div class="k">累计缴费</div><div class="v">${yearsText(result.totalContributionYears)}</div></div><div class="result-cell"><div class="k">最低年限</div><div class="v">${RESIDENT_MIN_CONTRIBUTION_YEARS}年</div></div><div class="result-cell"><div class="k">领取资格</div><div class="v">${result.eligibleAt60 ? '预计满足' : '预计不足'}</div></div></div>
    </div>
    <div class="decision-card ${result.eligibleAt60 ? 'decision-good' : 'decision-danger'}"><strong>${result.eligibleAt60 ? '这个计划基本可行' : '这个计划还需要补齐缴费年限'}</strong><p>${decision}</p></div>
    ${!hasTotal ? `<div class="status warn">你没有填写当地基础养老金标准，所以这里没有伪造“总养老金”。总待遇还需要在上面的个人账户养老金基础上，加当地基础养老金及符合条件的地方加发。</div>` : ''}
    ${result.warnings.length ? `<div class="status warn">${result.warnings.join('<br><br>')}</div>` : ''}
    <div class="card section"><h2>金额怎么来的</h2><div class="policy-box" style="margin-top:12px"><div class="policy-row"><span>当地基础养老金</span><strong>${state.localBasicPension ? `${money(state.localBasicPension)}/月` : '未填写'}</strong></div><div class="policy-row"><span>个人账户养老金</span><strong>${money(result.accountPensionLow)}–${money(result.accountPensionHigh)}/月</strong></div><div class="policy-row"><span>个人账户预计余额</span><strong>${money(result.accountLow)}–${money(result.accountHigh)}</strong></div></div></div>
    <div class="card section" id="resultTrustCard"><div class="trust-head"><span class="verified-badge">国家规则可核验</span><h2>城乡居民养老依据</h2></div><p class="muted">国家统一框架明确：年满60周岁、累计缴费满15年可按月领取；待遇由基础养老金和个人账户养老金组成，个人账户养老金目前按账户储存额÷139。地方基础养老金、缴费补贴和长缴加发以当地最新标准为准。</p><div class="source-list compact"><div class="source-item"><div><strong>国务院关于建立统一的城乡居民基本养老保险制度的意见</strong><span>国家统一制度框架</span></div><a class="official-link" target="_blank" rel="noopener noreferrer" href="${OFFICIAL_RULE}">官方原文 ↗</a></div><div class="source-item"><div><strong>城乡居民基本养老保险待遇确定和基础养老金正常调整机制</strong><span>人社部 / 财政部</span></div><a class="official-link" target="_blank" rel="noopener noreferrer" href="${OFFICIAL_ADJUSTMENT}">官方原文 ↗</a></div><div class="source-item"><div><strong>2026年7月人社部最新进展</strong><span>正在推进全国基础养老金最低标准调整</span></div><a class="official-link" target="_blank" rel="noopener noreferrer" href="${OFFICIAL_2026_UPDATE}">官方动态 ↗</a></div></div></div>
    <div class="section resident-actions"><button class="btn primary" id="residentEdit" type="button">调整方案</button><button class="btn secondary" id="residentRestart" type="button">重新测算</button></div>`;
  save();
  document.getElementById('residentEdit').addEventListener('click', () => { state.step = 1; render(); });
  document.getElementById('residentRestart').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'resident_result', eligible: result.eligibleAt60, has_local_basic: hasTotal } }));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('residentEntry')?.addEventListener('click', startResident);
