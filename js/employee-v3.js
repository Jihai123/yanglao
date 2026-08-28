import {
  POLICY_VERSION,
  PENSION_SCOPE,
  ageText,
  calcStatutoryRetirement,
  claimDateFromAge,
  parseMonth,
} from './policy.js?v=20260828-p14';
import { projectPlanV3 } from './projection-v3.js?v=20260828-p14';

const STORAGE_KEY = 'yanglao-v3-plan';
const nowDate = new Date();
const NOW = { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 };

const state = {
  intent: 'early', step: 0,
  birth: '1983-01', sex: 'male', femaleCategory: 'worker50',
  paidYears: 18, paidMonthsExtra: 0,
  knowsAccount: false, currentAccount: '',
  stopWorkAge: 50,
  retirementMode: 'statutory', retirementOffsetMonths: 12,
  contributionPlan: 'continuous_to_claim',
  actualFutureYears: 5, actualFutureMonthsExtra: 0,
  afterStopContributionMode: 'flex', flexMonthlyContributionBase: 4000,
  amountMode: 'estimate', monthlyContributionBase: 7000,
  historyPattern: 'unknown', avgIndex: 1, currentCalcBase: '',
  wageGrowth: 0.03, accountInterest: 0.03, inflation: 0.02,
  transition: 0, extra: 0,
};

const homeView = document.getElementById('homeView');
const wizardView = document.getElementById('wizardView');
const resultView = document.getElementById('resultView');
const residentView = document.getElementById('residentView');
const stickyActions = document.getElementById('stickyActions');
const stepBody = document.getElementById('stepBody');
const stepTitle = document.getElementById('stepTitle');
const stepDesc = document.getElementById('stepDesc');
const stepKicker = document.getElementById('stepKicker');
const progressBar = document.getElementById('progressBar');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');

function activeSteps() {
  if (state.intent === 'age') return ['identity'];
  if (state.intent === 'normal') return ['identity', 'status', 'amount'];
  return ['identity', 'status', 'plan', 'amount'];
}
function money(n) { return Number.isFinite(Number(n)) ? `¥${Math.round(Number(n)).toLocaleString('zh-CN')}` : '—'; }
function monthsText(months) {
  const total = Math.max(0, Math.round(Number(months) || 0));
  const y = Math.floor(total / 12), m = total % 12;
  if (y && m) return `${y}年${m}个月`;
  if (y) return `${y}年`;
  return `${m}个月`;
}
function currentAgeMonths() {
  const b = parseMonth(state.birth);
  return (NOW.year * 12 + NOW.month - 1) - (b.year * 12 + b.month - 1);
}
function paidMonths() { return Math.max(0, Math.round(Number(state.paidYears || 0) * 12 + Number(state.paidMonthsExtra || 0))); }
function mapCategory() {
  if (state.sex === 'male') return 'base60';
  if (state.femaleCategory === 'worker50') return 'base50';
  if (state.femaleCategory === 'manager55') return 'base55';
  return null;
}
function retirement(category = mapCategory()) { return category ? calcStatutoryRetirement(state.birth, category) : null; }
function claimAgeMonths(category = mapCategory()) {
  const r = retirement(category);
  if (!r) return null;
  if (state.intent === 'normal' || state.retirementMode === 'statutory') return r.statutoryAgeMonths;
  const offset = Math.max(12, Math.min(36, Math.round(Number(state.retirementOffsetMonths || 12))));
  if (state.retirementMode === 'early') return Math.max(r.earliestAgeMonths, r.statutoryAgeMonths - offset);
  if (state.retirementMode === 'delayed') return Math.min(r.latestAgeMonths, r.statutoryAgeMonths + offset);
  return r.statutoryAgeMonths;
}
function stopWorkAgeMonths(category = mapCategory()) {
  const r = retirement(category);
  if (state.intent === 'normal' && r) return r.statutoryAgeMonths;
  return Math.round(Number(state.stopWorkAge || 0) * 12);
}
function actualAfterStopMonths() {
  return Math.max(0, Math.round(Number(state.actualFutureYears || 0) * 12 + Number(state.actualFutureMonthsExtra || 0)));
}
function afterStopBase() {
  return state.afterStopContributionMode === 'flex'
    ? Math.max(0, Number(state.flexMonthlyContributionBase || 0))
    : Math.max(0, Number(state.monthlyContributionBase || 0));
}
function futureContributionSegments(category = mapCategory()) {
  const claim = claimAgeMonths(category);
  if (!claim) return [];
  const current = currentAgeMonths();
  const stop = Math.max(current, Math.min(claim, stopWorkAgeMonths(category)));
  const currentBase = Math.max(0, Number(state.monthlyContributionBase || 0));
  const beforeStop = Math.max(0, stop - current);
  const afterWindow = Math.max(0, claim - stop);

  if (state.intent === 'normal') {
    return [{ months: Math.max(0, claim - current), monthlyContributionBase: currentBase, startOffsetMonths: 0, label: '单位/当前缴费' }];
  }
  if (state.contributionPlan === 'stop_with_work') {
    return beforeStop ? [{ months: beforeStop, monthlyContributionBase: currentBase, startOffsetMonths: 0, label: '停止工作前' }] : [];
  }
  if (state.contributionPlan === 'actual_months') {
    const afterMonths = Math.min(actualAfterStopMonths(), afterWindow);
    const segments = [];
    if (beforeStop) segments.push({ months: beforeStop, monthlyContributionBase: currentBase, startOffsetMonths: 0, label: '停止工作前' });
    if (afterMonths) segments.push({ months: afterMonths, monthlyContributionBase: afterStopBase(), startOffsetMonths: beforeStop, spread: true, label: state.afterStopContributionMode === 'flex' ? '灵活就业' : '停止工作后继续缴' });
    return segments;
  }

  const segments = [];
  if (beforeStop) segments.push({ months: beforeStop, monthlyContributionBase: currentBase, startOffsetMonths: 0, label: '停止工作前' });
  if (afterWindow) segments.push({ months: afterWindow, monthlyContributionBase: afterStopBase(), startOffsetMonths: beforeStop, label: state.afterStopContributionMode === 'flex' ? '灵活就业' : '停止工作后继续缴' });
  return segments;
}
function futureContributionMonths(category = mapCategory()) {
  return futureContributionSegments(category).reduce((sum, item) => sum + item.months, 0);
}
function avgIndexInfo() {
  if (state.historyPattern === 'low') return { value: 0.6, confidence: 'rough' };
  if (state.historyPattern === 'average') return { value: 1, confidence: 'rough' };
  if (state.historyPattern === 'high') return { value: 1.5, confidence: 'rough' };
  if (state.historyPattern === 'exact') return { value: Math.max(0.01, Number(state.avgIndex || 1)), confidence: 'exact' };
  return { value: 1, confidence: 'unknown' };
}
function calculationInput(category = mapCategory()) {
  const index = avgIndexInfo();
  const segments = futureContributionSegments(category);
  return {
    ...state, category, now: NOW,
    paidMonths: paidMonths(), claimAgeMonths: claimAgeMonths(category),
    futureContributionMonths: futureContributionMonths(category), futureContributionSegments: segments,
    contributionSchedule: state.contributionPlan === 'actual_months' ? 'spread' : 'frontload',
    avgIndex: index.value, avgIndexConfidence: index.confidence,
    accountKnown: state.knowsAccount, currentAccount: state.knowsAccount ? Number(state.currentAccount || 0) : 0,
    currentCalcBase: Number(state.currentCalcBase || 0),
  };
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); }
function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function show(view) {
  homeView?.classList.toggle('hidden', view !== 'home');
  wizardView?.classList.toggle('hidden', view !== 'wizard');
  resultView?.classList.toggle('hidden', view !== 'result');
  residentView?.classList.toggle('hidden', view !== 'resident');
  stickyActions?.classList.toggle('hidden', view !== 'wizard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function initializeIntent(intent) {
  state.intent = intent; state.step = 0; state.retirementMode = 'statutory'; state.retirementOffsetMonths = 12;
  const ageNow = Math.max(0, currentAgeMonths() / 12);
  if (intent === 'normal') state.contributionPlan = 'continuous_to_claim';
  if (intent === 'early') {
    state.stopWorkAge = Math.max(Math.ceil(ageNow + 1), Math.min(50, Math.ceil(ageNow + 5)));
    state.contributionPlan = 'actual_months'; state.afterStopContributionMode = 'flex';
  }
  if (intent === 'flex') {
    state.stopWorkAge = Math.ceil(ageNow); state.contributionPlan = 'actual_months'; state.afterStopContributionMode = 'flex';
  }
}
function start(intent) { initializeIntent(intent); show('wizard'); renderStep(); }

function renderStep() {
  const steps = activeSteps();
  if (state.step >= steps.length) state.step = steps.length - 1;
  const key = steps[state.step];
  stepBody.dataset.step = key;
  stepKicker.textContent = `第 ${state.step + 1} / ${steps.length} 步`;
  progressBar.style.width = `${((state.step + 1) / steps.length) * 100}%`;
  backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = state.step === steps.length - 1 ? (state.intent === 'age' ? '查看退休年龄' : '查看结果') : '下一步';
  if (key === 'identity') renderIdentity();
  if (key === 'status') renderStatus();
  if (key === 'plan') renderPlan();
  if (key === 'amount') renderAmount();
  bindBasicFields();
}

function renderIdentity() {
  stepTitle.textContent = '先确认基本信息';
  stepDesc.textContent = '用来计算你的法定退休时间。';
  stepBody.innerHTML = `
    <div class="field"><label>出生年月</label><input class="mobile-safe-input" data-key="birth" type="month" value="${state.birth}"></div>
    <div class="field"><label>性别</label><div class="segment"><button type="button" data-sex="male" class="${state.sex === 'male' ? 'active' : ''}">男</button><button type="button" data-sex="female" class="${state.sex === 'female' ? 'active' : ''}">女</button></div></div>
    ${state.sex === 'female' ? `<div class="field"><label>退休前主要属于哪种情况？</label><div class="choice-stack compact-choices">
      <button type="button" class="choice ${state.femaleCategory === 'worker50' ? 'active' : ''}" data-female-category="worker50"><strong>普通女职工</strong><span>通常对应原50周岁口径</span></button>
      <button type="button" class="choice ${state.femaleCategory === 'manager55' ? 'active' : ''}" data-female-category="manager55"><strong>管理 / 技术等岗位</strong><span>通常对应原55周岁口径</span></button>
      <button type="button" class="choice ${state.femaleCategory === 'unsure' ? 'active' : ''}" data-female-category="unsure"><strong>不确定</strong><span>先看两种可能</span></button>
    </div></div>` : ''}`;
  stepBody.querySelectorAll('[data-sex]').forEach(btn => btn.addEventListener('click', () => { state.sex = btn.dataset.sex; renderStep(); }));
  stepBody.querySelectorAll('[data-female-category]').forEach(btn => btn.addEventListener('click', () => { state.femaleCategory = btn.dataset.femaleCategory; renderStep(); }));
}

function renderStatus() {
  stepTitle.textContent = '已经实际缴了多久？';
  stepDesc.textContent = '按社保权益记录里的累计缴费时间填写。';
  stepBody.innerHTML = `
    <div class="field"><label>累计缴费</label><div class="number-pair"><div><input data-key="paidYears" type="number" min="0" step="1" value="${state.paidYears}"><span>年</span></div><div><input data-key="paidMonthsExtra" type="number" min="0" max="11" step="1" value="${state.paidMonthsExtra}"><span>个月</span></div></div></div>
    <div class="field"><label>个人账户余额</label><div class="segment"><button type="button" data-account="known" class="${state.knowsAccount ? 'active' : ''}">我知道</button><button type="button" data-account="unknown" class="${!state.knowsAccount ? 'active' : ''}">不知道</button></div></div>
    ${state.knowsAccount ? `<div class="field"><label>个人账户余额（元）</label><input data-key="currentAccount" type="number" min="0" step="100" value="${state.currentAccount}"></div>` : ''}`;
  stepBody.querySelectorAll('[data-account]').forEach(btn => btn.addEventListener('click', () => { state.knowsAccount = btn.dataset.account === 'known'; renderStep(); }));
}

function retirementModeChoices(r) {
  return `<div class="choice-stack">
    <button type="button" class="choice ${state.retirementMode === 'statutory' ? 'active' : ''}" data-retirement-mode="statutory"><strong>按法定退休年龄</strong><span>${ageText(r.statutoryAgeMonths)}</span></button>
    <button type="button" class="choice ${state.retirementMode === 'early' ? 'active' : ''}" data-retirement-mode="early"><strong>考虑提前退休</strong><span>最早 ${ageText(r.earliestAgeMonths)}</span></button>
    <button type="button" class="choice ${state.retirementMode === 'delayed' ? 'active' : ''}" data-retirement-mode="delayed"><strong>考虑延迟退休</strong><span>最晚 ${ageText(r.latestAgeMonths)}</span></button>
  </div>`;
}
function renderPlan() {
  const r = retirement(), claim = claimAgeMonths();
  stepTitle.textContent = state.intent === 'flex' ? '以后准备怎么缴？' : '停止工作后，社保怎么安排？';
  stepDesc.textContent = '工作和缴社保可以分开规划。';
  const afterStopControls = state.contributionPlan !== 'stop_with_work' ? `
    <div class="field"><label>停止工作后继续缴时，按什么方式？</label><div class="segment"><button type="button" data-after-stop="flex" class="${state.afterStopContributionMode === 'flex' ? 'active' : ''}">按灵活就业缴</button><button type="button" data-after-stop="same" class="${state.afterStopContributionMode === 'same' ? 'active' : ''}">暂按现在基数估</button></div></div>
    ${state.afterStopContributionMode === 'flex' ? `<div class="field"><label>灵活就业月缴费基数（元）</label><input data-key="flexMonthlyContributionBase" type="number" min="0" step="100" value="${state.flexMonthlyContributionBase}"><div class="help">填缴费基数，不是每月实际缴费金额。</div></div>` : ''}` : '';
  stepBody.innerHTML = `
    <div class="field"><label>${state.intent === 'flex' ? '从几岁起按离职/灵活就业规划？' : '计划几岁停止工作？'}</label><input data-key="stopWorkAge" type="number" min="${Math.floor(currentAgeMonths()/12)}" max="80" step="1" value="${state.stopWorkAge}"></div>
    <div class="field"><label>什么时候办理退休？</label>${retirementModeChoices(r)}</div>
    ${state.retirementMode !== 'statutory' ? `<div class="field"><label>${state.retirementMode === 'early' ? '提前多久' : '延后多久'}</label><div class="segment segment-three">${[12,24,36].map(m => `<button type="button" data-retirement-offset="${m}" class="${Number(state.retirementOffsetMonths) === m ? 'active' : ''}">${m/12}年</button>`).join('')}</div></div>` : ''}
    <div class="field"><label>停止工作后准备缴多久？</label><div class="choice-stack">
      <button type="button" class="choice ${state.contributionPlan === 'continuous_to_claim' ? 'active' : ''}" data-contribution-plan="continuous_to_claim"><strong>一直缴到办理退休</strong></button>
      <button type="button" class="choice ${state.contributionPlan === 'actual_months' ? 'active' : ''}" data-contribution-plan="actual_months"><strong>只再缴一段时间</strong></button>
      <button type="button" class="choice ${state.contributionPlan === 'stop_with_work' ? 'active' : ''}" data-contribution-plan="stop_with_work"><strong>停止工作后就不再缴</strong></button>
    </div></div>
    ${state.contributionPlan === 'actual_months' ? `<div class="field"><label>停止工作后预计还会实际缴</label><div class="number-pair"><div><input data-key="actualFutureYears" type="number" min="0" step="1" value="${state.actualFutureYears}"><span>年</span></div><div><input data-key="actualFutureMonthsExtra" type="number" min="0" max="11" step="1" value="${state.actualFutureMonthsExtra}"><span>个月</span></div></div></div>` : ''}
    ${afterStopControls}
    <div class="plan-preview"><span>当前计划</span><strong>未来实际缴 ${monthsText(futureContributionMonths())}</strong></div>`;
  stepBody.querySelectorAll('[data-retirement-mode]').forEach(btn => btn.addEventListener('click', () => { state.retirementMode = btn.dataset.retirementMode; renderStep(); }));
  stepBody.querySelectorAll('[data-retirement-offset]').forEach(btn => btn.addEventListener('click', () => { state.retirementOffsetMonths = Number(btn.dataset.retirementOffset); renderStep(); }));
  stepBody.querySelectorAll('[data-contribution-plan]').forEach(btn => btn.addEventListener('click', () => { state.contributionPlan = btn.dataset.contributionPlan; renderStep(); }));
  stepBody.querySelectorAll('[data-after-stop]').forEach(btn => btn.addEventListener('click', () => { state.afterStopContributionMode = btn.dataset.afterStop; renderStep(); }));
}

function renderAmount() {
  stepTitle.textContent = '再补两项，估算养老金';
  stepDesc.textContent = '不知道专业参数也可以估算。';
  stepBody.innerHTML = `
    <div class="field"><label>是否估算养老金金额？</label><div class="segment"><button type="button" data-amount-mode="estimate" class="${state.amountMode === 'estimate' ? 'active' : ''}">估算金额</button><button type="button" data-amount-mode="skip" class="${state.amountMode === 'skip' ? 'active' : ''}">只看资格</button></div></div>
    ${state.amountMode === 'skip' ? '' : `
      <div class="field"><label>现在的养老保险月缴费基数（元）</label><input data-key="monthlyContributionBase" type="number" min="0" step="100" value="${state.monthlyContributionBase}"></div>
      <div class="field"><label>过去大多数年份，缴费基数大致怎样？</label><div class="choice-stack compact-choices">
        <button type="button" class="choice ${state.historyPattern === 'low' ? 'active' : ''}" data-history="low"><strong>大多按较低档缴</strong></button>
        <button type="button" class="choice ${state.historyPattern === 'average' ? 'active' : ''}" data-history="average"><strong>大多处于中间水平</strong></button>
        <button type="button" class="choice ${state.historyPattern === 'high' ? 'active' : ''}" data-history="high"><strong>大多按较高水平缴</strong></button>
        <button type="button" class="choice ${state.historyPattern === 'variable' || state.historyPattern === 'unknown' ? 'active' : ''}" data-history="variable"><strong>变化很大 / 不清楚</strong></button>
        <button type="button" class="choice ${state.historyPattern === 'exact' ? 'active' : ''}" data-history="exact"><strong>我有官方平均缴费指数</strong></button>
      </div></div>
      ${state.historyPattern === 'exact' ? `<div class="field"><label>本人平均缴费工资指数</label><input data-key="avgIndex" type="number" min="0.3" max="3" step="0.01" value="${state.avgIndex}"></div>` : ''}
      <details class="disclosure"><summary>我有当地养老金计发基准</summary><div class="field" style="margin-top:12px"><label>月计发基准（元）</label><input data-key="currentCalcBase" type="number" min="0" step="1" value="${state.currentCalcBase}"></div></details>`}`;
  stepBody.querySelectorAll('[data-amount-mode]').forEach(btn => btn.addEventListener('click', () => { state.amountMode = btn.dataset.amountMode; renderStep(); }));
  stepBody.querySelectorAll('[data-history]').forEach(btn => btn.addEventListener('click', () => { state.historyPattern = btn.dataset.history; renderStep(); }));
}

function bindBasicFields() {
  stepBody.querySelectorAll('[data-key]').forEach(el => el.addEventListener('change', () => {
    const key = el.dataset.key;
    let value = el.value;
    if (['paidYears','paidMonthsExtra','currentAccount','stopWorkAge','actualFutureYears','actualFutureMonthsExtra','flexMonthlyContributionBase','monthlyContributionBase','avgIndex','currentCalcBase'].includes(key)) value = Number(value);
    state[key] = value;
    if (stepBody.dataset.step === 'plan') renderStep();
  }));
}
function showStepError(message) {
  document.getElementById('stepError')?.remove();
  if (!message) return;
  const box = document.createElement('div'); box.id = 'stepError'; box.className = 'status danger'; box.textContent = message; stepBody.appendChild(box);
}
function validateCurrentStep() {
  const key = activeSteps()[state.step];
  try {
    if (key === 'identity') {
      parseMonth(state.birth);
      if (currentAgeMonths() < 0) return '出生年月不能晚于当前月份。';
      if (state.sex === 'female' && state.femaleCategory === 'unsure' && state.intent !== 'age') return '请先确认更接近原50岁还是55岁退休口径。';
    }
    if (key === 'status') {
      if (!(Number(state.paidYears) >= 0)) return '请填写累计缴费年数。';
      if (!(Number(state.paidMonthsExtra) >= 0 && Number(state.paidMonthsExtra) <= 11)) return '月数请填0到11。';
      if (state.knowsAccount && !(Number(state.currentAccount) >= 0)) return '请填写个人账户余额。';
    }
    if (key === 'plan') {
      const claim = claimAgeMonths(), stop = stopWorkAgeMonths();
      if (!(Number(state.stopWorkAge) >= currentAgeMonths()/12)) return '停止工作年龄不能早于当前年龄。';
      if (stop > claim) return '停止工作年龄不能晚于办理退休年龄。';
      if (state.contributionPlan === 'actual_months' && actualAfterStopMonths() > Math.max(0, claim - stop)) return '停止工作后的缴费时间超过了可用月份。';
    }
    if (key === 'amount' && state.amountMode === 'estimate') {
      if (!(Number(state.monthlyContributionBase) > 0)) return '请填写现在的月缴费基数。';
      const hasAfterStop = futureContributionSegments().some(s => s.label === '灵活就业');
      if (hasAfterStop && !(Number(state.flexMonthlyContributionBase) > 0)) return '请填写灵活就业月缴费基数。';
      if (state.historyPattern === 'exact' && !(Number(state.avgIndex) >= 0.3 && Number(state.avgIndex) <= 3)) return '平均缴费工资指数请填0.3到3。';
    }
  } catch (error) { return error.message || '输入有误，请检查。'; }
  return '';
}

function renderAgeResultForCategory(category, label) {
  const r = retirement(category), date = claimDateFromAge(state.birth, r.statutoryAgeMonths);
  return `<div class="age-result-card"><span>${label}</span><strong>${ageText(r.statutoryAgeMonths)}</strong><em>${date.year}年${date.month}月</em></div>`;
}
function renderAgeResult() {
  let main;
  if (state.sex === 'female' && state.femaleCategory === 'unsure') {
    main = `<div class="result-hero clean-result"><div class="soft">退休口径尚未确定</div><div class="result-money">先看两种可能</div></div><div class="dual-age-grid">${renderAgeResultForCategory('base50','原50岁口径')}${renderAgeResultForCategory('base55','原55岁口径')}</div>`;
  } else {
    const r = retirement(), d = claimDateFromAge(state.birth, r.statutoryAgeMonths);
    main = `<div class="result-hero clean-result"><div class="soft">你的法定退休年龄</div><div class="result-money">${ageText(r.statutoryAgeMonths)}</div><div class="soft">预计 ${d.year}年${d.month}月</div></div>`;
  }
  resultView.innerHTML = `${main}<div class="result-actions"><button class="btn primary" id="continuePlanBtn" type="button">继续算养老金</button><button class="btn secondary" id="newPlanBtn" type="button">重新查询</button></div>`;
  save();
  document.getElementById('continuePlanBtn')?.addEventListener('click', () => {
    if (state.sex === 'female' && state.femaleCategory === 'unsure') { state.step = 0; show('wizard'); renderStep(); return; }
    state.intent = 'normal'; state.step = 1; state.contributionPlan = 'continuous_to_claim'; state.retirementMode = 'statutory'; show('wizard'); renderStep();
  });
  document.getElementById('newPlanBtn')?.addEventListener('click', resetAll); show('result');
}
function continuousQualificationAge(result) { return result.currentAgeMonths + result.remainingActualContributionMonths; }
function renderContributionStatus(result) {
  const required = monthsText(result.requiredContributionMonths), paid = monthsText(result.paidMonths), future = monthsText(result.futureContributionMonths);
  if (result.eligible) return `<div class="decision-card decision-good"><span class="decision-label">缴费资格</span><strong>按当前计划可以满足最低缴费年限</strong><p>最低要求 ${required}；已缴 ${paid}，未来计划再缴 ${future}。</p></div>`;
  return `<div class="decision-card decision-danger"><span class="decision-label">缴费资格</span><strong>当前计划还差 ${monthsText(result.plannedContributionShortageMonths)}</strong><p>已缴 ${paid}，最低要求 ${required}。从现在起还需累计实际缴 ${monthsText(result.remainingActualContributionMonths)}。</p><p>如果连续缴，大约到 ${ageText(continuousQualificationAge(result))} 可累计够；有断缴则顺延。</p></div>`;
}
function renderAmountBlock(result) {
  if (state.amountMode === 'skip') return `<div class="amount-decision"><span>养老金金额</span><strong>本次未估算</strong></div>`;
  if (!result.amountAvailable) return `<div class="amount-decision amount-muted"><span>养老金金额</span><strong>还缺必要信息</strong><p>${result.amountMissingReasons.join('；')}</p><button type="button" class="small-link inline-action" id="editAmountBtn">补充信息 →</button></div>`;
  const notes = result.amountNotes?.length ? `<p>${result.amountNotes.join('；')}</p>` : '';
  return `<div class="amount-decision amount-good"><span>预计每月养老金</span><strong>约 ${money(result.pensionCenter)}</strong><p>参考范围 ${money(result.pensionLow)}～${money(result.pensionHigh)} / 月 · ${result.amountConfidence}</p>${notes}</div>`;
}
function segmentSummary(result) {
  if (!result.futureContributionSegments?.length) return '';
  return result.futureContributionSegments.map(s => `${s.label || '未来缴费'} ${monthsText(s.months)}（基数约 ${money(s.monthlyContributionBase)}/月）`).join('；');
}
function timelineItem(title, sub) { return `<div class="tl-item"><div class="dot-wrap"><span class="dot"></span></div><div class="tl-content"><strong>${title}</strong><span>${sub}</span></div></div>`; }
function renderResult() {
  if (state.intent === 'age') return renderAgeResult();
  const category = mapCategory(), result = projectPlanV3(calculationInput(category));
  const stop = stopWorkAgeMonths(category), claim = claimAgeMonths(category), d = result.claimDate;
  const segments = segmentSummary(result);
  resultView.innerHTML = `<div class="result-hero clean-result"><div class="soft">你的退休计划</div><div class="result-money">${ageText(claim)}办理退休</div><div class="soft">预计 ${d.year}年${d.month}月</div><div class="result-grid"><div class="result-cell"><div class="k">停止工作</div><div class="v">${ageText(stop)}</div></div><div class="result-cell"><div class="k">已实际缴费</div><div class="v">${monthsText(result.paidMonths)}</div></div><div class="result-cell"><div class="k">未来计划实际缴</div><div class="v">${monthsText(result.futureContributionMonths)}</div></div><div class="result-cell"><div class="k">最低缴费要求</div><div class="v">${monthsText(result.requiredContributionMonths)}</div></div></div></div>
    ${renderContributionStatus(result)}
    ${segments ? `<div class="plain-note section"><strong>未来缴费按分段计算</strong><span>${segments}</span></div>` : ''}
    <div class="card section"><h2>养老金金额</h2>${renderAmountBlock(result)}</div>
    <div class="card section"><h2>时间线</h2><div class="timeline modern-timeline">${timelineItem('现在', `已实际缴 ${monthsText(result.paidMonths)}`)}${state.intent === 'normal' ? '' : timelineItem(ageText(stop), '计划停止工作')}${timelineItem(ageText(claim), `${d.year}年${d.month}月办理退休`)}</div></div>
    <div class="card section"><p class="source-box compact-copy">适用范围：${PENSION_SCOPE}。政策版本：${POLICY_VERSION}。养老金金额为规划估算，最终以参保地经办核定为准。</p></div>
    <div class="result-actions"><button class="btn primary" id="editPlanBtn" type="button">调整方案</button><button class="btn secondary" id="newPlanBtn" type="button">重新规划</button></div>`;
  save();
  document.getElementById('editPlanBtn')?.addEventListener('click', () => { state.step = state.intent === 'normal' ? 1 : 2; show('wizard'); renderStep(); });
  document.getElementById('editAmountBtn')?.addEventListener('click', () => { state.step = activeSteps().indexOf('amount'); show('wizard'); renderStep(); });
  document.getElementById('newPlanBtn')?.addEventListener('click', resetAll); show('result');
}
function resetAll() { localStorage.removeItem(STORAGE_KEY); location.reload(); }

document.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.intent)));
backBtn?.addEventListener('click', () => { if (state.step > 0) { state.step -= 1; renderStep(); } });
nextBtn?.addEventListener('click', () => {
  const error = validateCurrentStep(); if (error) { showStepError(error); return; }
  showStepError(''); const steps = activeSteps();
  if (state.step < steps.length - 1) { state.step += 1; renderStep(); } else renderResult();
});
document.getElementById('restartBtn')?.addEventListener('click', resetAll);

const saved = loadSaved();
if (saved) {
  Object.assign(state, saved);
  document.getElementById('resumeBox')?.classList.remove('hidden');
  const resumeText = document.getElementById('resumeText'); if (resumeText) resumeText.textContent = '上次的退休规划还在。';
  document.getElementById('resumeBtn')?.addEventListener('click', () => { state.step = Math.max(0, activeSteps().length - 2); show('wizard'); renderStep(); });
}
