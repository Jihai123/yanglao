import {
  POLICY_VERSION,
  PENSION_SCOPE,
  ageText,
  calcStatutoryRetirement,
  claimDateFromAge,
  minimumContributionReferenceYear,
  minimumContributionYears,
  parseMonth,
} from './policy.js';
import { buildScenarios, projectPlan } from './projection.js';

const nowDate = new Date();
const NOW = { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 };
const STORAGE_KEY = 'yanglao-v2-plan';

const state = {
  intent: 'early', step: 0,
  birth: '1983-01', category: 'base60', paidYears: 18,
  knowsAccount: false, currentAccount: '',
  stopWorkAge: 50, contributionMode: 'five', contributionEndAge: 55,
  claimAgeMonths: 60 * 12,
  precision: 'quick', monthlyContributionBase: 7000, avgIndex: 1,
  currentCalcBase: '', wageGrowth: 0.03, accountInterest: 0.03, inflation: 0.02,
  transition: 0, extra: 0,
};

const homeView = document.getElementById('homeView');
const wizardView = document.getElementById('wizardView');
const resultView = document.getElementById('resultView');
const stickyActions = document.getElementById('stickyActions');
const stepBody = document.getElementById('stepBody');
const stepTitle = document.getElementById('stepTitle');
const stepDesc = document.getElementById('stepDesc');
const stepKicker = document.getElementById('stepKicker');
const progressBar = document.getElementById('progressBar');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');

const fullSteps = ['identity', 'status', 'work', 'claim', 'precision'];
function activeSteps() { return state.intent === 'age' ? ['identity'] : fullSteps; }

function money(n, decimals = 0) {
  if (!Number.isFinite(Number(n))) return '—';
  return `¥${Number(n).toLocaleString('zh-CN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
}
function yearsText(n) {
  const totalMonths = Math.max(0, Math.round(Number(n) * 12));
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m ? `${y}年${m}个月` : `${y}年`;
}
function currentAgeMonths() {
  const b = parseMonth(state.birth);
  return (NOW.year * 12 + NOW.month - 1) - (b.year * 12 + b.month - 1);
}
function currentAgeYears() { return currentAgeMonths() / 12; }
function ageYearsText(years) { return ageText(Math.round(Number(years) * 12)); }
function retirement() { return calcStatutoryRetirement(state.birth, state.category); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); }
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
function show(view) {
  homeView.classList.toggle('hidden', view !== 'home');
  wizardView.classList.toggle('hidden', view !== 'wizard');
  resultView.classList.toggle('hidden', view !== 'result');
  stickyActions.classList.toggle('hidden', view !== 'wizard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setPolicyDefaultsAfterIdentity() {
  const r = retirement();
  if (state.intent === 'normal') {
    state.claimAgeMonths = r.statutoryAgeMonths;
    state.stopWorkAge = r.statutoryAgeMonths / 12;
    state.contributionMode = 'claim';
    state.contributionEndAge = r.statutoryAgeMonths / 12;
    return;
  }
  const stopMonths = Math.round(Number(state.stopWorkAge) * 12);
  state.claimAgeMonths = Math.max(r.earliestAgeMonths, Math.min(r.latestAgeMonths, stopMonths));
  if (state.contributionMode === 'claim') state.contributionEndAge = state.claimAgeMonths / 12;
}

function initializeDefaultsForIntent(intent) {
  state.intent = intent;
  state.step = 0;
  const r = retirement();
  const ageNow = currentAgeYears();
  if (intent === 'age') {
    state.stopWorkAge = Math.max(Math.ceil(ageNow), Math.ceil(r.earliestAgeMonths / 12));
    state.claimAgeMonths = r.earliestAgeMonths;
  } else if (intent === 'normal') {
    state.stopWorkAge = r.statutoryAgeMonths / 12;
    state.claimAgeMonths = r.statutoryAgeMonths;
    state.contributionMode = 'claim';
  } else if (intent === 'flex') {
    state.stopWorkAge = Math.ceil(ageNow);
    state.claimAgeMonths = Math.max(r.earliestAgeMonths, Math.min(r.latestAgeMonths, Math.ceil(ageNow) * 12));
    state.contributionMode = 'five';
  } else {
    state.stopWorkAge = Math.max(Math.ceil(ageNow + 1), 50);
    state.claimAgeMonths = Math.max(r.earliestAgeMonths, Math.min(r.latestAgeMonths, state.stopWorkAge * 12));
    state.contributionMode = 'five';
  }
  state.contributionEndAge = state.contributionMode === 'claim'
    ? state.claimAgeMonths / 12
    : Math.min(state.claimAgeMonths / 12, state.stopWorkAge + 5);
}

function start(intent) {
  initializeDefaultsForIntent(intent);
  show('wizard');
  renderStep();
}

function renderStep() {
  const steps = activeSteps();
  if (state.step >= steps.length) state.step = steps.length - 1;
  const key = steps[state.step];
  stepKicker.textContent = `第 ${state.step + 1} / ${steps.length} 步`;
  progressBar.style.width = `${((state.step + 1) / steps.length) * 100}%`;
  backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = state.step === steps.length - 1
    ? (state.intent === 'age' ? '查看退休年龄' : '查看结果')
    : '下一步';
  if (key === 'identity') renderIdentity();
  if (key === 'status') renderStatus();
  if (key === 'work') renderWork();
  if (key === 'claim') renderClaim();
  if (key === 'precision') renderPrecision();
  bindFields();
}

function renderIdentity() {
  stepTitle.textContent = '先确认你的退休规则';
  stepDesc.textContent = '只需要出生年月和对应的原法定退休年龄类别。';
  const flexHelp = state.intent === 'flex'
    ? '灵活就业参保：男性通常按原60周岁、女性通常按原55周岁领取年龄规则；如你的社保记录存在特殊历史身份，请以参保地认定为准。'
    : '如果不确定自己的人员类别，最终退休认定应以参保地人社部门记录为准。';
  stepBody.innerHTML = `
    <div class="field"><label>出生年月</label><input data-key="birth" type="month" value="${state.birth}"></div>
    <div class="field"><label>你属于哪一类？</label>
      <select data-key="category">
        <option value="base60" ${state.category==='base60'?'selected':''}>原法定退休年龄 60 周岁人员</option>
        <option value="base55" ${state.category==='base55'?'selected':''}>原法定退休年龄 55 周岁人员</option>
        <option value="base50" ${state.category==='base50'?'selected':''}>原法定退休年龄 50 周岁女职工</option>
      </select>
      <div class="help">${flexHelp}</div>
    </div>`;
}

function renderStatus() {
  stepTitle.textContent = '你已经交了多久养老保险？';
  stepDesc.textContent = '不知道个人账户余额也可以继续，系统会明确标成长期规划估算。';
  stepBody.innerHTML = `
    <div class="field"><label>累计缴费年限（年）</label><input data-key="paidYears" type="number" min="0" step="0.1" value="${state.paidYears}"><div class="help">如果权益记录显示累计月数，可用“月数 ÷ 12”填写，例如 222 个月填 18.5 年。</div></div>
    <div class="field"><label>个人账户累计储存额</label>
      <div class="segment">
        <button type="button" data-account="known" class="${state.knowsAccount?'active':''}">我知道</button>
        <button type="button" data-account="unknown" class="${!state.knowsAccount?'active':''}">不知道，先估算</button>
      </div>
    </div>
    ${state.knowsAccount ? `<div class="field"><label>个人账户余额（元）</label><input data-key="currentAccount" type="number" min="0" step="100" value="${state.currentAccount}"></div>` : ''}`;
  stepBody.querySelectorAll('[data-account]').forEach(btn => btn.addEventListener('click', () => {
    state.knowsAccount = btn.dataset.account === 'known';
    renderStep();
  }));
}

function renderWork() {
  const ageNow = currentAgeYears();
  const r = retirement();
  if (state.intent === 'normal') {
    state.stopWorkAge = r.statutoryAgeMonths / 12;
    state.claimAgeMonths = r.statutoryAgeMonths;
    state.contributionMode = 'claim';
    state.contributionEndAge = r.statutoryAgeMonths / 12;
  }
  const minStopAge = Math.ceil(ageNow);
  const maxStopAge = Math.floor(r.latestAgeMonths / 12);
  stepTitle.textContent = state.intent === 'normal' ? '按正常工作到法定退休来测算' : '你打算几岁停止工作？';
  stepDesc.textContent = '停止工作、停止缴社保、开始领养老金是三件不同的事。';
  stepBody.innerHTML = `
    <div class="field"><label>计划停止工作年龄</label>${state.intent==='normal' ? `<div class="policy-box"><div class="policy-row"><span>按法定退休年龄</span><strong>${ageText(r.statutoryAgeMonths)}</strong></div></div>` : `<input data-key="stopWorkAge" type="number" min="${minStopAge}" max="${maxStopAge}" step="1" value="${state.stopWorkAge}">`}</div>
    <div class="field"><label>停止工作后，养老保险准备怎么缴？</label>
      <div class="choice-stack">
        <button type="button" class="choice ${state.contributionMode==='stop'?'active':''}" data-mode="stop" ${state.intent==='normal'?'disabled':''}><strong>同时停止缴费</strong><span>适合想看停缴后影响的人</span></button>
        <button type="button" class="choice ${state.contributionMode==='five'?'active':''}" data-mode="five" ${state.intent==='normal'?'disabled':''}><strong>再缴几年</strong><span>默认先比较继续缴 5 年</span></button>
        <button type="button" class="choice ${state.contributionMode==='claim'?'active':''}" data-mode="claim"><strong>一直缴到开始领养老金</strong><span>适合正常缴费或灵活就业持续参保</span></button>
      </div>
    </div>
    ${state.contributionMode === 'five' ? `<div class="field"><label>计划缴到几岁</label><input data-key="contributionEndAge" type="number" min="${state.stopWorkAge}" max="${Math.floor(state.claimAgeMonths/12)}" step="1" value="${state.contributionEndAge}"></div>` : ''}`;
  stepBody.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.disabled) return;
    state.contributionMode = btn.dataset.mode;
    if (state.contributionMode === 'stop') state.contributionEndAge = Number(state.stopWorkAge);
    if (state.contributionMode === 'five') state.contributionEndAge = Math.min(Number(state.claimAgeMonths) / 12, Number(state.stopWorkAge) + 5);
    if (state.contributionMode === 'claim') state.contributionEndAge = Number(state.claimAgeMonths) / 12;
    renderStep();
  }));
}

function renderClaim() {
  const r = retirement();
  const earliest = r.earliestAgeMonths;
  const statutory = r.statutoryAgeMonths;
  const latest = r.latestAgeMonths;
  const minByWork = Math.round(Number(state.stopWorkAge) * 12);
  const selectableEarliest = Math.max(earliest, minByWork);
  if (state.claimAgeMonths < selectableEarliest || state.claimAgeMonths > latest) {
    state.claimAgeMonths = state.intent === 'normal' ? statutory : selectableEarliest;
  }
  const claimDate = claimDateFromAge(state.birth, state.claimAgeMonths);
  const minRefYear = minimumContributionReferenceYear(state.birth, state.category, state.claimAgeMonths);
  const minYears = minimumContributionYears(minRefYear);
  const delayed = state.claimAgeMonths > statutory;
  stepTitle.textContent = '你准备什么时候开始领养老金？';
  stepDesc.textContent = '系统先把政策允许范围算出来，再让你选择。';
  stepBody.innerHTML = `
    <div class="policy-box">
      <div class="policy-row"><span>最早弹性退休</span><strong>${ageText(earliest)}</strong></div>
      <div class="policy-row"><span>法定退休年龄</span><strong>${ageText(statutory)}</strong></div>
      <div class="policy-row"><span>最晚弹性退休</span><strong>${ageText(latest)}</strong></div>
    </div>
    <div class="field"><label>本次计划领取年龄</label>
      <select data-key="claimAgeMonths" ${state.intent==='normal'?'disabled':''}>
        ${claimOptions(selectableEarliest, latest, state.claimAgeMonths)}
      </select>
      <div class="help">预计 ${claimDate.year}年${claimDate.month}月；最低缴费年限 ${minYears} 年${delayed ? `（弹性延迟按法定退休年份 ${minRefYear} 年确定）` : ''}。</div>
    </div>`;
}
function claimOptions(min, max, selected) {
  const values = [];
  for (let m = min; m <= max; m += 1) values.push(m);
  return values.map(v => `<option value="${v}" ${v===Number(selected)?'selected':''}>${ageText(v)}</option>`).join('');
}

function renderPrecision() {
  stepTitle.textContent = '最后补两项，估算会靠谱很多';
  stepDesc.textContent = '快速模式优先好用；有官方数据时可以切到精确测算输入。';
  stepBody.innerHTML = `
    <div class="field"><label>测算方式</label><div class="segment">
      <button type="button" data-precision="quick" class="${state.precision==='quick'?'active':''}">快速估算</button>
      <button type="button" data-precision="precise" class="${state.precision==='precise'?'active':''}">精确输入</button>
    </div></div>
    <div class="field"><label>你现在养老保险月缴费基数大约多少？</label><input data-key="monthlyContributionBase" type="number" min="0" step="100" value="${state.monthlyContributionBase}"><div class="help">不是每月交多少钱，而是社保系统里的“缴费基数”。</div></div>
    <div class="field"><label>历年平均缴费水平</label><select data-key="avgIndex">
      ${[[0.6,'约60%'],[0.8,'约80%'],[1,'约100%'],[1.5,'约150%'],[2,'约200%'],[3,'约300%']].map(([v,t])=>`<option value="${v}" ${Number(state.avgIndex)===v?'selected':''}>${t}</option>`).join('')}
    </select><div class="help">这里指职业生涯历年平均缴费工资指数的近似水平，不是只看今年。</div></div>
    ${state.precision==='precise' ? `<div class="field"><label>当地最新养老金计发基数（月，元）</label><input data-key="currentCalcBase" type="number" min="0" step="1" value="${state.currentCalcBase}"><div class="help">请优先填写参保地人社部门最新公布值；V2 不再用无来源的城市硬编码值。</div></div>` : ''}
    <details class="disclosure"><summary>调整长期预测假设</summary><div class="form-stack" style="margin-top:12px">
      <div class="field"><label>计发基数/工资长期年增速</label><input data-key="wageGrowthPct" type="number" min="-2" max="15" step="0.5" value="${state.wageGrowth*100}"><div class="help">默认 3%，只是规划假设；结果区间会自动做上下敏感性测试。</div></div>
      <div class="field"><label>个人账户长期记账收益假设</label><input data-key="accountInterestPct" type="number" min="0" max="15" step="0.5" value="${state.accountInterest*100}"></div>
      <div class="field"><label>长期通胀假设</label><input data-key="inflationPct" type="number" min="0" max="15" step="0.5" value="${state.inflation*100}"></div>
    </div></details>`;
  stepBody.querySelectorAll('[data-precision]').forEach(btn => btn.addEventListener('click', () => {
    state.precision = btn.dataset.precision;
    renderStep();
  }));
}

function bindFields() {
  stepBody.querySelectorAll('[data-key]').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.dataset.key;
      let value = el.value;
      if (['paidYears','stopWorkAge','contributionEndAge','claimAgeMonths','monthlyContributionBase','avgIndex','currentCalcBase'].includes(key)) value = Number(value);
      if (key === 'wageGrowthPct') { state.wageGrowth = Number(value) / 100; return; }
      if (key === 'accountInterestPct') { state.accountInterest = Number(value) / 100; return; }
      if (key === 'inflationPct') { state.inflation = Number(value) / 100; return; }
      state[key] = value;
      if (key === 'birth' || key === 'category') setPolicyDefaultsAfterIdentity();
      if (key === 'stopWorkAge') {
        const r = retirement();
        const stopMonths = Number(value) * 12;
        state.claimAgeMonths = Math.max(r.earliestAgeMonths, Math.min(r.latestAgeMonths, Math.max(state.claimAgeMonths, stopMonths)));
        if (state.contributionMode === 'stop') state.contributionEndAge = Number(value);
        if (state.contributionMode === 'five') state.contributionEndAge = Math.min(state.claimAgeMonths / 12, Number(value) + 5);
      }
      if (key === 'claimAgeMonths' && state.contributionMode === 'claim') state.contributionEndAge = Number(value) / 12;
    });
  });
}

function showStepError(message) {
  const old = document.getElementById('stepError');
  if (old) old.remove();
  if (!message) return;
  const box = document.createElement('div');
  box.id = 'stepError';
  box.className = 'status danger';
  box.textContent = message;
  stepBody.appendChild(box);
}

function validateCurrentStep() {
  const key = activeSteps()[state.step];
  try {
    if (key === 'identity') {
      parseMonth(state.birth);
      const ageMonths = currentAgeMonths();
      if (ageMonths < 0) return '出生年月不能晚于当前月份。';
      calcStatutoryRetirement(state.birth, state.category);
    }
    if (key === 'status') {
      const years = Number(state.paidYears);
      if (!Number.isFinite(years) || years < 0) return '请填写有效的累计缴费年限。';
      if (years > currentAgeYears() + 1e-8) return '累计缴费年限不能超过你当前的实际年龄，请检查输入。';
      if (state.knowsAccount && !(Number(state.currentAccount) >= 0)) return '请填写有效的个人账户余额。';
    }
    if (key === 'work') {
      const r = retirement();
      const stop = Number(state.stopWorkAge);
      if (!Number.isFinite(stop) || stop < Math.ceil(currentAgeYears())) return '计划停止工作年龄不能早于当前年龄。';
      if (stop * 12 > r.latestAgeMonths) return `当前规划工具支持的停止工作年龄不能晚于最晚弹性退休年龄 ${ageText(r.latestAgeMonths)}。`;
      if (state.contributionMode === 'five') {
        const end = Number(state.contributionEndAge);
        if (!Number.isFinite(end) || end < stop || end * 12 > state.claimAgeMonths) return '停止缴费年龄应介于停止工作年龄和领取养老金年龄之间。';
      }
    }
    if (key === 'claim') {
      const r = retirement();
      const claim = Number(state.claimAgeMonths);
      if (claim < r.earliestAgeMonths || claim > r.latestAgeMonths) return '领取年龄超出当前政策允许的弹性范围。';
      if (claim < Number(state.stopWorkAge) * 12) return '当前版本按“先停止工作、后领取养老金”规划，请把领取年龄设在停止工作年龄之后。';
    }
    if (key === 'precision') {
      if (!(Number(state.monthlyContributionBase) > 0)) return '请填写当前养老保险月缴费基数；不知道时可先从社保缴费记录中查询。';
      if (state.precision === 'precise' && !(Number(state.currentCalcBase) > 0)) return '精确输入模式需要填写当地最新养老金计发基数。';
    }
  } catch (error) {
    return error.message || '输入信息有误，请检查后再继续。';
  }
  return '';
}

function normalizeBeforeResult() {
  const r = retirement();
  const minStop = Math.ceil(currentAgeYears());
  const maxStop = Math.floor(r.latestAgeMonths / 12);
  state.stopWorkAge = Math.max(minStop, Math.min(maxStop, Number(state.stopWorkAge)));
  const minClaimByWork = Number(state.stopWorkAge) * 12;
  state.claimAgeMonths = Math.max(r.earliestAgeMonths, minClaimByWork, Math.min(r.latestAgeMonths, Number(state.claimAgeMonths)));
  if (state.intent === 'normal') state.claimAgeMonths = r.statutoryAgeMonths;
  if (state.contributionMode === 'stop') state.contributionEndAge = Number(state.stopWorkAge);
  if (state.contributionMode === 'claim') state.contributionEndAge = Number(state.claimAgeMonths) / 12;
  state.contributionEndAge = Math.max(Number(state.stopWorkAge), Math.min(Number(state.contributionEndAge), Number(state.claimAgeMonths) / 12));
}

function calculationInput() {
  return {
    ...state, now: NOW,
    currentAccount: state.knowsAccount ? Number(state.currentAccount || 0) : 0,
    currentCalcBase: state.precision === 'precise' ? Number(state.currentCalcBase || 0) : 0,
  };
}

function renderAgeResult() {
  const r = retirement();
  const earliestDate = claimDateFromAge(state.birth, r.earliestAgeMonths);
  const statutoryDate = claimDateFromAge(state.birth, r.statutoryAgeMonths);
  const latestDate = claimDateFromAge(state.birth, r.latestAgeMonths);
  resultView.innerHTML = `
    <div class="result-hero">
      <div class="soft">你的法定退休年龄</div>
      <div class="result-money">${ageText(r.statutoryAgeMonths)}</div>
      <div class="soft">预计 ${statutoryDate.year}年${statutoryDate.month}月</div>
    </div>
    <div class="card section">
      <h2>弹性退休范围</h2>
      <div class="policy-box" style="margin-top:12px">
        <div class="policy-row"><span>最早可选</span><strong>${ageText(r.earliestAgeMonths)} · ${earliestDate.year}年${earliestDate.month}月</strong></div>
        <div class="policy-row"><span>法定退休</span><strong>${ageText(r.statutoryAgeMonths)} · ${statutoryDate.year}年${statutoryDate.month}月</strong></div>
        <div class="policy-row"><span>最晚可选</span><strong>${ageText(r.latestAgeMonths)} · ${latestDate.year}年${latestDate.month}月</strong></div>
      </div>
      <p class="source-box" style="margin-top:14px">弹性提前退休还需要达到对应最低缴费年限；弹性延迟退休对单位职工通常需要与单位协商一致。最终退休认定以参保地经办机构为准。</p>
    </div>
    <div class="section" style="display:grid;gap:10px">
      <button type="button" class="btn primary" id="continuePlanBtn">继续算养老金</button>
      <button type="button" class="btn secondary" id="newPlanBtn">重新查询</button>
    </div>`;
  save();
  document.getElementById('continuePlanBtn').addEventListener('click', () => {
    state.intent = 'normal';
    setPolicyDefaultsAfterIdentity();
    state.step = 1;
    show('wizard');
    renderStep();
  });
  document.getElementById('newPlanBtn').addEventListener('click', resetAll);
  show('result');
}

function renderResult() {
  if (state.intent === 'age') {
    renderAgeResult();
    return;
  }
  normalizeBeforeResult();
  const input = calculationInput();
  const result = projectPlan(input);
  const scenarios = buildScenarios(input);
  const amountText = result.pensionLow > 0
    ? `${money(result.pensionLow)} – ${money(result.pensionHigh)} / 月`
    : '还缺少养老金金额参数';
  const statusClass = result.eligible ? 'good' : 'danger';
  const refYearText = result.claimAgeMonths > result.retirement.statutoryAgeMonths
    ? `（弹性延迟按法定退休年份 ${result.minYearsReferenceYear} 年确定）`
    : '';
  const statusText = result.eligible
    ? `按当前缴费计划，预计累计缴费 ${yearsText(result.totalContributionYears)}，达到最低要求 ${result.minYears} 年${refYearText}。`
    : `按当前缴费计划预计只有 ${yearsText(result.totalContributionYears)}，低于最低要求 ${result.minYears} 年${refYearText}，需要延长缴费或调整领取计划。`;
  const divisorText = result.divisorExact
    ? `${result.divisor}`
    : `${result.divisorMax} ～ ${result.divisorMin}（非整岁相邻档边界）`;

  resultView.innerHTML = `
    <div class="result-hero">
      <div class="soft">按你的当前方案</div>
      <div class="result-money">${amountText}</div>
      <div class="soft">预计养老金 · ${result.confidence}</div>
      <div class="result-grid">
        <div class="result-cell"><div class="k">停止工作</div><div class="v">${ageYearsText(state.stopWorkAge)}</div></div>
        <div class="result-cell"><div class="k">停止缴费</div><div class="v">${ageYearsText(state.contributionEndAge)}</div></div>
        <div class="result-cell"><div class="k">开始领养老金</div><div class="v">${ageText(state.claimAgeMonths)}</div></div>
        <div class="result-cell"><div class="k">养老空窗期</div><div class="v">${yearsText(result.gapYears)}</div></div>
      </div>
    </div>
    <div class="status ${statusClass}">${statusText}</div>
    ${result.warnings.length ? `<div class="status warn">${result.warnings.join('<br><br>')}</div>` : ''}

    <div class="card section">
      <h2>你的退休时间轴</h2>
      <p class="muted">把“停止工作、停止缴费、领取养老金”分开看，计划会清楚很多。</p>
      <div class="timeline">
        ${timelineItem('现在', `${ageText(result.currentAgeMonths)} · 已缴 ${yearsText(state.paidYears)}`)}
        ${timelineItem(ageYearsText(state.stopWorkAge), '停止工作')}
        ${timelineItem(ageYearsText(state.contributionEndAge), '停止养老保险缴费')}
        ${timelineItem(ageText(state.claimAgeMonths), `${result.claimDate.year}年${result.claimDate.month}月办理退休，审核通过后按规定领取`)}
      </div>
    </div>

    <div class="card section">
      <h2>换一种缴法，会差多少？</h2>
      <p class="muted">保持其他假设一致，只改变停止缴费时间，方便看“多缴几年”的影响。</p>
      <div class="scenarios">
        ${scenarios.map(s => scenarioCard(s)).join('')}
      </div>
    </div>

    <div class="card section">
      <h2>这个结果有多准？</h2>
      <div class="policy-box" style="margin-top:12px">
        <div class="policy-row"><span>法定/弹性退休年龄</span><strong>按国家现行规则</strong></div>
        <div class="policy-row"><span>最低缴费年限</span><strong>按国家现行规则</strong></div>
        <div class="policy-row"><span>养老金金额</span><strong>${result.confidence}</strong></div>
      </div>
      ${result.pensionLow > 0 ? `<p class="muted" style="margin-top:12px">按今天购买力折算约 ${money(result.todayPowerLow)} – ${money(result.todayPowerHigh)} / 月。该值使用 ${(state.inflation*100).toFixed(1)}% 长期通胀假设。</p>` : ''}
      <details class="disclosure"><summary>查看本次测算假设</summary>
        <ul class="assumption-list">
          <li>适用范围：${PENSION_SCOPE}</li>
          <li>历年平均缴费指数近似：${state.avgIndex}</li>
          <li>工资/计发基数长期增速基准：${(state.wageGrowth*100).toFixed(1)}%，并做 ±1 个百分点敏感性测试</li>
          <li>个人账户长期记账收益基准：${(state.accountInterest*100).toFixed(1)}%，并做小幅敏感性测试</li>
          <li>通胀假设：${(state.inflation*100).toFixed(1)}%</li>
          <li>个人账户计发月数：${divisorText}</li>
        </ul>
      </details>
      <p class="source-box" style="margin-top:14px">政策版本：${POLICY_VERSION}。退休年龄和最低缴费年限依据国家现行渐进式延迟退休及弹性退休制度；企业职工养老金公式依据现行企业职工基本养老保险计发办法。地区计发基数、过渡性养老金、特殊工种/病残等专项政策，以参保地最新官方口径为准。</p>
    </div>
    <div class="section" style="display:grid;gap:10px">
      <button type="button" class="btn primary" id="editPlanBtn">调整我的方案</button>
      <button type="button" class="btn secondary" id="newPlanBtn">重新规划</button>
    </div>`;
  save();
  document.getElementById('editPlanBtn').addEventListener('click', () => { state.step = 2; show('wizard'); renderStep(); });
  document.getElementById('newPlanBtn').addEventListener('click', resetAll);
  show('result');
}
function timelineItem(title, sub) {
  return `<div class="tl-item"><div class="dot-wrap"><span class="dot"></span></div><div class="tl-content"><strong>${title}</strong><span>${sub}</span></div></div>`;
}
function scenarioCard(s) {
  const r = s.result;
  const amount = r.pensionLow > 0 ? `${money(r.pensionLow)}–${money(r.pensionHigh)}` : '—';
  return `<div class="scenario"><div class="scenario-top"><strong>${s.title}</strong><span class="scenario-money">${amount}</span></div><div class="scenario-meta"><span>缴到 ${ageYearsText(s.contributionEndAge)}</span><span>总缴费 ${yearsText(r.totalContributionYears)}</span><span>${r.eligible?'满足最低年限':'不足最低年限'}</span><span>账户约 ${money(r.accountLow)}–${money(r.accountHigh)}</span></div></div>`;
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

document.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.intent)));
backBtn.addEventListener('click', () => { if (state.step > 0) { state.step -= 1; renderStep(); } });
nextBtn.addEventListener('click', () => {
  const error = validateCurrentStep();
  if (error) { showStepError(error); return; }
  showStepError('');
  const steps = activeSteps();
  if (state.step < steps.length - 1) { state.step += 1; renderStep(); }
  else renderResult();
});
document.getElementById('restartBtn').addEventListener('click', resetAll);

const saved = loadSaved();
if (saved) {
  document.getElementById('resumeBox').classList.remove('hidden');
  document.getElementById('resumeText').textContent = `上次计划：${saved.stopWorkAge} 岁停止工作，${ageText(saved.claimAgeMonths)}开始领养老金。`;
  document.getElementById('resumeBtn').addEventListener('click', () => {
    Object.assign(state, saved);
    state.step = state.intent === 'age' ? 0 : 2;
    show('wizard');
    renderStep();
  });
}
