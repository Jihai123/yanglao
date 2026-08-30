import './launch-polish.js?v=20260830-v5';

const API = './api/event.php';
const VISITOR_KEY = 'yanglao-v5-visitor';
const SESSION_KEY = 'yanglao-v5-session';
const APP_VERSION = 'v5-preview';

function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function visitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = randomId('v');
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = randomId('s');
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
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
  const payload = {
    event,
    feature,
    visitor_id: visitorId(),
    session_id: sessionId(),
    page: location.pathname,
    app_version: APP_VERSION,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ...payload, ...params, ts: Date.now() });
  window.dispatchEvent(new CustomEvent('yanglao:analytics', { detail: { ...payload, ...params } }));
  send(payload);
  return payload;
}

document.addEventListener('click', event => {
  const intent = event.target.closest('[data-intent]');
  if (intent) track('intent_click', { feature: intent.dataset.intent });
  if (event.target.closest('#residentEntry')) track('intent_click', { feature: 'resident' });
  if (event.target.closest('#resumeBtn')) track('resume_plan', { feature: 'resume' });
  if (event.target.closest('#nextBtn')) {
    const step = document.getElementById('stepBody')?.dataset.step || '';
    track('wizard_next', { feature: step });
  }
  if (event.target.closest('#homeBtn, #homeResultBtn')) track('home_click', { feature: 'home' });
}, { capture: true });

window.addEventListener('yanglao:v4-result', event => {
  const detail = event.detail || {};
  track('result_view', { feature: detail.amountAvailable ? 'amount' : 'qualification' });
});

window.addEventListener('yanglao:track', event => {
  const detail = event.detail || {};
  const { event: name, ...params } = detail;
  if (name) track(name, params);
});

track('page_view', { feature: 'home' });
