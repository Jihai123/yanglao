const API = './api/feedback.php';
const VISITOR_KEY = 'yanglao-v5-visitor';
const APP_VERSION = 'v5-preview';

function visitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function relativeDate(value) {
  const then = new Date(String(value).replace(' ', 'T')).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;
  return new Date(then).toLocaleDateString('zh-CN');
}

function renderItems(items) {
  const list = document.getElementById('feedbackList');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="feedback-empty">还没有吐槽。你可以留第一条。</div>';
    return;
  }
  list.innerHTML = items.slice(0, 10).map(item => `
    <div class="feedback-item feedback-item-static">
      <div><strong>使用反馈</strong><span>${escapeHtml(relativeDate(item.created_at))}</span></div>
      <p>${escapeHtml(String(item.content || '').slice(0, 500))}</p>
    </div>`).join('');
}

async function loadFeedback() {
  const list = document.getElementById('feedbackList');
  if (!list) return;
  try {
    const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderItems(Array.isArray(payload.items) ? payload.items : []);
  } catch {
    list.innerHTML = '<div class="feedback-empty">吐槽区数据库正在配置，稍后即可直接在这里提交。</div>';
  }
}

async function submitFeedback() {
  const input = document.getElementById('feedbackInput');
  const button = document.getElementById('feedbackSubmit');
  const message = String(input?.value || '').trim();
  if (!message) {
    input?.focus();
    return;
  }

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = '提交中…';
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId(),
        content: message,
        page: location.pathname,
        app_version: APP_VERSION,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    input.value = '';
    button.textContent = '已提交';
    window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event: 'feedback_submit', feature: 'feedback' } }));
    await loadFeedback();
  } catch (error) {
    button.textContent = error.message === 'too_frequent' ? '提交太快了' : '提交失败，请稍后再试';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = oldText;
    }, 1600);
  }
}

document.getElementById('feedbackSubmit')?.addEventListener('click', submitFeedback);
document.getElementById('feedbackInput')?.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitFeedback();
});
loadFeedback();
