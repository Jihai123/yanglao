import {
  POLICY_VERSION,
  PENSION_SCOPE,
  ageText,
  calcStatutoryRetirement,
  claimDateFromAge,
  parseMonth,
} from './policy.js';
import { projectPlanV3 } from './projection-v3.js';

const STORAGE_KEY = 'yanglao-v3-plan';
const nowDate = new Date();
const NOW = { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 };

const state = {
  intent: 'early', step: 0,
  birth: '1983-01', sex: 'male', femaleCategory: 'worker50', category: 'base60',
  paidYears: 18, paidMonthsExtra: 0,
  knowsAccount: false, currentAccount: '',
  stopWorkAge: 50,
  retirementMode: 'statutory', retirementOffsetMonths: 12,
  contributionPlan: 'continuous_to_claim', actualFutureYears: 5, actualFutureMonthsExtra: 0,
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
function money(n) {
  if (!Number.isFinite(Number(n))) return '—';
  return `¥${Math.round(Number(n)).toLocaleString('zh-CN')}`;
}
function monthsText(months) {
  const total = Math.max(0, Math.round(Number(months) || 0));
  const y = Math.floor(total / 12); const m = total % 12;
  if (y && m) return `${y}年${m}个月`;
  if (y) return `${y}年`;
  return `${m}个月`;
}
function currentAgeMonths() {
  const b = parseMonth(state.birth);
  return (NOW.year * 12 + NOW.month - 1) - (b.year * 12 + b.month - 1);
}
function paidMonths() {
  return Math.max(0, Math.round(Number(state.paidYears || 0) * 12 + Number(state.paidMonthsExtra || 0)));
}
function mapCategory() {
  if (state.sex === 'male') return 'base60';
  if (state.femaleCategory === 'worker50') return 'base50';
  if (state.femaleCategory === 'manager55') return 'base55';
  return null;
}
function retirement(category = mapCategory()) {
  if (!category) return null;
  return calcStatutoryRetirement(state.birth, category);
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
function futureContributionMonths(category = mapCategory()) {
  const claim = claimAgeMonths(category);
  if (!claim) return 0;
  const current = currentAgeMonths();
  if (state.intent === 'normal' || state.contributionPlan === 'continuous_to_claim') return Math.max(0, claim - current);
  if (state.contributionPlan === 'stop_with_work') return Math.max(0, Math.min(claim, stopWorkAgeMonths(category)) - current);
  return Math.max(0, Math.round(Number(state.actualFutureYears || 0) * 12 + Number(state.actualFutureMonthsExtra || 0)));
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
  return {
    ...state, category, now: NOW,
    paidMonths: paidMonths(), claimAgeMonths: claimAgeMonths(category), futureContributionMonths: futureContributionMonths(category),
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
  const ageNowYears = Math.max(0, currentAgeMonths() / 12);
  if (intent === 'normal') state.contributionPlan = 'continuous_to_claim';
  else if (intent === 'flex') {
    state.stopWorkAge = Math.max(Math.ceil(ageNowYears), 18); state.contributionPlan = 'actual_months'; state.actualFutureYears = 5; state.actualFutureMonthsExtra = 0;
  } else if (intent === 'early') {
    state.stopWorkAge = Math.max(Math.ceil(ageNowYears + 1), Math.min(50, Math.ceil(ageNowYears + 5))); state.contributionPlan = 'continuous_to_claim';
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
  window.dispatchEvent(new CustomEvent('yanglao:step-rendered', { detail: { step: key, intent: state.intent } }));
}

function renderIdentity() {
  stepTitle.textContent = '先确认最基本的信息';
  stepDesc.textContent = '出生年月决定渐进式退休时间；男性可直接判断，女性还需要确认原退休年龄口径。';
  stepBody.innerHTML = `
    <div class="field"><label>出生年月</label><input class="mobile-safe-input" data-key="birth" type="month" value="${state.birth}"></div>
    <div class="field"><label>性别</label><div class="segment">
      <button type="button" data-sex="male" class="${state.sex === 'male' ? 'active' : ''}">男</button>
      <button type="button" data-sex="female" class="${state.sex === 'female' ? 'active' : ''}">女</button>
    </div></div>
    ${state.sex === 'female' ? `<div class="field"><label>退休前主要属于哪种情况？</label><div class="choice-stack compact-choices">
      <button type="button" class="choice ${state.femaleCategory === 'worker50' ? 'active' : ''}" data-female-category="worker50"><strong>普通女职工</strong><span>通常对应原50周岁退休口径</span></button>
      <button type="button" class="choice ${state.femaleCategory === 'manager55' ? 'active' : ''}" data-female-category="manager55"><strong>管理 / 技术等岗位</strong><span>通常对应原55周岁退休口径</span></button>
      <button type="button" class="choice ${state.femaleCategory === 'unsure' ? 'active' : ''}" data-female-category="unsure"><strong>不确定 / 身份变化过</strong><span>不强行替你猜，先显示可能范围</span></button>
    </div><div class="help">女性原50岁或55岁口径不能只靠出生年月推断。最终以本人参保、档案及参保地经办认定为准。</div></div>` : `<div class="plain-note"><strong>男性无需再选退休类别</strong><span>系统按原60周岁人员口径自动计算渐进式法定退休年龄。</span></div>`}`;
  stepBody.querySelectorAll('[data-sex]').forEach(btn => btn.addEventListener('click', () => { state.sex = btn.dataset.sex; renderStep(); }));
  stepBody.querySelectorAll('[data-female-category]').forEach(btn => btn.addEventListener('click', () => { state.femaleCategory = btn.dataset.femaleCategory; renderStep(); }));
}

function renderStatus() {
  stepTitle.textContent = '你实际已经缴了多久？';
  stepDesc.textContent = '这里填累计实际缴费月数。以前中间断缴过没关系，断缴月份本来就不算在累计缴费里。';
  stepBody.innerHTML = `
    <div class="field"><label>累计缴费年限</label><div class="number-pair">
      <div><input data-key="paidYears" type="number" min="0" step="1" value="${state.paidYears}"><span>年</span></div>
      <div><input data-key="paidMonthsExtra" type="number" min="0" max="11" step="1" value="${state.paidMonthsExtra}"><span>个月</span></div>
    </div><div class="help">例如权益记录显示222个月，可以填18年6个月。不要用“参加工作多少年”代替实际缴费年限。</div></div>
    <div class="field"><label>个人账户累计储存额</label><div class="segment">
      <button type="button" data-account="known" class="${state.knowsAccount ? 'active' : ''}">我知道</button>
      <button type="button" data-account="unknown" class="${!state.knowsAccount ? 'active' : ''}">暂时不知道</button>
    </div></div>
    ${state.knowsAccount ? `<div class="field"><label>个人账户余额（元）</label><input data-key="currentAccount" type="number" min="0" step="100" value="${state.currentAccount}"></div>` : `<div class="plain-note"><strong>不知道也能继续</strong><span>但信息不足时，系统可能不输出养老金金额，避免给一个2000～4000这种没有决策意义的大区间。</span></div>`}`;
  stepBody.querySelectorAll('[data-account]').forEach(btn => btn.addEventListener('click', () => { state.knowsAccount = btn.dataset.account === 'known'; renderStep(); }));
}

function retirementModeChoices(r) {
  return `<div class="choice-stack">
    <button type="button" class="choice ${state.retirementMode === 'statutory' ? 'active' : ''}" data-retirement-mode="statutory"><strong>按法定退休年龄办理</strong><span>默认推荐 · ${ageText(r.statutoryAgeMonths)}</span></button>
    <button type="button" class="choice ${state.retirementMode === 'early' ? 'active' : ''}" data-retirement-mode="early"><strong>我想看看能否提前退休</strong><span>最早不低于 ${ageText(r.earliestAgeMonths)}，还要满足对应最低缴费年限</span></button>
    <button type="button" class="choice ${state.retirementMode === 'delayed' ? 'active' : ''}" data-retirement-mode="delayed"><strong>我考虑延迟退休</strong><span>最晚到 ${ageText(r.latestAgeMonths)}；单位职工通常还需与单位协商一致</span></button>
  </div>`;
}
function renderPlan() {
  const r = retirement(); const claim = claimAgeMonths();
  stepTitle.textContent = state.intent === 'flex' ? '把未来缴费计划说清楚' : '你准备什么时候停止工作？';
  stepDesc.textContent = '停止工作、实际缴了多少个月、什么时候办理退休分开计算，不再默认“年龄过了几年=社保缴了几年”。';
  stepBody.innerHTML = `
    <div class="field"><label>${state.intent === 'flex' ? '从几岁起按“已离职 / 不再固定上班”规划？' : '计划几岁停止工作？'}</label><input data-key="stopWorkAge" type="number" min="${Math.floor(currentAgeMonths()/12)}" max="80" step="1" value="${state.stopWorkAge}"></div>
    <div class="field"><label>退休时间按哪种方式规划？</label>${retirementModeChoices(r)}</div>
    ${state.retirementMode !== 'statutory' ? `<div class="field"><label>${state.retirementMode === 'early' ? '提前多久做规划' : '延后多久做规划'}</label><div class="segment segment-three">${[12,24,36].map(m => `<button type="button" data-retirement-offset="${m}" class="${Number(state.retirementOffsetMonths) === m ? 'active' : ''}">${m/12}年</button>`).join('')}</div><div class="help">先按1/2/3年规划档位比较，不把几十个月份全部丢给你选。正式办理仍按实际月份和经办规则核定。</div></div>` : ''}
    <div class="field"><label>从现在到退休，养老保险准备怎么缴？</label><div class="choice-stack">
      <button type="button" class="choice ${state.contributionPlan === 'continuous_to_claim' ? 'active' : ''}" data-contribution-plan="continuous_to_claim"><strong>从现在起连续缴到办理退休</strong><span>适合预计持续参保的人</span></button>
      <button type="button" class="choice ${state.contributionPlan === 'stop_with_work' ? 'active' : ''}" data-contribution-plan="stop_with_work"><strong>停止工作时就停止缴费</strong><span>只计算停止工作前实际连续缴的月份</span></button>
      <button type="button" class="choice ${state.contributionPlan === 'actual_months' ? 'active' : ''}" data-contribution-plan="actual_months"><strong>中间可能断缴，我直接填未来实际还会缴多久</strong><span>最适合工作不连续、灵活就业或计划有空档的人</span></button>
    </div></div>
    ${state.contributionPlan === 'actual_months' ? `<div class="field"><label>预计未来累计还会实际缴费</label><div class="number-pair"><div><input data-key="actualFutureYears" type="number" min="0" step="1" value="${state.actualFutureYears}"><span>年</span></div><div><input data-key="actualFutureMonthsExtra" type="number" min="0" max="11" step="1" value="${state.actualFutureMonthsExtra}"><span>个月</span></div></div><div class="help">这不是“几年后到几岁”，而是未来真正缴费的累计月数。中间停过几个月不会被算成缴费。</div></div>` : ''}
    <div class="plan-preview"><span>当前规划</span><strong>${ageText(claim)}办理退休 · 未来预计实际缴 ${monthsText(futureContributionMonths())}</strong></div>`;
  stepBody.querySelectorAll('[data-retirement-mode]').forEach(btn => btn.addEventListener('click', () => { state.retirementMode = btn.dataset.retirementMode; renderStep(); }));
  stepBody.querySelectorAll('[data-retirement-offset]').forEach(btn => btn.addEventListener('click', () => { state.retirementOffsetMonths = Number(btn.dataset.retirementOffset); renderStep(); }));
  stepBody.querySelectorAll('[data-contribution-plan]').forEach(btn => btn.addEventListener('click', () => { state.contributionPlan = btn.dataset.contributionPlan; renderStep(); }));
}

function renderAmount() {
  stepTitle.textContent = '想估养老金，再补一点信息';
  stepDesc.textContent = '金额信息不够时，系统宁可不报数字，也不再给一个跨度一倍的“大概区间”。';
  stepBody.innerHTML = `
    <div class="field"><label>这次要不要估养老金金额？</label><div class="segment">
      <button type="button" data-amount-mode="estimate" class="${state.amountMode === 'estimate' ? 'active' : ''}">估算金额</button>
      <button type="button" data-amount-mode="skip" class="${state.amountMode === 'skip' ? 'active' : ''}">先只看资格</button>
    </div></div>
    ${state.amountMode === 'skip' ? `<div class="plain-note"><strong>本次只算退休资格和缴费计划</strong><span>退休年龄、最低缴费年限、还差多少实际缴费月数照常计算；养老金金额暂不输出。</span></div>` : `
      <div class="field"><label>你现在养老保险月缴费基数大约多少？</label><input data-key="monthlyContributionBase" type="number" min="0" step="100" value="${state.monthlyContributionBase}"><div class="help">填社保系统里的“缴费基数”，不是每个月个人实际扣了多少钱。</div></div>
      <div class="field"><label>过去这些年的缴费水平，大致是哪种情况？</label><div class="choice-stack compact-choices">
        <button type="button" class="choice ${state.historyPattern === 'low' ? 'active' : ''}" data-history="low"><strong>大多数年份偏低档</strong><span>规划时暂按约60%水平做敏感性估算</span></button>
        <button type="button" class="choice ${state.historyPattern === 'average' ? 'active' : ''}" data-history="average"><strong>大多数年份接近当地平均水平</strong><span>规划时暂按约100%水平估算</span></button>
        <button type="button" class="choice ${state.historyPattern === 'high' ? 'active' : ''}" data-history="high"><strong>大多数年份明显高于当地平均水平</strong><span>规划时暂按约150%水平估算</span></button>
        <button type="button" class="choice ${state.historyPattern === 'variable' ? 'active' : ''}" data-history="variable"><strong>变化很大 / 我说不准</strong><span>不硬猜平均缴费指数，金额结果可能暂不输出</span></button>
        <button type="button" class="choice ${state.historyPattern === 'exact' ? 'active' : ''}" data-history="exact"><strong>我知道本人平均缴费工资指数</strong><span>直接填写专业参数，适合有权益记录或官方测算数据的人</span></button>
      </div><div class="help">比如前5年按3000、后来按5000、再后来按20000，仅凭这三个工资数字不能准确算职业生涯平均指数，还需要对应年份当地工资基准。本版不会把它们简单平均后冒充准确结果。</div></div>
      ${state.historyPattern === 'exact' ? `<div class="field"><label>本人平均缴费工资指数</label><input data-key="avgIndex" type="number" min="0.3" max="3" step="0.01" value="${state.avgIndex}"></div>` : ''}
      <details class="disclosure"><summary>我有当地计发参数，手动补充</summary><div class="form-stack detail-stack"><div class="field"><label>当地最新养老金计发基准（月，元）</label><input data-key="currentCalcBase" type="number" min="0" step="1" value="${state.currentCalcBase}"><div class="help">有官方地区参数时，页面会提示并可自动带入；没有来源时不要随便填。</div></div></div></details>`}`;
  stepBody.querySelectorAll('[data-amount-mode]').forEach(btn => btn.addEventListener('click', () => { state.amountMode = btn.dataset.amountMode; renderStep(); }));
  stepBody.querySelectorAll('[data-history]').forEach(btn => btn.addEventListener('click', () => { state.historyPattern = btn.dataset.history; renderStep(); }));
}

function bindBasicFields() {
  stepBody.querySelectorAll('[data-key]').forEach(el => el.addEventListener('change', () => {
    const key = el.dataset.key;
    let value = el.value;
    if (['paidYears','paidMonthsExtra','currentAccount','stopWorkAge','actualFutureYears','actualFutureMonthsExtra','monthlyContributionBase','avgIndex','currentCalcBase'].includes(key)) value = Number(value);
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
      if (state.sex === 'female' && state.femaleCategory === 'unsure' && state.intent !== 'age') return '女性原50岁/55岁退休口径不能只靠年龄推断。请先选择更符合你的情况的一项；如果确实不确定，可以先用“我什么时候能退休”查看两种可能。';
      const category = mapCategory(); if (category) calcStatutoryRetirement(state.birth, category);
    }
    if (key === 'status') {
      if (!(Number(state.paidYears) >= 0)) return '请填写有效的累计缴费年数。';
      if (!(Number(state.paidMonthsExtra) >= 0 && Number(state.paidMonthsExtra) <= 11)) return '累计缴费月数请填写0到11。';
      if (paidMonths() > currentAgeMonths() + 12) return '累计实际缴费月数明显超过当前年龄，请检查输入。';
      if (state.knowsAccount && !(Number(state.currentAccount) >= 0)) return '请填写有效的个人账户余额。';
    }
    if (key === 'plan') {
      const claim = claimAgeMonths(); const stop = stopWorkAgeMonths();
      if (!(Number(state.stopWorkAge) >= currentAgeMonths()/12)) return '停止工作年龄不能早于当前年龄。';
      if (stop > claim) return '当前规划里停止工作年龄晚于办理退休年龄，请调整其中一个。';
      if (state.contributionPlan === 'actual_months' && futureContributionMonths() > Math.max(0, claim - currentAgeMonths())) return '未来实际缴费月数不能超过从现在到计划退休的总月份。';
    }
    if (key === 'amount' && state.amountMode === 'estimate') {
      if (!(Number(state.monthlyContributionBase) > 0)) return '请填写当前养老保险月缴费基数，或者选择“先只看资格”。';
      if (state.historyPattern === 'exact' && !(Number(state.avgIndex) >= 0.3 && Number(state.avgIndex) <= 3)) return '请填写0.3到3之间的平均缴费工资指数。';
    }
  } catch (error) { return error.message || '输入有误，请检查后继续。'; }
  return '';
}

function renderAgeResultForCategory(category, label) {
  const r = retirement(category); const date = claimDateFromAge(state.birth, r.statutoryAgeMonths);
  return `<div class="age-result-card"><span>${label}</span><strong>${ageText(r.statutoryAgeMonths)}</strong><em>预计 ${date.year}年${date.month}月</em></div>`;
}
function renderAgeResult() {
  let main;
  if (state.sex === 'female' && state.femaleCategory === 'unsure') {
    main = `<div class="result-hero clean-result"><div class="soft">女性退休口径尚未确定</div><div class="result-money">先看两种可能</div><div class="soft">不根据年龄强行替你猜50岁还是55岁口径</div></div><div class="dual-age-grid">${renderAgeResultForCategory('base50','如果属于原50岁口径')}${renderAgeResultForCategory('base55','如果属于原55岁口径')}</div><div class="plain-note section"><strong>怎么确认？</strong><span>可查看个人档案、单位/社保经办记录，或咨询参保地人社经办机构。确认后再做养老金金额规划更可靠。</span></div>`;
  } else {
    const category = mapCategory(); const r = retirement(category); const d = claimDateFromAge(state.birth, r.statutoryAgeMonths);
    main = `<div class="result-hero clean-result"><div class="soft">你的法定退休年龄</div><div class="result-money">${ageText(r.statutoryAgeMonths)}</div><div class="soft">预计 ${d.year}年${d.month}月</div></div><div class="card section"><h2>如果考虑弹性退休</h2><div class="simple-facts"><div><span>最早弹性退休</span><strong>${ageText(r.earliestAgeMonths)}</strong></div><div><span>法定退休</span><strong>${ageText(r.statutoryAgeMonths)}</strong></div><div><span>最晚弹性退休</span><strong>${ageText(r.latestAgeMonths)}</strong></div></div><p class="muted compact-copy">提前退休还要满足对应最低缴费年限；延迟退休对单位职工通常需要与单位协商一致。这里展示政策边界，不要求你从几十个月份里任选一个。</p></div>`;
  }
  resultView.innerHTML = `${main}<div class="result-actions"><button class="btn primary" id="continuePlanBtn" type="button">继续算退休计划</button><button class="btn secondary" id="newPlanBtn" type="button">重新查询</button></div>`;
  save();
  document.getElementById('continuePlanBtn')?.addEventListener('click', () => {
    if (state.sex === 'female' && state.femaleCategory === 'unsure') { show('wizard'); state.step = 0; renderStep(); return; }
    state.intent = 'normal'; state.step = 1; state.contributionPlan = 'continuous_to_claim'; state.retirementMode = 'statutory'; show('wizard'); renderStep();
  });
  document.getElementById('newPlanBtn')?.addEventListener('click', resetAll); show('result');
}
function continuousQualificationAge(result) { return result.currentAgeMonths + result.remainingActualContributionMonths; }
function renderContributionStatus(result) {
  const required = monthsText(result.requiredContributionMonths), paid = monthsText(result.paidMonths), future = monthsText(result.futureContributionMonths);
  if (result.eligible) return `<div class="decision-card decision-good"><span class="decision-label">缴费资格</span><strong>按当前计划，最低缴费年限可以满足</strong><p>最低要求 ${required}；你已经实际缴 ${paid}，未来计划再实际缴 ${future}。这里按“实际缴费月数”累计，不把断缴期间算进去。</p></div>`;
  return `<div class="decision-card decision-danger"><span class="decision-label">缴费资格</span><strong>当前未来缴费计划还不够</strong><p>最低要求 ${required}；你已经实际缴 ${paid}，从今天起还需要累计实际缴 <strong>${monthsText(result.remainingActualContributionMonths)}</strong>。按当前计划，到退休时仍会少约 <strong>${monthsText(result.plannedContributionShortageMonths)}</strong>。</p><p>如果从现在开始连续缴费，约到 <strong>${ageText(continuousQualificationAge(result))}</strong> 可累计够最低年限；中间如果断缴，达到时间会相应顺延。</p></div>`;
}
function renderAmountBlock(result) {
  if (state.amountMode === 'skip') return `<div class="amount-decision"><span>养老金金额</span><strong>本次先不估</strong><p>资格与缴费计划仍按政策规则计算。</p></div>`;
  if (!result.amountAvailable) return `<div class="amount-decision amount-muted"><span>养老金金额</span><strong>当前信息不足，先不报数字</strong><p>${result.amountMissingReasons.join('；')}。继续给一个跨度很大的区间没有实际意义。</p><button type="button" class="small-link inline-action" id="editAmountBtn">补充金额信息 →</button></div>`;
  return `<div class="amount-decision amount-good"><span>预计每月养老金</span><strong>约 ${money(result.pensionCenter)}</strong><p>按当前假设，合理波动约 ${money(result.pensionLow)}～${money(result.pensionHigh)} / 月 · 可信度：${result.amountConfidence}</p></div>`;
}
function timelineItem(title, sub) { return `<div class="tl-item"><div class="dot-wrap"><span class="dot"></span></div><div class="tl-content"><strong>${title}</strong><span>${sub}</span></div></div>`; }
function renderResult() {
  if (state.intent === 'age') return renderAgeResult();
  const category = mapCategory(); const result = projectPlanV3(calculationInput(category)); const stop = stopWorkAgeMonths(category); const claim = claimAgeMonths(category); const d = result.claimDate;
  resultView.innerHTML = `<div class="result-hero clean-result"><div class="soft">你的退休计划</div><div class="result-money">${ageText(claim)}办理退休</div><div class="soft">预计 ${d.year}年${d.month}月</div><div class="result-grid"><div class="result-cell"><div class="k">停止工作</div><div class="v">${ageText(stop)}</div></div><div class="result-cell"><div class="k">已实际缴费</div><div class="v">${monthsText(result.paidMonths)}</div></div><div class="result-cell"><div class="k">未来计划实际缴</div><div class="v">${monthsText(result.futureContributionMonths)}</div></div><div class="result-cell"><div class="k">最低缴费要求</div><div class="v">${monthsText(result.requiredContributionMonths)}</div></div></div></div>
    ${renderContributionStatus(result)}
    <div class="card section"><h2>养老金金额</h2>${renderAmountBlock(result)}</div>
    <div class="card section"><h2>你的时间线</h2><div class="timeline modern-timeline">${timelineItem('现在', `${ageText(result.currentAgeMonths)} · 已实际缴 ${monthsText(result.paidMonths)}`)}${state.intent === 'normal' ? '' : timelineItem(ageText(stop), '计划停止工作')}${timelineItem(ageText(claim), `${d.year}年${d.month}月按当前方案办理退休`)}</div>${state.contributionPlan === 'actual_months' ? `<div class="plain-note"><strong>未来缴费按累计月数计算</strong><span>你填写的是未来实际还会缴 ${monthsText(result.futureContributionMonths)}；中间可以有断缴，资格判断不会把断缴月份算进去。金额估算对缴费发生时间采用分散分布假设。</span></div>` : ''}</div>
    <div class="card section"><h2>这次结果怎么理解</h2><div class="simple-facts"><div><span>退休年龄</span><strong>国家现行规则</strong></div><div><span>最低缴费年限</span><strong>${result.minYears}年 · 参考年份${result.minYearsReferenceYear}</strong></div><div><span>养老金金额</span><strong>${result.amountAvailable ? result.amountConfidence : '未输出无意义大区间'}</strong></div></div><p class="source-box compact-copy">适用范围：${PENSION_SCOPE}。政策版本：${POLICY_VERSION}。金额属于规划估算，不替代参保地经办机构最终待遇核定。</p></div>
    <div class="result-actions"><button class="btn primary" id="editPlanBtn" type="button">调整方案</button><button class="btn secondary" id="newPlanBtn" type="button">重新规划</button></div>`;
  save();
  document.getElementById('editPlanBtn')?.addEventListener('click', () => { state.step = state.intent === 'normal' ? 1 : 2; show('wizard'); renderStep(); });
  document.getElementById('editAmountBtn')?.addEventListener('click', () => { state.step = activeSteps().indexOf('amount'); show('wizard'); renderStep(); });
  document.getElementById('newPlanBtn')?.addEventListener('click', resetAll); show('result');
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'employee_result_v3', intent: state.intent, eligible: result.eligible, amount_available: result.amountAvailable } }));
}
function resetAll() { localStorage.removeItem(STORAGE_KEY); location.reload(); }

document.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.intent)));
backBtn?.addEventListener('click', () => { if (state.step > 0) { state.step -= 1; renderStep(); } });
nextBtn?.addEventListener('click', () => {
  const error = validateCurrentStep(); if (error) { showStepError(error); return; }
  showStepError(''); const steps = activeSteps(); if (state.step < steps.length - 1) { state.step += 1; renderStep(); } else renderResult();
});
document.getElementById('restartBtn')?.addEventListener('click', resetAll);

const saved = loadSaved();
if (saved) {
  Object.assign(state, saved);
  document.getElementById('resumeBox')?.classList.remove('hidden');
  const resumeText = document.getElementById('resumeText'); if (resumeText) resumeText.textContent = '上次的退休规划还在，可以继续调整。';
  document.getElementById('resumeBtn')?.addEventListener('click', () => { state.step = Math.max(0, activeSteps().length - 2); show('wizard'); renderStep(); });
}
