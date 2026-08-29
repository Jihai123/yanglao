import {
  POLICY_VERSION,
  PENSION_SCOPE,
  ageText,
  calcStatutoryRetirement,
  claimDateFromAge,
  minimumContributionReferenceYear,
  minimumContributionYears,
  parseMonth,
} from './policy.js?v=20260829-v4';
import { projectPlanV4 } from './projection-v4.js?v=20260829-v4';
import { calcBaseSourceLabel, getRegionV4, regionOptionsV4 } from './sources-v4.js?v=20260829-v4';

const STORAGE_KEY = 'yanglao-v4-plan';
const nowDate = new Date();
const NOW = { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 };

const state = {
  intent: 'normal',
  step: 0,
  birth: '1983-01',
  sex: 'male',
  femaleCategory: 'worker50',
  paidYears: 18,
  paidMonthsExtra: 0,
  knowsAccount: false,
  currentAccount: '',
  hasDeemed: false,
  deemedYears: 0,
  deemedMonthsExtra: 0,
  transitionAmountKnown: false,
  transitionAmount: 0,
  stopWorkAge: 50,
  retirementMode: 'statutory',
  retirementOffsetMonths: 12,
  contributionPlan: 'to_minimum',
  actualFutureYears: 5,
  actualFutureMonthsExtra: 0,
  afterStopContributionMode: 'flex',
  flexBaseMode: 'unknown',
  flexMonthlyContributionBase: '',
  amountMode: 'estimate',
  monthlyContributionBase: '',
  historyMode: 'quick',
  historyPattern: 'unknown',
  historySegments: [],
  avgIndex: 1,
  regionKey: 'other',
  calcBaseMode: 'auto',
  currentCalcBase: '',
  currentCalcBaseYear: '',
  calcBaseSourceQuality: 'manual',
  socialWageGrowth: 0.03,
  historicalReferenceGrowth: 0.03,
  contributionGrowth: 0.03,
  accountInterest: 0.03,
  inflation: 0.02,
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

function money(n) {
  return Number.isFinite(Number(n)) ? `¥${Math.round(Number(n)).toLocaleString('zh-CN')}` : '—';
}

function monthsText(months) {
  const total = Math.max(0, Math.round(Number(months) || 0));
  const years = Math.floor(total / 12);
  const rest = total % 12;
  if (years && rest) return `${years}年${rest}个月`;
  if (years) return `${years}年`;
  return `${rest}个月`;
}

function activeSteps() {
  if (state.intent === 'age') return ['identity'];
  if (state.intent === 'normal') return ['identity', 'status', 'amount'];
  return ['identity', 'status', 'plan', 'amount'];
}

function currentAgeMonths() {
  const birth = parseMonth(state.birth);
  return (NOW.year * 12 + NOW.month - 1) - (birth.year * 12 + birth.month - 1);
}

function paidMonths() {
  return Math.max(0, Math.round(Number(state.paidYears || 0) * 12 + Number(state.paidMonthsExtra || 0)));
}

function deemedMonths() {
  if (!state.hasDeemed) return 0;
  return Math.max(0, Math.round(Number(state.deemedYears || 0) * 12 + Number(state.deemedMonthsExtra || 0)));
}

function mapCategory() {
  if (state.sex === 'male') return 'base60';
  if (state.femaleCategory === 'worker50') return 'base50';
  if (state.femaleCategory === 'manager55') return 'base55';
  return null;
}

function retirement(category = mapCategory()) {
  return category ? calcStatutoryRetirement(state.birth, category) : null;
}

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

function minimumRequiredMonths(category = mapCategory()) {
  const claim = claimAgeMonths(category);
  if (!claim || !category) return 0;
  const refYear = minimumContributionReferenceYear(state.birth, category, claim);
  return Math.round(minimumContributionYears(refYear) * 12);
}

function actualAfterStopMonths() {
  return Math.max(0, Math.round(Number(state.actualFutureYears || 0) * 12 + Number(state.actualFutureMonthsExtra || 0)));
}

function selectedRegion() {
  return getRegionV4(state.regionKey || 'other');
}

function applyRegionCalcBase(force = false) {
  if (state.calcBaseMode === 'manual' && !force) return;
  const region = selectedRegion();
  if (region.calcBase) {
    state.currentCalcBase = Number(region.calcBase.value);
    state.currentCalcBaseYear = Number(region.calcBase.year);
    state.calcBaseSourceQuality = region.calcBase.sourceLevel || 'direct';
    state.calcBaseMode = 'auto';
  } else {
    state.currentCalcBase = '';
    state.currentCalcBaseYear = '';
    state.calcBaseSourceQuality = 'manual';
    state.calcBaseMode = 'auto';
  }
}

function flexBaseValue() {
  if (state.afterStopContributionMode === 'same') return Math.max(0, Number(state.monthlyContributionBase || 0));
  const region = selectedRegion();
  if (state.flexBaseMode === 'minimum' && region.contribution?.current) return Number(region.contribution.min || 0);
  if (state.flexBaseMode === 'custom') return Math.max(0, Number(state.flexMonthlyContributionBase || 0));
  return 0;
}

function contributionWindow(category = mapCategory()) {
  const claim = claimAgeMonths(category);
  if (!claim) return { current: 0, stop: 0, claim: 0, beforeStop: 0, afterStop: 0 };
  const current = currentAgeMonths();
  const stop = Math.max(current, Math.min(claim, stopWorkAgeMonths(category)));
  return {
    current,
    stop,
    claim,
    beforeStop: Math.max(0, stop - current),
    afterStop: Math.max(0, claim - stop),
  };
}

function futureContributionSegments(category = mapCategory()) {
  const window = contributionWindow(category);
  const currentBase = Math.max(0, Number(state.monthlyContributionBase || 0));
  const afterBase = flexBaseValue();
  const segments = [];

  if (state.intent === 'normal') {
    const months = Math.max(0, window.claim - window.current);
    if (months) segments.push({ months, monthlyContributionBase: currentBase, startOffsetMonths: 0, contributionGrowth: state.contributionGrowth, label: '继续参保' });
    return segments;
  }

  const beforeStop = window.beforeStop;
  if (beforeStop) {
    segments.push({ months: beforeStop, monthlyContributionBase: currentBase, startOffsetMonths: 0, contributionGrowth: state.contributionGrowth, label: '停止工作前' });
  }

  if (state.contributionPlan === 'stop_with_work') return segments;

  let afterMonths = 0;
  if (state.contributionPlan === 'continuous_to_claim') afterMonths = window.afterStop;
  if (state.contributionPlan === 'actual_months') afterMonths = Math.min(actualAfterStopMonths(), window.afterStop);
  if (state.contributionPlan === 'to_minimum') {
    const needed = Math.max(0, minimumRequiredMonths(category) - paidMonths() - beforeStop);
    afterMonths = Math.min(needed, window.afterStop);
  }

  if (afterMonths) {
    segments.push({
      months: afterMonths,
      monthlyContributionBase: afterBase,
      startOffsetMonths: beforeStop,
      contributionGrowth: state.contributionGrowth,
      label: state.afterStopContributionMode === 'flex' ? '灵活就业' : '停止工作后继续缴',
    });
  }
  return segments;
}

function futureContributionMonths(category = mapCategory()) {
  return futureContributionSegments(category).reduce((sum, item) => sum + item.months, 0);
}

function migrateHistorySegments() {
  if (!Array.isArray(state.historySegments)) state.historySegments = [];
  state.historySegments = state.historySegments.map(item => {
    if (item.startMonth && item.endMonth) return item;
    const startYear = Number(item.startYear);
    const endYear = Number(item.endYear);
    return {
      startMonth: startYear ? `${startYear}-01` : '',
      endMonth: endYear ? `${endYear}-12` : '',
      monthlyContributionBase: item.monthlyContributionBase ?? '',
    };
  });
}

function ensureHistorySegments() {
  migrateHistorySegments();
  if (!state.historySegments.length) {
    state.historySegments.push({ startMonth: '', endMonth: '', monthlyContributionBase: '' });
  }
}

function segmentMonths(item) {
  try {
    const start = parseMonth(item.startMonth);
    const end = parseMonth(item.endMonth);
    const startIndex = start.year * 12 + start.month - 1;
    const endIndex = end.year * 12 + end.month - 1;
    if (endIndex < startIndex) return 0;
    return endIndex - startIndex + 1;
  } catch {
    return 0;
  }
}

function historySegmentsForCalculation() {
  if (state.historyMode !== 'segments') return [];
  ensureHistorySegments();
  return state.historySegments
    .map(item => ({
      startMonth: String(item.startMonth || ''),
      endMonth: String(item.endMonth || ''),
      monthlyContributionBase: Number(item.monthlyContributionBase),
    }))
    .filter(item => item.startMonth && item.endMonth && item.monthlyContributionBase > 0 && segmentMonths(item) > 0);
}

function historySegmentMonthsTotal() {
  return historySegmentsForCalculation().reduce((sum, item) => sum + segmentMonths(item), 0);
}

function avgIndexInfo() {
  if (state.historyMode === 'exact') return { value: Math.max(0.3, Math.min(3, Number(state.avgIndex || 1))), confidence: 'exact' };
  if (state.historyMode === 'segments') return { value: 1, confidence: 'segmented' };
  if (state.historyPattern === 'low') return { value: 0.6, confidence: 'rough' };
  if (state.historyPattern === 'average') return { value: 1, confidence: 'rough' };
  if (state.historyPattern === 'high') return { value: 1.5, confidence: 'rough' };
  return { value: 1, confidence: 'unknown' };
}

function calculationInput(category = mapCategory()) {
  const index = avgIndexInfo();
  applyRegionCalcBase(false);
  return {
    ...state,
    category,
    now: NOW,
    paidMonths: paidMonths(),
    deemedMonths: deemedMonths(),
    claimAgeMonths: claimAgeMonths(category),
    historyContributionSegments: historySegmentsForCalculation(),
    futureContributionSegments: futureContributionSegments(category),
    avgIndex: index.value,
    avgIndexConfidence: index.confidence,
    accountKnown: state.knowsAccount,
    currentAccount: state.knowsAccount ? Number(state.currentAccount || 0) : 0,
    transitionAmountKnown: Boolean(state.transitionAmountKnown),
    transitionAmount: Number(state.transitionAmount || 0),
    currentCalcBase: Number(state.currentCalcBase || 0),
    currentCalcBaseYear: Number(state.currentCalcBaseYear || 0),
    calcBaseSourceQuality: state.calcBaseSourceQuality,
    monthlyContributionBase: Number(state.monthlyContributionBase || 0),
    socialWageGrowth: Number(state.socialWageGrowth || 0.03),
    historicalReferenceGrowth: Number(state.historicalReferenceGrowth || 0.03),
    contributionGrowth: Number(state.contributionGrowth || 0.03),
    accountInterest: Number(state.accountInterest || 0.03),
    inflation: Number(state.inflation || 0.02),
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function show(view) {
  homeView?.classList.toggle('hidden', view !== 'home');
  wizardView?.classList.toggle('hidden', view !== 'wizard');
  resultView?.classList.toggle('hidden', view !== 'result');
  residentView?.classList.toggle('hidden', view !== 'resident');
  stickyActions?.classList.toggle('hidden', view !== 'wizard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  save();
  show('home');
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function initializeIntent(intent) {
  state.intent = intent;
  state.step = 0;
  state.retirementMode = 'statutory';
  state.retirementOffsetMonths = 12;
  const ageNow = Math.max(0, currentAgeMonths() / 12);
  if (intent === 'normal') state.contributionPlan = 'continuous_to_claim';
  if (intent === 'early') {
    state.stopWorkAge = Math.max(Math.ceil(ageNow + 1), Math.min(50, Math.ceil(ageNow + 5)));
    state.contributionPlan = 'to_minimum';
    state.afterStopContributionMode = 'flex';
  }
  if (intent === 'flex') {
    state.stopWorkAge = Math.ceil(ageNow);
    state.contributionPlan = 'to_minimum';
    state.afterStopContributionMode = 'flex';
  }
}

function start(intent) {
  initializeIntent(intent);
  show('wizard');
  renderStep();
}

function renderStep() {
  const steps = activeSteps();
  if (state.step >= steps.length) state.step = steps.length - 1;
  const key = steps[state.step];
  stepBody.dataset.step = key;
  stepKicker.textContent = `第 ${state.step + 1} / ${steps.length} 步`;
  progressBar.style.width = `${((state.step + 1) / steps.length) * 100}%`;
  backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = state.step === steps.length - 1 ? (state.intent === 'age' ? '查看退休时间' : '查看结果') : '下一步';
  if (key === 'identity') renderIdentity();
  if (key === 'status') renderStatus();
  if (key === 'plan') renderPlan();
  if (key === 'amount') renderAmount();
  bindBasicFields();
}

function renderIdentity() {
  stepTitle.textContent = '先填基本信息';
  stepDesc.textContent = '';
  stepBody.innerHTML = `
    <div class="field"><label>出生年月</label><input class="mobile-safe-input" data-key="birth" type="month" value="${state.birth}"></div>
    <div class="field"><label>性别</label><div class="segment"><button type="button" data-sex="male" class="${state.sex === 'male' ? 'active' : ''}">男</button><button type="button" data-sex="female" class="${state.sex === 'female' ? 'active' : ''}">女</button></div></div>
    ${state.sex === 'female' ? `<div class="field"><label>退休前主要属于哪种情况？</label><div class="choice-stack compact-choices">
      <button type="button" class="choice ${state.femaleCategory === 'worker50' ? 'active' : ''}" data-female-category="worker50"><strong>普通女职工</strong><span>通常对应原50岁口径</span></button>
      <button type="button" class="choice ${state.femaleCategory === 'manager55' ? 'active' : ''}" data-female-category="manager55"><strong>管理 / 技术等岗位</strong><span>通常对应原55岁口径</span></button>
      <button type="button" class="choice ${state.femaleCategory === 'unsure' ? 'active' : ''}" data-female-category="unsure"><strong>不确定</strong><span>先看两种可能</span></button>
    </div></div>` : ''}`;
  stepBody.querySelectorAll('[data-sex]').forEach(btn => btn.addEventListener('click', () => { state.sex = btn.dataset.sex; renderStep(); }));
  stepBody.querySelectorAll('[data-female-category]').forEach(btn => btn.addEventListener('click', () => { state.femaleCategory = btn.dataset.femaleCategory; renderStep(); }));
}

function accountGuideHtml() {
  return `<details class="inline-help"><summary>个人账户余额在哪查？</summary><ol><li>打开支付宝，搜索“电子社保卡”或“社保”。</li><li>进入社保权益查询 / 个人权益记录。</li><li>找到养老保险里的“个人账户储存额”或“个人账户余额”。</li><li>把金额填回这里。</li></ol><p>不同地区入口名称可能略有差异，认准“养老保险个人账户”即可。</p></details>`;
}

function renderStatus() {
  stepTitle.textContent = '你已经缴了多久？';
  stepDesc.textContent = '按社保权益记录里的累计实际缴费时间填写。';
  stepBody.innerHTML = `
    <div class="field"><label>累计实际缴费</label><div class="number-pair"><div><input data-key="paidYears" type="number" min="0" step="1" value="${state.paidYears}"><span>年</span></div><div><input data-key="paidMonthsExtra" type="number" min="0" max="11" step="1" value="${state.paidMonthsExtra}"><span>个月</span></div></div></div>
    <div class="field"><label>个人账户余额</label><div class="segment"><button type="button" data-account="known" class="${state.knowsAccount ? 'active' : ''}">我知道</button><button type="button" data-account="unknown" class="${!state.knowsAccount ? 'active' : ''}">不知道</button></div>${accountGuideHtml()}</div>
    ${state.knowsAccount ? `<div class="field"><label>个人账户余额（元）</label><input data-key="currentAccount" type="number" min="0" step="1" value="${state.currentAccount}"></div>` : ''}
    <details class="disclosure"><summary>我有视同缴费年限</summary><div class="detail-stack"><div class="segment"><button type="button" data-deemed="no" class="${!state.hasDeemed ? 'active' : ''}">没有 / 不适用</button><button type="button" data-deemed="yes" class="${state.hasDeemed ? 'active' : ''}">有</button></div>${state.hasDeemed ? `<div class="field"><label>视同缴费年限</label><div class="number-pair"><div><input data-key="deemedYears" type="number" min="0" step="1" value="${state.deemedYears}"><span>年</span></div><div><input data-key="deemedMonthsExtra" type="number" min="0" max="11" step="1" value="${state.deemedMonthsExtra}"><span>个月</span></div></div></div>` : ''}</div></details>`;
  stepBody.querySelectorAll('[data-account]').forEach(btn => btn.addEventListener('click', () => { state.knowsAccount = btn.dataset.account === 'known'; renderStep(); }));
  stepBody.querySelectorAll('[data-deemed]').forEach(btn => btn.addEventListener('click', () => { state.hasDeemed = btn.dataset.deemed === 'yes'; renderStep(); }));
}

function retirementModeChoices(r) {
  return `<div class="choice-stack">
    <button type="button" class="choice ${state.retirementMode === 'statutory' ? 'active' : ''}" data-retirement-mode="statutory"><strong>按法定退休时间</strong><span>${ageText(r.statutoryAgeMonths)}</span></button>
    <button type="button" class="choice ${state.retirementMode === 'early' ? 'active' : ''}" data-retirement-mode="early"><strong>看看能否提前退休</strong><span>最早 ${ageText(r.earliestAgeMonths)}</span></button>
    <button type="button" class="choice ${state.retirementMode === 'delayed' ? 'active' : ''}" data-retirement-mode="delayed"><strong>考虑延迟退休</strong><span>最晚 ${ageText(r.latestAgeMonths)}</span></button>
  </div>`;
}

function flexBaseControls() {
  if (state.afterStopContributionMode !== 'flex') return '';
  const region = selectedRegion();
  const hasCurrentMin = Boolean(region.contribution?.current && region.contribution?.min);
  return `<div class="field"><label>灵活就业准备按什么基数缴？</label><div class="choice-stack compact-choices">
    ${hasCurrentMin ? `<button type="button" class="choice ${state.flexBaseMode === 'minimum' ? 'active' : ''}" data-flex-base-mode="minimum"><strong>按当地当前最低档</strong><span>${money(region.contribution.min)}/月</span></button>` : ''}
    <button type="button" class="choice ${state.flexBaseMode === 'custom' ? 'active' : ''}" data-flex-base-mode="custom"><strong>我自己填写基数</strong></button>
    <button type="button" class="choice ${state.flexBaseMode === 'unknown' ? 'active' : ''}" data-flex-base-mode="unknown"><strong>还没决定</strong><span>先算资格，金额需要确定基数后才更可靠</span></button>
  </div>${state.flexBaseMode === 'custom' ? `<div class="field nested-field"><label>灵活就业月缴费基数（元）</label><input data-key="flexMonthlyContributionBase" type="number" min="0" step="1" value="${state.flexMonthlyContributionBase}"></div>` : ''}</div>`;
}

function renderPlan() {
  const r = retirement();
  const required = minimumRequiredMonths();
  const already = paidMonths();
  stepTitle.textContent = state.intent === 'flex' ? '以后准备怎么缴？' : '停止工作后，社保怎么缴？';
  stepDesc.textContent = '';
  stepBody.innerHTML = `
    <div class="field"><label>${state.intent === 'flex' ? '从几岁起按离职 / 灵活就业规划？' : '计划几岁停止工作？'}</label><input data-key="stopWorkAge" type="number" min="${Math.floor(currentAgeMonths()/12)}" max="80" step="1" value="${state.stopWorkAge}"></div>
    <div class="field"><label>什么时候办理退休？</label>${retirementModeChoices(r)}</div>
    ${state.retirementMode !== 'statutory' ? `<div class="field"><label>${state.retirementMode === 'early' ? '提前多久' : '延后多久'}</label><div class="segment segment-three">${[12,24,36].map(months => `<button type="button" data-retirement-offset="${months}" class="${Number(state.retirementOffsetMonths) === months ? 'active' : ''}">${months/12}年</button>`).join('')}</div></div>` : ''}
    <div class="field"><label>停止工作后缴多久？</label><div class="choice-stack">
      <button type="button" class="choice ${state.contributionPlan === 'to_minimum' ? 'active' : ''}" data-contribution-plan="to_minimum"><strong>缴够最低要求就停</strong><span>最低要求 ${monthsText(required)}，目前已缴 ${monthsText(already)}</span></button>
      <button type="button" class="choice ${state.contributionPlan === 'continuous_to_claim' ? 'active' : ''}" data-contribution-plan="continuous_to_claim"><strong>一直缴到退休</strong></button>
      <button type="button" class="choice ${state.contributionPlan === 'actual_months' ? 'active' : ''}" data-contribution-plan="actual_months"><strong>再缴一段时间</strong></button>
      <button type="button" class="choice ${state.contributionPlan === 'stop_with_work' ? 'active' : ''}" data-contribution-plan="stop_with_work"><strong>停止工作后不再缴</strong></button>
    </div></div>
    ${state.contributionPlan === 'actual_months' ? `<div class="field"><label>停止工作后预计还会实际缴</label><div class="number-pair"><div><input data-key="actualFutureYears" type="number" min="0" step="1" value="${state.actualFutureYears}"><span>年</span></div><div><input data-key="actualFutureMonthsExtra" type="number" min="0" max="11" step="1" value="${state.actualFutureMonthsExtra}"><span>个月</span></div></div></div>` : ''}
    ${state.contributionPlan !== 'stop_with_work' ? `<div class="field"><label>停止工作后继续缴时</label><div class="segment"><button type="button" data-after-stop="flex" class="${state.afterStopContributionMode === 'flex' ? 'active' : ''}">按灵活就业缴</button><button type="button" data-after-stop="same" class="${state.afterStopContributionMode === 'same' ? 'active' : ''}">暂按现在基数</button></div></div>${flexBaseControls()}` : ''}
    <div class="plan-preview"><span>按当前方案</span><strong>未来预计实际缴 ${monthsText(futureContributionMonths())}</strong></div>`;

  stepBody.querySelectorAll('[data-retirement-mode]').forEach(btn => btn.addEventListener('click', () => { state.retirementMode = btn.dataset.retirementMode; renderStep(); }));
  stepBody.querySelectorAll('[data-retirement-offset]').forEach(btn => btn.addEventListener('click', () => { state.retirementOffsetMonths = Number(btn.dataset.retirementOffset); renderStep(); }));
  stepBody.querySelectorAll('[data-contribution-plan]').forEach(btn => btn.addEventListener('click', () => { state.contributionPlan = btn.dataset.contributionPlan; renderStep(); }));
  stepBody.querySelectorAll('[data-after-stop]').forEach(btn => btn.addEventListener('click', () => { state.afterStopContributionMode = btn.dataset.afterStop; renderStep(); }));
  stepBody.querySelectorAll('[data-flex-base-mode]').forEach(btn => btn.addEventListener('click', () => { state.flexBaseMode = btn.dataset.flexBaseMode; renderStep(); }));
}

function historyRowsHtml() {
  ensureHistorySegments();
  const rows = state.historySegments.map((item, index) => `
    <div class="history-row">
      <div class="history-month"><label>开始年月</label><input type="month" data-history-index="${index}" data-history-field="startMonth" value="${item.startMonth || ''}"></div>
      <div class="history-month"><label>结束年月</label><input type="month" data-history-index="${index}" data-history-field="endMonth" value="${item.endMonth || ''}"></div>
      <div class="history-base"><label>月缴费基数</label><input type="number" min="0" step="1" data-history-index="${index}" data-history-field="monthlyContributionBase" value="${item.monthlyContributionBase ?? ''}"></div>
      ${state.historySegments.length > 1 ? `<button type="button" class="history-remove" data-history-remove="${index}" aria-label="删除这一段">删除</button>` : ''}
    </div>`).join('');
  return `${rows}<button type="button" class="small-link history-add" id="historyAddBtn">+ 添加一段</button><div class="history-total" id="historyTotalText"></div>`;
}

function updateHistoryTotalText() {
  const target = document.getElementById('historyTotalText');
  if (!target) return;
  const total = historySegmentMonthsTotal();
  if (!total) { target.textContent = ''; target.classList.remove('history-total-warn'); return; }
  target.textContent = `分段合计 ${monthsText(total)} · 累计实际缴费 ${monthsText(paidMonths())}`;
  target.classList.toggle('history-total-warn', Math.abs(total - paidMonths()) > 1);
}

function regionFieldHtml() {
  const region = selectedRegion();
  const base = region.calcBase;
  const source = base ? calcBaseSourceLabel(base) : '';
  return `<div class="field"><label>养老金待遇领取地（预计）</label><select id="regionSelect">${regionOptionsV4().map(item => `<option value="${item.key}" ${item.key === state.regionKey ? 'selected' : ''}>${item.name}</option>`).join('')}</select><div class="help">不是退休后住在哪里。跨省缴过社保、暂时拿不准，可以选“暂不确定 / 其他”。</div>${base ? `<div class="region-inline"><strong>${base.year}年计发基准 ${money(base.value)}/月</strong><span>${source}</span></div>` : `<div class="region-inline muted-inline">暂未收录可自动带入的可靠计发基准。</div>`}</div>`;
}

function renderAmount() {
  applyRegionCalcBase(false);
  stepTitle.textContent = '估算养老金';
  stepDesc.textContent = '';
  const region = selectedRegion();
  stepBody.innerHTML = `
    <div class="field"><label>这次要不要估算金额？</label><div class="segment"><button type="button" data-amount-mode="estimate" class="${state.amountMode === 'estimate' ? 'active' : ''}">估算金额</button><button type="button" data-amount-mode="skip" class="${state.amountMode === 'skip' ? 'active' : ''}">只看资格</button></div></div>
    ${state.amountMode === 'skip' ? '' : `
      ${regionFieldHtml()}
      <div class="field"><label>现在的养老保险月缴费基数（元）</label><input data-key="monthlyContributionBase" type="number" min="0" step="1" value="${state.monthlyContributionBase}"><div class="help">填社保记录里的缴费基数，不是个人每月扣款金额。</div></div>
      <div class="field"><label>过去的缴费情况</label><div class="choice-stack compact-choices">
        <button type="button" class="choice ${state.historyMode === 'segments' ? 'active' : ''}" data-history-mode="segments"><strong>按历史记录分段填</strong><span>更适合基数变化较大的人</span></button>
        <button type="button" class="choice ${state.historyMode === 'quick' ? 'active' : ''}" data-history-mode="quick"><strong>我只知道大概水平</strong></button>
        <button type="button" class="choice ${state.historyMode === 'exact' ? 'active' : ''}" data-history-mode="exact"><strong>我有官方平均缴费指数</strong></button>
      </div></div>
      ${state.historyMode === 'segments' ? `<div class="field"><label>历史缴费基数</label><div class="history-editor">${historyRowsHtml()}</div></div>` : ''}
      ${state.historyMode === 'quick' ? `<div class="field"><label>过去大多数年份</label><div class="segment segment-four"><button type="button" data-history-pattern="low" class="${state.historyPattern === 'low' ? 'active' : ''}">偏低</button><button type="button" data-history-pattern="average" class="${state.historyPattern === 'average' ? 'active' : ''}">中间</button><button type="button" data-history-pattern="high" class="${state.historyPattern === 'high' ? 'active' : ''}">偏高</button><button type="button" data-history-pattern="unknown" class="${state.historyPattern === 'unknown' ? 'active' : ''}">不清楚</button></div></div>` : ''}
      ${state.historyMode === 'exact' ? `<div class="field"><label>本人平均缴费工资指数</label><input data-key="avgIndex" type="number" min="0.3" max="3" step="0.01" value="${state.avgIndex}"></div>` : ''}
      ${state.hasDeemed ? `<div class="field"><label>过渡性养老金</label><div class="segment"><button type="button" data-transition-known="no" class="${!state.transitionAmountKnown ? 'active' : ''}">不知道</button><button type="button" data-transition-known="yes" class="${state.transitionAmountKnown ? 'active' : ''}">我有已核定 / 官方测算金额</button></div>${state.transitionAmountKnown ? `<div class="nested-field"><label>过渡性养老金月额（元）</label><input data-key="transitionAmount" type="number" min="0" step="1" value="${state.transitionAmount}"></div>` : ''}</div>` : ''}
      <details class="disclosure"><summary>高级参数</summary><div class="detail-stack">
        <div class="field"><label>当前养老金计发基准（月，元）</label><input data-key="currentCalcBase" type="number" min="0" step="1" value="${state.currentCalcBase}"><div class="help">${region.calcBase ? `已按${region.calcBase.year}年数据带入。` : '未收录地区需要从当地人社公开参数填写。'}</div></div>
        <div class="field"><label>基准对应年份</label><input data-key="currentCalcBaseYear" type="number" min="2000" max="${NOW.year}" step="1" value="${state.currentCalcBaseYear}"></div>
        <div class="field"><label>未来社会工资年增长假设</label><input data-key="socialWageGrowthPercent" type="number" min="-2" max="12" step="0.5" value="${Math.round(state.socialWageGrowth * 1000) / 10}"><span class="help">仅用于未来规划，不是政策承诺。</span></div>
      </div></details>`}`;

  stepBody.querySelectorAll('[data-amount-mode]').forEach(btn => btn.addEventListener('click', () => { state.amountMode = btn.dataset.amountMode; renderStep(); }));
  stepBody.querySelectorAll('[data-history-mode]').forEach(btn => btn.addEventListener('click', () => { state.historyMode = btn.dataset.historyMode; if (state.historyMode === 'segments') ensureHistorySegments(); renderStep(); }));
  stepBody.querySelectorAll('[data-history-pattern]').forEach(btn => btn.addEventListener('click', () => { state.historyPattern = btn.dataset.historyPattern; renderStep(); }));
  stepBody.querySelectorAll('[data-transition-known]').forEach(btn => btn.addEventListener('click', () => { state.transitionAmountKnown = btn.dataset.transitionKnown === 'yes'; renderStep(); }));
  document.getElementById('regionSelect')?.addEventListener('change', event => {
    state.regionKey = event.target.value;
    state.calcBaseMode = 'auto';
    applyRegionCalcBase(true);
    if (state.flexBaseMode === 'minimum' && !selectedRegion().contribution?.current) state.flexBaseMode = 'unknown';
    renderStep();
  });

  stepBody.querySelectorAll('[data-history-index]').forEach(input => {
    input.addEventListener('input', () => {
      const index = Number(input.dataset.historyIndex);
      const field = input.dataset.historyField;
      if (!state.historySegments[index]) return;
      state.historySegments[index][field] = input.value;
      updateHistoryTotalText();
    });
  });
  stepBody.querySelectorAll('[data-history-remove]').forEach(btn => btn.addEventListener('click', () => {
    state.historySegments.splice(Number(btn.dataset.historyRemove), 1);
    ensureHistorySegments();
    renderStep();
  }));
  document.getElementById('historyAddBtn')?.addEventListener('click', () => {
    state.historySegments.push({ startMonth: '', endMonth: '', monthlyContributionBase: '' });
    renderStep();
  });
  updateHistoryTotalText();
}

function bindBasicFields() {
  stepBody.querySelectorAll('[data-key]').forEach(el => el.addEventListener('change', () => {
    const key = el.dataset.key;
    if (key === 'birth') { state.birth = el.value; return; }
    if (key === 'currentCalcBase') {
      state.currentCalcBase = Number(el.value || 0);
      state.calcBaseMode = 'manual';
      state.calcBaseSourceQuality = 'manual';
      return;
    }
    if (key === 'socialWageGrowthPercent') {
      state.socialWageGrowth = Number(el.value || 0) / 100;
      state.contributionGrowth = state.socialWageGrowth;
      return;
    }
    const numericKeys = new Set(['paidYears','paidMonthsExtra','currentAccount','deemedYears','deemedMonthsExtra','transitionAmount','stopWorkAge','actualFutureYears','actualFutureMonthsExtra','flexMonthlyContributionBase','monthlyContributionBase','avgIndex','currentCalcBaseYear']);
    state[key] = numericKeys.has(key) ? Number(el.value) : el.value;
    if (stepBody.dataset.step === 'plan') renderStep();
  }));
}

function showStepError(message) {
  document.getElementById('stepError')?.remove();
  if (!message) return;
  const box = document.createElement('div');
  box.id = 'stepError';
  box.className = 'status danger';
  box.textContent = message;
  stepBody.appendChild(box);
}

function validateHistorySegments() {
  if (state.historyMode !== 'segments') return '';
  ensureHistorySegments();
  const intervals = [];
  for (const item of state.historySegments) {
    if (!item.startMonth && !item.endMonth && !item.monthlyContributionBase) continue;
    let start;
    let end;
    try { start = parseMonth(item.startMonth); end = parseMonth(item.endMonth); } catch { return '请把历史缴费的开始、结束年月填完整。'; }
    const startIndex = start.year * 12 + start.month - 1;
    const endIndex = end.year * 12 + end.month - 1;
    const nowIndex = NOW.year * 12 + NOW.month - 1;
    if (endIndex < startIndex) return '历史缴费结束年月不能早于开始年月。';
    if (endIndex > nowIndex) return '历史缴费结束年月不能晚于当前月份。';
    if (!(Number(item.monthlyContributionBase) > 0)) return '请填写每一段的月缴费基数。';
    intervals.push({ startIndex, endIndex });
  }
  if (!intervals.length) return '至少填写一段历史缴费记录。';
  intervals.sort((a, b) => a.startIndex - b.startIndex);
  for (let i = 1; i < intervals.length; i += 1) {
    if (intervals[i].startIndex <= intervals[i - 1].endIndex) return '历史缴费时间段不能重叠。';
  }
  const total = historySegmentMonthsTotal();
  if (Math.abs(total - paidMonths()) > 1) return `历史分段合计${monthsText(total)}，和前面填写的累计实际缴费${monthsText(paidMonths())}不一致。`;
  return '';
}

function validateCurrentStep() {
  const key = activeSteps()[state.step];
  try {
    if (key === 'identity') {
      parseMonth(state.birth);
      if (currentAgeMonths() < 0) return '出生年月不能晚于当前月份。';
      if (state.sex === 'female' && state.femaleCategory === 'unsure' && state.intent !== 'age') return '女性退休口径不确定时，先用“我什么时候能退休”查看两种可能。';
    }
    if (key === 'status') {
      if (!(Number(state.paidYears) >= 0)) return '请填写累计缴费年数。';
      if (!(Number(state.paidMonthsExtra) >= 0 && Number(state.paidMonthsExtra) <= 11)) return '累计缴费月数请填0到11。';
      if (state.knowsAccount && !(Number(state.currentAccount) >= 0)) return '请填写个人账户余额。';
      if (state.hasDeemed && !(Number(state.deemedMonthsExtra) >= 0 && Number(state.deemedMonthsExtra) <= 11)) return '视同缴费月数请填0到11。';
    }
    if (key === 'plan') {
      const claim = claimAgeMonths();
      const stop = stopWorkAgeMonths();
      if (!(Number(state.stopWorkAge) >= currentAgeMonths() / 12)) return '停止工作年龄不能早于当前年龄。';
      if (stop > claim) return '停止工作年龄不能晚于办理退休年龄。';
      if (state.contributionPlan === 'actual_months' && actualAfterStopMonths() > contributionWindow().afterStop) return '停止工作后的缴费时间超过了到退休前的可用月份。';
    }
    if (key === 'amount' && state.amountMode === 'estimate') {
      if (!(Number(state.monthlyContributionBase) > 0)) return '请填写现在的养老保险月缴费基数。';
      const needsAfterBase = futureContributionSegments().some(item => item.label === '灵活就业' && item.months > 0);
      if (needsAfterBase && !(flexBaseValue() > 0)) return '停止工作后还要继续缴费，请先确定灵活就业缴费基数。';
      const historyError = validateHistorySegments();
      if (historyError) return historyError;
      if (state.historyMode === 'exact' && !(Number(state.avgIndex) >= 0.3 && Number(state.avgIndex) <= 3)) return '平均缴费工资指数请填0.3到3。';
      applyRegionCalcBase(false);
      if (!(Number(state.currentCalcBase) > 0)) return '当前地区还没有可用的计发基准。可在“高级参数”中填写当地人社公布的计发基准后再估算金额。';
      if (state.hasDeemed && !state.transitionAmountKnown) return '你填写了视同缴费年限。过渡性养老金需要当地规则，暂不能把它省略后给出总金额；可先用官方待遇测算交叉核对。';
    }
  } catch (error) {
    return error.message || '输入有误，请检查。';
  }
  return '';
}

function renderAgeResultForCategory(category, label) {
  const r = retirement(category);
  const date = claimDateFromAge(state.birth, r.statutoryAgeMonths);
  return `<div class="age-result-card"><span>${label}</span><strong>${ageText(r.statutoryAgeMonths)}</strong><em>${date.year}年${date.month}月</em></div>`;
}

function renderAgeResult() {
  let main;
  if (state.sex === 'female' && state.femaleCategory === 'unsure') {
    main = `<div class="result-hero clean-result"><div class="soft">退休口径暂未确定</div><div class="result-money">先看两种可能</div></div><div class="dual-age-grid">${renderAgeResultForCategory('base50','原50岁口径')}${renderAgeResultForCategory('base55','原55岁口径')}</div>`;
  } else {
    const r = retirement();
    const date = claimDateFromAge(state.birth, r.statutoryAgeMonths);
    main = `<div class="result-hero clean-result"><div class="soft">你的法定退休时间</div><div class="result-money">${ageText(r.statutoryAgeMonths)}</div><div class="soft">${date.year}年${date.month}月</div></div>`;
  }
  resultView.innerHTML = `${main}<div class="result-actions three-actions"><button class="btn primary" id="continuePlanBtn" type="button">继续算养老金</button><button class="btn secondary" id="homeResultBtn" type="button">返回首页</button><button class="btn ghost" id="newPlanBtn" type="button">清空重算</button></div>`;
  save();
  document.getElementById('continuePlanBtn')?.addEventListener('click', () => {
    if (state.sex === 'female' && state.femaleCategory === 'unsure') { state.step = 0; show('wizard'); renderStep(); return; }
    state.intent = 'normal';
    state.step = 1;
    state.contributionPlan = 'continuous_to_claim';
    state.retirementMode = 'statutory';
    show('wizard');
    renderStep();
  });
  document.getElementById('homeResultBtn')?.addEventListener('click', goHome);
  document.getElementById('newPlanBtn')?.addEventListener('click', resetAll);
  show('result');
}

function renderContributionStatus(result) {
  const required = monthsText(result.requiredContributionMonths);
  const paid = monthsText(result.paidMonths);
  const future = monthsText(result.futureContributionMonths);
  if (result.eligible) return `<div class="decision-card decision-good"><span class="decision-label">最低缴费年限</span><strong>按当前计划可以满足</strong><p>最低 ${required} · 已缴 ${paid} · 未来计划 ${future}</p></div>`;
  return `<div class="decision-card decision-danger"><span class="decision-label">最低缴费年限</span><strong>按当前计划还差 ${monthsText(result.plannedContributionShortageMonths)}</strong><p>最低 ${required} · 已缴 ${paid} · 未来计划 ${future}</p></div>`;
}

function segmentSummary(result) {
  if (!result.futureContributionSegments?.length) return '';
  return result.futureContributionSegments.map(item => `${item.label || '未来缴费'} ${monthsText(item.months)}${item.monthlyContributionBase > 0 ? `，当前基数约 ${money(item.monthlyContributionBase)}` : ''}`).join('；');
}

function renderAmountBlock(result) {
  if (state.amountMode === 'skip') return `<div class="amount-decision"><span>养老金金额</span><strong>本次未估算</strong></div>`;
  if (!result.amountAvailable) return `<div class="amount-decision amount-muted"><span>养老金金额</span><strong>还缺必要信息</strong><p>${result.amountMissingReasons.join('；')}</p><button type="button" class="small-link inline-action" id="editAmountBtn">补充信息 →</button></div>`;
  return `<div class="amount-decision amount-good"><span>预计每月养老金</span><strong>约 ${money(result.pensionCenter)}</strong><p>参考范围 ${money(result.pensionLow)}～${money(result.pensionHigh)} / 月 · ${result.amountConfidence}</p><div class="pension-breakdown"><div><span>基础养老金</span><strong>${money(result.basicCenter)}</strong></div><div><span>个人账户养老金</span><strong>${money(result.personalCenter)}</strong></div>${result.transitionCenter > 0 ? `<div><span>过渡性养老金</span><strong>${money(result.transitionCenter)}</strong></div>` : ''}</div><details class="inline-help"><summary>为什么是${result.amountConfidence}？</summary><ul>${result.confidenceReasons.map(reason => `<li>${reason}</li>`).join('')}</ul></details></div>`;
}

function scenarioSegments(totalFutureMonths) {
  const category = mapCategory();
  const window = contributionWindow(category);
  const target = Math.max(0, Math.min(Math.round(totalFutureMonths), window.claim - window.current));
  const currentBase = Math.max(0, Number(state.monthlyContributionBase || 0));
  const afterBase = flexBaseValue();
  const before = Math.min(target, window.beforeStop);
  const after = Math.max(0, target - before);
  const segments = [];
  if (before) segments.push({ months: before, monthlyContributionBase: currentBase, startOffsetMonths: 0, contributionGrowth: state.contributionGrowth, label: '停止工作前' });
  if (after) segments.push({ months: after, monthlyContributionBase: afterBase, startOffsetMonths: window.beforeStop, contributionGrowth: state.contributionGrowth, label: state.afterStopContributionMode === 'flex' ? '灵活就业' : '继续缴费' });
  return segments;
}

function comparisonRows(result) {
  if (!result.amountAvailable) return '';
  const window = contributionWindow();
  const maxFuture = Math.max(0, window.claim - window.current);
  const minTarget = Math.min(maxFuture, Math.max(window.beforeStop, result.requiredContributionMonths - result.paidMonths));
  const candidates = [
    { label: '缴够最低要求', months: minTarget },
    { label: '最低要求后再多缴3年', months: Math.min(maxFuture, minTarget + 36) },
    { label: '最低要求后再多缴5年', months: Math.min(maxFuture, minTarget + 60) },
    { label: '一直缴到退休', months: maxFuture },
  ];
  const seen = new Set();
  const rows = [];
  let basePension = null;
  for (const candidate of candidates) {
    if (seen.has(candidate.months)) continue;
    seen.add(candidate.months);
    const projected = projectPlanV4({ ...calculationInput(), futureContributionSegments: scenarioSegments(candidate.months) });
    if (!projected.amountAvailable) continue;
    if (basePension === null) basePension = projected.pensionCenter;
    rows.push({
      ...candidate,
      totalMonths: result.paidMonths + candidate.months,
      pension: projected.pensionCenter,
      delta: projected.pensionCenter - basePension,
    });
  }
  if (rows.length < 2) return '';
  return `<div class="card section compare-card"><div class="section-heading"><div><span class="section-kicker">方案比较</span><h2>多缴几年，能多领多少？</h2></div></div><div class="compare-table">${rows.map(row => `<div class="compare-row"><div><strong>${row.label}</strong><span>累计缴费 ${monthsText(row.totalMonths)}</span></div><div class="compare-money"><strong>${money(row.pension)}/月</strong><span>${row.delta > 1 ? `比最低方案约多 ${money(row.delta)}/月` : '基准方案'}</span></div></div>`).join('')}</div><p class="muted compact-copy">按同一套地区参数和缴费基数假设重算，用来比较方案，不代表未来最终核定金额。</p></div>`;
}

function timelineItem(title, sub) {
  return `<div class="tl-item"><div class="dot-wrap"><span class="dot"></span></div><div class="tl-content"><strong>${title}</strong><span>${sub}</span></div></div>`;
}

function renderResult() {
  if (state.intent === 'age') return renderAgeResult();
  const category = mapCategory();
  const result = projectPlanV4(calculationInput(category));
  const stop = stopWorkAgeMonths(category);
  const claim = claimAgeMonths(category);
  const date = result.claimDate;
  const segments = segmentSummary(result);
  resultView.innerHTML = `<div class="result-hero clean-result"><div class="soft">你的退休计划</div><div class="result-money">${ageText(claim)}办理退休</div><div class="soft">预计 ${date.year}年${date.month}月</div><div class="result-grid"><div class="result-cell"><div class="k">停止工作</div><div class="v">${ageText(stop)}</div></div><div class="result-cell"><div class="k">已缴费</div><div class="v">${monthsText(result.paidMonths)}</div></div><div class="result-cell"><div class="k">未来缴费</div><div class="v">${monthsText(result.futureContributionMonths)}</div></div><div class="result-cell"><div class="k">最低要求</div><div class="v">${monthsText(result.requiredContributionMonths)}</div></div></div></div>
    ${renderContributionStatus(result)}
    ${segments ? `<div class="plain-note section"><strong>未来缴费安排</strong><span>${segments}</span></div>` : ''}
    <div class="card section"><div class="section-heading"><div><span class="section-kicker">待遇估算</span><h2>养老金金额</h2></div></div>${renderAmountBlock(result)}</div>
    ${comparisonRows(result)}
    <div class="card section"><div class="section-heading"><div><span class="section-kicker">时间线</span><h2>你的计划</h2></div></div><div class="timeline modern-timeline">${timelineItem('现在', `已实际缴 ${monthsText(result.paidMonths)}`)}${state.intent === 'normal' ? '' : timelineItem(ageText(stop), '停止工作')}${timelineItem(ageText(claim), `${date.year}年${date.month}月办理退休`)}</div></div>
    <div class="card section source-summary"><p>${PENSION_SCOPE} · 政策版本 ${POLICY_VERSION} · 最终待遇以经办机构核定为准。</p></div>
    <div class="result-actions three-actions"><button class="btn primary" id="editPlanBtn" type="button">调整方案</button><button class="btn secondary" id="homeResultBtn" type="button">返回首页</button><button class="btn ghost" id="newPlanBtn" type="button">清空重算</button></div>`;
  save();
  document.getElementById('editPlanBtn')?.addEventListener('click', () => { state.step = state.intent === 'normal' ? 1 : 2; show('wizard'); renderStep(); });
  document.getElementById('editAmountBtn')?.addEventListener('click', () => { state.step = activeSteps().indexOf('amount'); show('wizard'); renderStep(); });
  document.getElementById('homeResultBtn')?.addEventListener('click', goHome);
  document.getElementById('newPlanBtn')?.addEventListener('click', resetAll);
  show('result');
  window.dispatchEvent(new CustomEvent('yanglao:v4-result', { detail: { amountAvailable: result.amountAvailable, confidence: result.amountConfidence } }));
}

document.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.intent)));
backBtn?.addEventListener('click', () => { if (state.step > 0) { state.step -= 1; renderStep(); } else goHome(); });
nextBtn?.addEventListener('click', () => {
  const error = validateCurrentStep();
  if (error) { showStepError(error); return; }
  showStepError('');
  const steps = activeSteps();
  if (state.step < steps.length - 1) { state.step += 1; renderStep(); }
  else renderResult();
});
document.getElementById('homeBtn')?.addEventListener('click', goHome);
document.getElementById('restartBtn')?.addEventListener('click', resetAll);

const saved = loadSaved();
if (saved) {
  Object.assign(state, saved);
  migrateHistorySegments();
  document.getElementById('resumeBox')?.classList.remove('hidden');
  const resumeText = document.getElementById('resumeText');
  if (resumeText) resumeText.textContent = '上次填写的信息还在，可以继续。';
  document.getElementById('resumeBtn')?.addEventListener('click', () => {
    state.step = Math.max(0, activeSteps().length - 2);
    show('wizard');
    renderStep();
  });
}
