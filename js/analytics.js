import './launch-polish.js?v=20260830-v5';

const API = '/api/event.php';
const VISITOR_KEY = 'yanglao-v5-visitor';
const SESSION_KEY = 'yanglao-v5-session';
const FLOW_KEY = 'yanglao-v6-flow';
const FLOW_FEATURE_KEY = 'yanglao-v6-flow-feature';
const SOURCE_KEY = 'yanglao-v6-source';
const NORMAL_AMOUNT_FLOW_KEY = 'yanglao-v6-normal-amount-flow';
const APP_VERSION = 'v2-prod-20260902-d2';

let volatileVisitor = '';
let volatileSession = '';
let volatileFlow = '';
let volatileFlowFeature = '';
let volatileSource = '';
let lastStepToken = '';

function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function safeGet(storage, key) {
  try { return storage.getItem(key) || ''; } catch { return ''; }
}

function safeSet(storage, key, value) {
  try { storage.setItem(key, value); } catch {}
}

function visitorId() {
  let id = safeGet(localStorage, VISITOR_KEY) || volatileVisitor;
  if (!id) {
    id = randomId('v');
    volatileVisitor = id;
    safeSet(localStorage, VISITOR_KEY, id);
  }
  return id;
}

function sessionId() {
  let id = safeGet(sessionStorage, SESSION_KEY) || volatileSession;
  if (!id) {
    id = randomId('s');
    volatileSession = id;
    safeSet(sessionStorage, SESSION_KEY, id);
  }
  return id;
}

function normalizeSource(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return '';
  if (text.includes('baidu')) return 'baidu';
  if (text.includes('google')) return 'google';
  if (text.includes('bing')) return 'bing';
  if (text.includes('sogou')) return 'sogou';
  if (text === '360' || text.includes('so.com') || text.includes('haosou')) return '360';
  if (text.includes('zhihu')) return 'zhihu';
  if (text.includes('weixin') || text.includes('wechat')) return 'wechat';
  return 'other';
}

function detectSource() {
  const params = new URLSearchParams(location.search);
  const campaign = normalizeSource(params.get('utm_source'));
  if (campaign) return campaign;

  const referrer = String(document.referrer || '');
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === location.hostname.toLowerCase()) return 'internal';
    return normalizeSource(host) || 'other';
  } catch {
    return 'other';
  }
}

function trafficSource() {
  let source = safeGet(sessionStorage, SOURCE_KEY) || volatileSource;
  if (!source) {
    source = detectSource();
    volatileSource = source;
    safeSet(sessionStorage, SOURCE_KEY, source);
  }
  return source;
}

function deviceType() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile ? 'mobile' : 'desktop';
  }
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

function currentFlowId() {
  return safeGet(sessionStorage, FLOW_KEY) || volatileFlow;
}

function currentFlowFeature() {
  return safeGet(sessionStorage, FLOW_FEATURE_KEY) || volatileFlowFeature;
}

function setFlow(id, feature) {
  volatileFlow = id;
  volatileFlowFeature = feature;
  safeSet(sessionStorage, FLOW_KEY, id);
  safeSet(sessionStorage, FLOW_FEATURE_KEY, feature);
}

function userFacingIntent(internalIntent) {
  const intent = String(internalIntent || 'unknown');
  if (intent === 'flex' && safeGet(localStorage, NORMAL_AMOUNT_FLOW_KEY) === '1') return 'normal';
  return intent;
}

function send(payload) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(API, blob)) return;
  }
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function track(event, params = {}) {
  const feature = String(params.feature || params.intent || currentFlowFeature() || '').slice(0, 48);
  const step = String(params.step || '').slice(0, 48);
  const payload = {
    event,
    feature,
    step,
    visitor_id: visitorId(),
    session_id: sessionId(),
    flow_id: currentFlowId(),
    source: trafficSource(),
    device: deviceType(),
    page: location.pathname,
    app_version: APP_VERSION,
    reason_code: String(params.reason_code || '').slice(0, 48),
    error_type: String(params.error_type || '').slice(0, 32),
    script_name: String(params.script_name || '').slice(0, 96),
    line_no: Math.max(0, Number(params.line_no) || 0),
    column_no: Math.max(0, Number(params.column_no) || 0),
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ...payload, ts: Date.now() });
  window.dispatchEvent(new CustomEvent('yanglao:analytics', { detail: payload }));
  send(payload);
  return payload;
}

function startFlow(feature) {
  const cleanFeature = String(feature || 'unknown').slice(0, 48);
  const id = randomId('f');
  setFlow(id, cleanFeature);
  lastStepToken = '';
  track('flow_start', { feature: cleanFeature });
  return id;
}

function visibleStep() {
  const wizard = document.getElementById('wizardView');
  if (!wizard || wizard.classList.contains('hidden')) return '';
  return String(document.getElementById('stepBody')?.dataset.step || '');
}

function visibleResidentStep() {
  const resident = document.getElementById('residentView');
  if (!resident || resident.classList.contains('hidden')) return '';
  const text = String(resident.querySelector('.step-kicker')?.textContent || '');
  const match = text.match(/第\s*(\d+)\s*\/\s*3\s*步/);
  if (!match) return '';
  return ({ 1: 'identity', 2: 'amount', 3: 'local' })[Number(match[1])] || '';
}

function recordStep(step) {
  const flow = currentFlowId();
  if (!flow || !step) return;
  const token = `${flow}:${step}`;
  if (token === lastStepToken) return;
  lastStepToken = token;
  track('step_view', { feature: currentFlowFeature(), step });
}

function recordVisibleStep() {
  recordStep(visibleStep());
}

function recordResidentStep() {
  if (currentFlowFeature() !== 'resident') return;
  recordStep(visibleResidentStep());
}

function validationReason(message) {
  const text = String(message || '');
  if (!text) return '';
  if (text.includes('出生年月不能晚于当前月份') || text.includes('出生年月')) return 'invalid_birth';
  if (text.includes('女性退休口径不确定')) return 'uncertain_female_category';
  if (text.includes('累计缴费年数') || text.includes('累计缴费年限')) return 'invalid_paid_years';
  if (text.includes('累计缴费月数')) return 'invalid_paid_months';
  if (text.includes('个人账户余额')) return 'missing_account';
  if (text.includes('视同缴费月数')) return 'invalid_deemed_months';
  if (text.includes('停止工作年龄不能早于')) return 'invalid_stop_age';
  if (text.includes('停止工作年龄不能晚于')) return 'stop_after_retirement';
  if (text.includes('缴费时间超过了到退休前')) return 'future_months_exceed_window';
  if (text.includes('现在的养老保险月缴费基数')) return 'missing_current_base';
  if (text.includes('灵活就业缴费基数') || text.includes('未来灵活就业月缴费基数')) return 'missing_flex_base';
  if (text.includes('开始、结束年月填完整') || text.includes('至少填写一段历史缴费')) return 'history_incomplete';
  if (text.includes('历史缴费结束年月不能早于')) return 'history_invalid_range';
  if (text.includes('历史缴费结束年月不能晚于')) return 'history_future_range';
  if (text.includes('每一段的月缴费基数')) return 'history_missing_base';
  if (text.includes('历史缴费时间段不能重叠')) return 'history_overlap';
  if (text.includes('历史分段合计')) return 'history_mismatch';
  if (text.includes('平均缴费工资指数')) return 'invalid_avg_index';
  if (text.includes('计发基准')) return 'missing_calc_base';
  if (text.includes('视同缴费年限') && text.includes('过渡性养老金')) return 'missing_transition_info';
  if (text.includes('年度缴费金额')) return 'invalid_resident_contribution';
  if (text.includes('未来缴费年数')) return 'invalid_resident_future_years';
  return 'invalid_input';
}

function recordValidationError(resident = false) {
  const node = resident ? document.getElementById('residentError') : document.getElementById('stepError');
  if (!node || node.classList.contains('hidden')) return;
  const reason = validationReason(node.textContent);
  if (!reason) return;
  track('validation_error', {
    feature: resident ? 'resident' : currentFlowFeature(),
    step: resident ? visibleResidentStep() : visibleStep(),
    reason_code: reason,
  });
}

function safeScriptName(filename) {
  if (!filename) return '';
  try {
    const path = new URL(filename, location.href).pathname;
    return path.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

const stepBody = document.getElementById('stepBody');
if (stepBody && window.MutationObserver) {
  new MutationObserver(recordVisibleStep).observe(stepBody, {
    attributes: true,
    attributeFilter: ['data-step'],
  });
}

const residentView = document.getElementById('residentView');
if (residentView && window.MutationObserver) {
  new MutationObserver(recordResidentStep).observe(residentView, {
    childList: true,
    subtree: true,
  });
}

document.addEventListener('click', event => {
  const intent = event.target.closest('[data-intent]');
  if (intent) {
    const feature = userFacingIntent(intent.dataset.intent);
    startFlow(feature);
    track('intent_click', { feature });
    setTimeout(recordVisibleStep, 0);
  }

  if (event.target.closest('#residentEntry')) {
    startFlow('resident');
    track('intent_click', { feature: 'resident' });
    setTimeout(recordResidentStep, 0);
  }

  if (event.target.closest('#resumeBtn')) {
    startFlow('resume');
    track('resume_plan', { feature: 'resume' });
    setTimeout(recordVisibleStep, 0);
  }

  if (event.target.closest('#continuePlanBtn')) {
    startFlow('normal');
    track('intent_click', { feature: 'normal' });
    setTimeout(recordVisibleStep, 0);
  }

  if (event.target.closest('#nextBtn')) {
    const step = String(document.getElementById('stepBody')?.dataset.step || '');
    track('wizard_next', { feature: currentFlowFeature(), step });
    setTimeout(() => { recordVisibleStep(); recordValidationError(false); }, 0);
  }

  if (event.target.closest('#residentNext')) {
    const step = visibleResidentStep();
    track('wizard_next', { feature: 'resident', step });
    setTimeout(() => { recordResidentStep(); recordValidationError(true); }, 0);
  }

  if (event.target.closest('#backBtn')) setTimeout(recordVisibleStep, 0);
  if (event.target.closest('#residentBack')) setTimeout(recordResidentStep, 0);
  if (event.target.closest('#homeBtn, #homeResultBtn')) track('home_click', { feature: 'home' });
}, { capture: true });

window.addEventListener('yanglao:v4-result', () => {
  track('result_view', { feature: currentFlowFeature(), step: 'result' });
});

window.addEventListener('yanglao:track', event => {
  const detail = event.detail || {};
  const { event: name, ...params } = detail;
  if (!name) return;
  if (name === 'resident_result') {
    track('result_view', { feature: 'resident', step: 'result' });
    return;
  }
  track(name, params);
});

window.addEventListener('error', event => {
  track('client_error', {
    feature: currentFlowFeature() || 'unknown',
    step: visibleStep() || visibleResidentStep(),
    error_type: 'javascript_error',
    script_name: safeScriptName(event.filename),
    line_no: event.lineno,
    column_no: event.colno,
  });
});

window.addEventListener('unhandledrejection', () => {
  track('client_error', {
    feature: currentFlowFeature() || 'unknown',
    step: visibleStep() || visibleResidentStep(),
    error_type: 'unhandled_rejection',
  });
});

track('page_view', { feature: 'home' });
