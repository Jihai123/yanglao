import './launch-polish.js';

const SESSION_KEY = 'yanglao-v2-analytics-session';

function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function track(event, params = {}) {
  const payload = {
    event,
    ...params,
    pension_app_version: 'v2',
    session_id: sessionId(),
    ts: Date.now(),
  };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent('yanglao:analytics', { detail: payload }));
  return payload;
}

// 这里只提供统一事件层，不绑定具体第三方统计服务。部署时接入 GA/Cloudflare/Plausible 等任一前端统计方案即可消费 dataLayer。
document.addEventListener('click', (event) => {
  const intent = event.target.closest('[data-intent]');
  if (intent) track('intent_click', { intent: intent.dataset.intent });
  if (event.target.closest('#residentEntry')) track('intent_click', { intent: 'resident' });
  if (event.target.closest('#resumeBtn')) track('resume_plan');
  if (event.target.closest('#nextBtn')) track('wizard_next');
}, { capture: true });

window.addEventListener('yanglao:track', (event) => {
  const detail = event.detail || {};
  const { event: name, ...params } = detail;
  if (name) track(name, params);
});
