import {
  POLICY_VERSION,
  ageText,
  calcStatutoryRetirement,
  claimDateFromAge,
  minimumContributionYears,
  parseMonth,
} from './policy.js';
import { buildScenarios, projectPlan } from './projection.js';

const NOW = { year: 2026, month: 8 };
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

const steps = ['identity', 'status', 'work', 'claim', 'precision'];

function money(n, decimals = 0) {
  if (!Number.isFinite(Number(n))) return '—';
  return `¥${Number(n).toLocaleString('zh-CN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
}
function yearsText(n) {
  const y = Math.floor(n + 1e-8);
  const m = Math.round((n - y) * 12);
  return m ? `${y}年${m}个月` : `${y}年`;
}
function currentAgeYears() {
  const b = parseMonth(state.birth);
  const months = (NOW.year * 12 + NOW.month - 1) - (b.year * 12 + b.month - 1);
  return months / 12;
}
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

function initializeDefaultsForIntent(intent) {
  state.intent = intent;
  state.step = 0;
  const r = retirement();
  const ageNow = currentAgeYears();
  if (intent === 'age') {
    state.stopWorkAge = Math.max(Math.ceil(ageNow), Math.round(r.earliestAgeMonths / 12));
  } else if (intent === 'normal') {
    state.stopWorkAge = r.statutoryAgeMonths / 12;
  } else if (intent === 'flex') {
    state.stopWorkAge = Math.ceil(ageNow);
  } else {
    state.stopWorkAge = Math.max(Math.ceil(ageNow + 1), 50);
  }
  state.claimAgeMonths = r.earliestAgeMonths;
  state.contributionEndAge = Math.min(state.claimAgeMonths / 12, state.stopWorkAge + 5);
}

function start(intent) {
  initializeDefaultsForIntent(intent);
  show('wizard');
  renderStep();
}

function renderStep() {
  const key = steps[state.step];
  stepKicker.textContent = `第 ${state.step + 1} / ${steps.length} 步`;
  progressBar.style.width = `${((state.step + 1) / steps.length) * 100}%`;
  backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = state.step === steps.length - 1 ? '查看结果' : '下一步';
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
  stepBody.innerHTML = `
    <div class="field"><label>出生年月</label><input data-key="birth" type="month" value="${state.birth}"></div>
    <div class="field"><label>你属于哪一类？</label>
      <select data-key="category">
        <option value="base60" ${state.category==='base60'?'selected':''}>原法定退休年龄 60 周岁人员</option>
        <option value="base55" ${state.category==='base55'?'selected':''}>原法定退休年龄 55 周岁女职工</option>
        <option value="base50" ${state.category==='base50'?'selected':''}>原法定退休年龄 50 周岁女职工</option>
      </select>
      <div class="help">如果不确定自己的人员类别，最终退休认定应以参保地人社部门记录为准。</div>
    </div>`;
}

function renderStatus() {
  stepTitle.textContent = '你已经交了多久养老保险？';
  stepDesc.textContent = '不知道个人账户余额也可以继续，系统会降级为区间估算。';
  stepBody.innerHTML = `
    <div class="field"><label>累计缴费年限（年）</label><input data-key="paidYears" type="number" min="0" step="0.5" value="${state.paidYears}"></div>
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
    state.contributionMode = 'claim';
    state.contributionEndAge = state.claimAgeMonths / 12;
  }
  stepTitle.textContent = state.intent === 'normal' ? '按正常工作到退休来测算' : '你打算几岁停止工作？';
  stepDesc.textContent = '停止工作、停止缴社保、开始领养老金是三件不同的事。';
  stepBody.innerHTML = `
    <div class="field"><label>计划停止工作年龄</label><input data-key="stopWorkAge" type="number" min="${Math.floor(ageNow)}" max="75" step="1" value="${state.stopWorkAge}" ${state.intent==='normal'?'disabled':''}></div>
    <div class="field"><label>停止工作后，养老保险准备怎么缴？</label>
      <div class="choice-stack">
        <button type="button" class="choice ${state.contributionMode==='stop'?'active':''}" data-mode="stop"><strong>同时停止缴费</strong><span>适合想看停缴后影响的人</span></button>
        <button type="button" class="choice ${state.contributionMode==='five'?'active':''}" data-mode="five"><strong>再缴几年</strong><span>默认先比较继续缴 5 年</span></button>
        <button type="button" class="choice ${state.contributionMode==='claim'?'active':''}" data-mode="claim"><strong>一直缴到开始领养老金</strong><span>适合正常缴费或灵活就业持续参保</span></button>
      </div>
    </div>
    ${state.contributionMode === 'five' ? `<div class="field"><label>计划缴到几岁</label><input data-key="contributionEndAge" type="number" min="${state.stopWorkAge}" max="75" step="1" value="${state.contributionEndAge}"></div>` : ''}`;
  stepBody.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    state.contributionMode = btn.dataset.mode;
    if (state.contributionMode === 'stop') state.contributionEndAge = Number(state.stopWorkAge);
    if (state.contributionMode === 'five') state.contributionEndAge = Number(state.stopWorkAge) + 5;
    if (state.contributionMode === 'claim') state.contributionEndAge = Number(state.claimAgeMonths) / 12;
    renderStep();
  }));
}

function renderClaim() {
  const r = retirement();
  const earliest = r.earliestAgeMonths;
  const statutory = r.statutoryAgeMonths;
  const latest = r.latestAgeMonths;
  if (state.claimAgeMonths < earliest || state.claimAgeMonths > latest) state.claimAgeMonths = earliest;
  const claimDate = claimDateFromAge(state.birth, state.claimAgeMonths);
  const minYears = minimumContributionYears(claimDate.year);
  stepTitle.textContent = '你准备什么时候开始领养老金？';
  stepDesc.textContent = '系统先把政策允许范围算出来，再让你选择。';
  stepBody.innerHTML = `
    <div class="policy-box">
      <div class="policy-row"><span>最早弹性退休</span><strong>${ageText(earliest)}</strong></div>
      <div class="policy-row"><span>法定退休年龄</span><strong>${ageText(statutory)}</strong></div>
      <div class="policy-row"><span>最晚弹性退休</span><strong>${ageText(latest)}</strong></div>
    </div>
    <div class="field"><label>本次计划领取年龄</label>
      <select data-key="claimAgeMonths">
        ${claimOptions(earliest, latest, state.claimAgeMonths)}
      </select>
      <div class="help">按当前选择，预计 ${claimDate.year}年${claimDate.month}月；该年份最低缴费年限约 ${minYears} 年。</div>
    </div>`;
}
function claimOptions(min, max, selected) {
  const values = [];
  for (let m = min; m <= max; m += 1) values.push(m);
  return values.map(v => `<option value="${v}" ${v===Number(selected)?'selected':''}>${ageText(v)}</option>`).join('');
}

function renderPrecision() {
  stepTitle.textContent = '最后补两项，估算会靠谱很多';
  stepDesc.textContent = '快速模式优先好用；有官方数据时可以切到精确模式。';
  stepBody.innerHTML = `
    <div class="field"><label>测算方式</label><div class="segment">
      <button type="button" data-precision="quick" class="${state.precision==='quick'?'active':''}">快速估算</button>
      <button type="button" data-precision="precise" class="${state.precision==='precise'?'active':''}">精确测算</button>
    </div></div>
    <div class="field"><label>你现在养老保险月缴费基数大约多少？</label><input data-key="monthlyContributionBase" type="number" min="0" step="100" value="${state.monthlyContributionBase}"><div class="help">不是每月交多少钱，而是社保系统里的“缴费基数”。</div></div>
    <div class="field"><label>平均缴费水平</label><select data-key="avgIndex">
      ${[[0.6,'约60%'],[0.8,'约80%'],[1,'约100%'],[1.5,'约150%'],[2,'约200%'],[3,'约300%']].map(([v,t])=>`<option value="${v}" ${Number(state.avgIndex)===v?'selected':''}>${t}</option>`).join('')}
    </select></div>
    ${state.precision==='precise' ? `<div class="field"><label>当地最新养老金计发基数（月，元）</label><input data-key="currentCalcBase" type="number" min="0" step="1" value="${state.currentCalcBase}"><div class="help">请优先填写当地人社部门最新公布值；V2 不再用无来源的城市硬编码值。</div></div>` : ''}
    <details class="disclosure"><summary>调整长期预测假设</summary><div class="form-stack" style="margin-top:12px">
      <div class="field"><label>计发基数/工资长期年增速</label><input data-key="wageGrowthPct" type="number" step="0.5" value="${state.wageGrowth*100}"><div class="help">默认 3%，只是预测假设，不是政策承诺。</div></div>
      <div class="field"><label>个人账户长期记账收益假设</label><input data-key="accountInterestPct" type="number" step="0.5" value="${state.accountInterest*100}"></div>
      <div class="field"><label>长期通胀假设</label><input data-key="inflationPct" type="number" step="0.5" value="${state.inflation*100}"></div>
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
      if (key === 'birth' || key === 'category') {
        const r = retirement();
        state.claimAgeMonths = r.earliestAgeMonths;
      }
      if (key === 'stopWorkAge') {
        if (state.contributionMode === 'stop') state.contributionEndAge = Number(value);
        if (state.contributionMode === 'five') state.contributionEndAge = Number(value) + 5;
      }
      if (key === 'claimAgeMonths' && state.contributionMode === 'claim') state.contributionEndAge = Number(value) / 12;
    });
  });
}

function normalizeBeforeResult() {
  const r = retirement();
  state.claimAgeMonths = Math.max(r.earliestAgeMonths, Math.min(r.latestAgeMonths, Number(state.claimAgeMonths)));
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

function renderResult() {
  normalizeBeforeResult();
  const input = calculationInput();
  const result = projectPlan(input);
  const scenarios = buildScenarios(input);
  const amountText = result.pensionLow > 0
    ? `${money(result.pensionLow)} – ${money(result.pensionHigh)} / 月`
    : '还缺少养老金金额参数';
  const statusClass = result.eligible ? 'good' : 'danger';
  const statusText = result.eligible
    ? `按当前缴费计划，预计累计缴费 ${yearsText(result.totalContributionYears)}，达到领取年份最低要求 ${result.minYears} 年。`
    : `按当前缴费计划预计只有 ${yearsText(result.totalContributionYears)}，低于领取年份最低要求 ${result.minYears} 年，需要延长缴费或调整领取计划。`;

  resultView.innerHTML = `
    <div class="result-hero">
      <div class="soft">按你的当前方案</div>
      <div class="result-money">${amountText}</div>
      <div class="soft">预计养老金 · ${result.confidence}测算</div>
      <div class="result-grid">
        <div class="result-cell"><div class="k">停止工作</div><div class="v">${state.stopWorkAge} 岁</div></div>
        <div class="result-cell"><div class="k">停止缴费</div><div class="v">${state.contributionEndAge} 岁</div></div>
        <div class="result-cell"><div class="k">开始领养老金</div><div class="v">${ageText(state.claimAgeMonths)}</div></div>
        <div class="result-cell"><div class="k">养老空窗期</div><div class="v">${yearsText(result.gapYears)}</div></div>
      </div>
    </div>
    <div class="status ${statusClass}">${statusText}</div>

    <div class="card section">
      <h2>你的退休时间轴</h2>
      <p class="muted">把“停止工作、停止缴费、领取养老金”分开看，计划会清楚很多。</p>
      <div class="timeline">
        ${timelineItem('现在', `${ageText(result.currentAgeMonths)} · 已缴 ${state.paidYears} 年`)}
        ${timelineItem(`${state.stopWorkAge} 岁`, '停止工作')}
        ${timelineItem(`${state.contributionEndAge} 岁`, '停止养老保险缴费')}
        ${timelineItem(ageText(state.claimAgeMonths), `${result.claimDate.year}年${result.claimDate.month}月开始领取养老金`)}
      </div>
    </div>

    <div class="card section">
      <h2>换一种缴法，会差多少？</h2>
      <p class="muted">先比较结果，不替你武断判断哪个方案“一定更划算”。</p>
      <div class="scenarios">
        ${scenarios.map(s => scenarioCard(s)).join('')}
      </div>
    </div>

    <div class="card section">
      <h2>这个结果有多准？</h2>
      <div class="policy-box" style="margin-top:12px">
        <div class="policy-row"><span>退休年龄政策</span><strong>政策精确</strong></div>
        <div class="policy-row"><span>最低缴费年限</span><strong>政策精确</strong></div>
        <div class="policy-row"><span>养老金金额</span><strong>${result.confidence}</strong></div>
      </div>
      ${result.pensionLow > 0 ? `<p class="muted" style="margin-top:12px">按今天购买力折算约 ${money(result.todayPowerLow)} – ${money(result.todayPowerHigh)} / 月。该值使用 ${(state.inflation*100).toFixed(1)}% 长期通胀假设。</p>` : ''}
      <details class="disclosure"><summary>查看本次测算假设</summary>
        <ul class="assumption-list">
          <li>平均缴费指数：${state.avgIndex}</li>
          <li>工资/计发基数长期增速：${(state.wageGrowth*100).toFixed(1)}%</li>
          <li>个人账户长期记账收益假设：${(state.accountInterest*100).toFixed(1)}%</li>
          <li>通胀假设：${(state.inflation*100).toFixed(1)}%</li>
          <li>个人账户计发月数：${result.divisor}（按退休时周岁年龄）</li>
        </ul>
      </details>
      <p class="source-box" style="margin-top:14px">政策版本：${POLICY_VERSION}。依据全国人大常委会关于实施渐进式延迟法定退休年龄的决定及国家养老保险计发规则。地区计发基数、过渡性养老金和地方加发以参保地最新官方口径为准。</p>
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
  return `<div class="scenario"><div class="scenario-top"><strong>${s.title}</strong><span class="scenario-money">${amount}</span></div><div class="scenario-meta"><span>缴到 ${s.contributionEndAge} 岁</span><span>总缴费 ${yearsText(r.totalContributionYears)}</span><span>${r.eligible?'满足最低年限':'不足最低年限'}</span><span>账户约 ${money(r.accountLow)}–${money(r.accountHigh)}</span></div></div>`;
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

document.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.intent)));
backBtn.addEventListener('click', () => { if (state.step > 0) { state.step -= 1; renderStep(); } });
nextBtn.addEventListener('click', () => {
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
    state.step = 2;
    show('wizard');
    renderStep();
  });
}
