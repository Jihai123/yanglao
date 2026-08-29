const REPO = 'Jihai123/yanglao';
const API = `https://api.github.com/repos/${REPO}/issues?state=open&sort=created&direction=desc&per_page=50`;
const NEW_ISSUE = `https://github.com/${REPO}/issues/new`;
const PREFIX = '[反馈] ';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function relativeDate(value) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;
  return new Date(value).toLocaleDateString('zh-CN');
}

function compactBody(body) {
  return String(body || '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/^页面：.*$/gm, '')
    .replace(/^版本：.*$/gm, '')
    .trim()
    .slice(0, 180);
}

function renderItems(items) {
  const list = document.getElementById('feedbackList');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="feedback-empty">还没有公开吐槽。你可以留第一条。</div>';
    return;
  }
  list.innerHTML = items.slice(0, 8).map(item => {
    const title = item.title.slice(PREFIX.length).trim();
    const body = compactBody(item.body);
    return `<a class="feedback-item" href="${item.html_url}" target="_blank" rel="noopener noreferrer"><div><strong>${escapeHtml(title || '使用反馈')}</strong><span>${escapeHtml(relativeDate(item.created_at))}</span></div>${body ? `<p>${escapeHtml(body)}</p>` : ''}</a>`;
  }).join('');
}

async function loadFeedback() {
  const list = document.getElementById('feedbackList');
  if (!list) return;
  try {
    const response = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const issues = await response.json();
    const feedback = issues.filter(item => !item.pull_request && String(item.title || '').startsWith(PREFIX));
    renderItems(feedback);
  } catch {
    list.innerHTML = '<div class="feedback-empty">公开反馈暂时加载失败，可以稍后再试。</div>';
  }
}

function submitFeedback() {
  const input = document.getElementById('feedbackInput');
  const message = String(input?.value || '').trim();
  if (!message) {
    input?.focus();
    return;
  }
  const firstLine = message.split(/\r?\n/)[0].slice(0, 46) || '使用反馈';
  const params = new URLSearchParams({
    title: `${PREFIX}${firstLine}`,
    body: `${message}\n\n页面：${location.pathname}\n版本：v4-preview`,
  });
  window.open(`${NEW_ISSUE}?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

document.getElementById('feedbackSubmit')?.addEventListener('click', submitFeedback);
document.getElementById('feedbackInput')?.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitFeedback();
});
loadFeedback();
