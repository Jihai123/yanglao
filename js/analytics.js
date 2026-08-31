import './launch-polish.js?v=20260830-v5';

const API = '/api/event.php';
const VISITOR_KEY = 'yanglao-v5-visitor';
const SESSION_KEY = 'yanglao-v5-session';
const FLOW_KEY = 'yanglao-v6-flow';
const FLOW_FEATURE_KEY = 'yanglao-v6-flow-feature';
const SOURCE_KEY = 'yanglao-v6-source';
const NORMAL_AMOUNT_FLOW_KEY = 'yanglao-v6-normal-amount-flow';
const APP_VERSION = 'v2-prod-20260831-a2';

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
  // hotfix-v5 temporarily changes the normal pension-amount entry to "flex" so it
  // can reuse the planning-capable engine. The hotfix sets this marker before this
  // listener runs. Analytics must describe what the user actually chose, not the
  // internal compatibility route. A real flex click clears the marker first.
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
  const feature = String(params.feature || params.intent || '').slice(0, 48);
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
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ...payload, ...params, ts: Date.now() });
  window.dispatchEvent(new CustomEvent('yanglao:analytics', { detail: { ...payload, ...params } }));
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

  if (event.target.closest('#nextBtn')) {
    const step = String(document.getElementById('stepBody')?.dataset.step || '');
    track('wizard_next', { feature: currentFlowFeature(), step });
    setTimeout(recordVisibleStep, 0);
  }

  if (event.target.closest('#residentNext')) {
    const step = visibleResidentStep();
    track('wizard_next', { feature: 'resident', step });
    setTimeout(recordResidentStep, 0);
  }

  if (event.target.closest('#backBtn')) setTimeout(recordVisibleStep, 0);
  if (event.target.closest('#residentBack')) setTimeout(recordResidentStep, 0);
  if (event.target.closest('#homeBtn, #homeResultBtn')) track('home_click', { feature: 'home' });
}, { capture: true });

window.addEventListener('yanglao:v4-result', event => {
  const detail = event.detail || {};
  track('result_view', { feature: detail.amountAvailable ? 'amount' : 'qualification', step: 'result' });
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

window.addEventListener('error', () => {
  track('client_error', { feature: 'javascript', step: visibleStep() || visibleResidentStep() });
});

window.addEventListener('unhandledrejection', () => {
  track('client_error', { feature: 'promise', step: visibleStep() || visibleResidentStep() });
});

track('page_view', { feature: 'home' });
