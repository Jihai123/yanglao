const SHARE_BASE_URL = 'https://yanglao.zhibeimao.com/';
const SHARE_LINES = [
  '算完以后，突然有点盼退休了。',
  '退休生活先算明白，梦想以后慢慢安排。',
  '看来还得再搬几年砖。',
  '原来退休这件事，真的可以提前算清楚。',
];

let previewUrl = '';
let latestShareData = null;

function track(event, feature = 'normal', step = 'result') {
  window.dispatchEvent(new CustomEvent('yanglao:track', { detail: { event, feature, step } }));
}

function shareUrl(channel = 'card') {
  const url = new URL(SHARE_BASE_URL);
  url.searchParams.set('from', 'share');
  url.searchParams.set('channel', channel);
  return url.toString();
}

function injectReleaseV24() {
  const release = document.getElementById('releaseNotes');
  if (!release || release.dataset.v24Ready) return;
  release.dataset.v24Ready = '1';
  const badge = release.querySelector('.v23-version-badge');
  if (badge) badge.textContent = 'v2.4.1';
  const first = release.querySelector('details');
  const details = document.createElement('details');
  details.open = true;
  details.innerHTML = `<summary>v2.4.1 · 2026-09-03</summary><ul>
    <li>新增退休结果分享：可生成适合朋友圈的结果卡片，展示预计养老金和退休时间，并明确标注“规划估算”。</li>
    <li>新增复制分享文案、复制链接和系统分享；分享访问、开始测算、到达结果都会匿名统计，不记录养老金金额。</li>
    <li>首页新增“退休之外，也可以顺手算算”，连接工作价值评估和宜居城市工具。</li>
    <li>修复“宜居城市排行榜”入口地址错误导致跳转 404 的问题。</li>
  </ul>`;
  if (first) {
    first.open = false;
    first.before(details);
  } else {
    release.appendChild(details);
  }
}

function injectRelatedTools() {
  const home = document.getElementById('homeView');
  if (!home || document.getElementById('relatedTools')) return;
  const mission = home.querySelector('.v6-mission');
  const faq = home.querySelector('.seo-guide');
  if (!mission || !faq) return;
  const section = document.createElement('section');
  section.id = 'relatedTools';
  section.className = 'v24-tools';
  section.setAttribute('aria-labelledby', 'relatedToolsTitle');
  section.innerHTML = `
    <div class="v24-tools-head">
      <div><span class="eyebrow">知北猫实用工具</span><h2 id="relatedToolsTitle">退休之外，也可以顺手算算</h2></div>
      <p class="muted">工作值不值、以后住哪里，其实都是同一张生活账。</p>
    </div>
    <div class="v24-tool-grid">
      <a class="v24-tool-card" data-v24-tool="job_value" href="https://jobtest.chatgpt5x.com/" target="_blank" rel="noopener">
        <span class="v24-tool-icon" aria-hidden="true">💼</span>
        <span class="v24-tool-copy"><span>工作性价比</span><strong>这 B 班值不值？</strong><em>算算这份工作的真实回报，看看还值不值得继续干。</em></span>
        <span class="v24-tool-arrow" aria-hidden="true">→</span>
      </a>
      <a class="v24-tool-card" data-v24-tool="livable_city" href="https://yiju.zhibeimao.com/" target="_blank" rel="noopener">
        <span class="v24-tool-icon" aria-hidden="true">🏡</span>
        <span class="v24-tool-copy"><span>以后住哪里</span><strong>宜居城市排行榜</strong><em>看看哪些城市房租低、节奏慢，更适合以后长期生活。</em></span>
        <span class="v24-tool-arrow" aria-hidden="true">→</span>
      </a>
    </div>`;
  faq.before(section);
  section.querySelectorAll('[data-v24-tool]').forEach(link => link.addEventListener('click', () => {
    track('outbound_tool_click', link.dataset.v24Tool || 'related_tool', 'home');
  }));
}

function resultShareData() {
  const result = document.getElementById('resultView');
  if (!result || result.classList.contains('hidden')) return null;
  const amount = result.querySelector('.amount-decision.amount-good strong')?.textContent?.trim() || '';
  if (!amount || !amount.includes('¥')) return null;
  const hero = result.querySelector('.result-hero');
  const retirementAge = hero?.querySelector('.result-money')?.textContent?.trim() || '';
  const soft = [...(hero?.querySelectorAll('.soft') || [])].map(node => node.textContent.trim()).filter(Boolean);
  const retirementDate = soft.find(text => /预计\s*\d{4}年\d{1,2}月/.test(text)) || soft.at(-1) || '';
  const status = result.querySelector('.decision-card strong')?.textContent?.trim() || '';
  const cleanAmount = amount.replace(/^约\s*/, '');
  const seed = [...cleanAmount].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    amount: cleanAmount,
    retirementAge,
    retirementDate,
    status,
    line: SHARE_LINES[seed % SHARE_LINES.length],
  };
}

function shareText(data, channel = 'text') {
  const date = data.retirementDate ? `${data.retirementDate.replace(/^预计\s*/, '')}退休` : data.retirementAge;
  return `刚算了一下，我退休后大概能领 ${data.amount}/月 😂\n${date ? `${date}。\n` : ''}这是规划估算，不是社保经办机构核定金额。\n你也可以算算自己什么时候退休、能领多少：${shareUrl(channel)}`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawShareCard(data) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const font = 'system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#edf7f2');
  gradient.addColorStop(.52, '#fffdf7');
  gradient.addColorStop(1, '#f7efe1');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = 'rgba(35,104,86,.08)';
  ctx.beginPath(); ctx.arc(950, 120, 220, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(211,157,84,.08)';
  ctx.beginPath(); ctx.arc(90, 1230, 260, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#1d6655';
  ctx.font = `700 38px ${font}`;
  ctx.fillText('退休规划助手', 78, 100);

  roundedRect(ctx, 800, 60, 190, 62, 31);
  ctx.fillStyle = '#e2f1eb'; ctx.fill();
  ctx.fillStyle = '#246454';
  ctx.font = `700 28px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText('规划估算', 895, 101);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#6a7b74';
  ctx.font = `500 40px ${font}`;
  ctx.fillText('我算了下，退休后大概能领', 78, 250);

  ctx.fillStyle = '#173f34';
  ctx.font = `800 86px ${font}`;
  const amountText = `${data.amount} / 月`;
  ctx.fillText(amountText, 78, 365);

  roundedRect(ctx, 78, 445, 924, 315, 34);
  ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(54,111,94,.14)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = '#5c746b';
  ctx.font = `600 30px ${font}`;
  ctx.fillText('退休时间', 126, 525);
  ctx.fillText('当前计划', 126, 650);

  ctx.fillStyle = '#173f34';
  ctx.font = `800 44px ${font}`;
  ctx.fillText(data.retirementDate || data.retirementAge || '已完成测算', 126, 580);
  ctx.font = `750 38px ${font}`;
  const status = data.status || '已生成退休规划';
  ctx.fillText(status.length > 20 ? `${status.slice(0, 20)}…` : status, 126, 705);

  ctx.fillStyle = '#173f34';
  ctx.font = `750 42px ${font}`;
  ctx.fillText(data.line, 78, 865);

  roundedRect(ctx, 78, 940, 924, 230, 30);
  ctx.fillStyle = '#1f6756'; ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 42px ${font}`;
  ctx.fillText('你什么时候退休？能领多少？', 126, 1025);
  ctx.font = `500 30px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillText('自己算一遍，大概 3 分钟。', 126, 1080);
  ctx.font = `700 30px ${font}`;
  ctx.fillText('yanglao.zhibeimao.com', 126, 1135);

  ctx.fillStyle = '#77847f';
  ctx.font = `500 24px ${font}`;
  ctx.fillText('养老金为规划估算；最终待遇以社保经办机构核定为准。', 78, 1265);
  ctx.fillText('卡片不包含出生年月、缴费基数、个人账户余额等填写信息。', 78, 1305);
  return canvas;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('card_blob_failed')), 'image/png', .94));
}

function ensureShareModal() {
  let modal = document.getElementById('shareCardModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'shareCardModal';
  modal.className = 'v24-share-modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'shareCardTitle');
  modal.innerHTML = `<div class="v24-share-dialog">
    <div class="v24-share-dialog-head"><strong id="shareCardTitle">朋友圈分享卡片</strong><button class="v24-share-close" type="button" aria-label="关闭">×</button></div>
    <div class="v24-share-preview"><img alt="退休规划分享卡片预览"></div>
    <p class="v24-share-hint">卡片只放退休结果，不放出生年月、缴费基数、个人账户余额等填写信息。养老金明确标注为“规划估算”。</p>
    <div class="v24-share-actions"><button class="v24-share-primary" data-v24-save-card type="button">保存图片</button><button class="v24-share-secondary" data-v24-system-share type="button">系统分享</button><button class="v24-share-tertiary" data-v24-copy-link type="button">复制链接</button></div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.add('hidden');
  modal.querySelector('.v24-share-close').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  return modal;
}

async function showShareCard(data) {
  const modal = ensureShareModal();
  const canvas = drawShareCard(data);
  const blob = await canvasBlob(canvas);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob);
  modal.querySelector('img').src = previewUrl;
  modal.classList.remove('hidden');
  track('share_card_generate');

  modal.querySelector('[data-v24-save-card]').onclick = () => {
    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = '我的退休规划.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    track('share_card_save');
  };
  modal.querySelector('[data-v24-copy-link]').onclick = async () => {
    await navigator.clipboard.writeText(shareUrl('card')).catch(() => {});
    track('share_copy_link');
  };
  modal.querySelector('[data-v24-system-share]').onclick = async () => {
    const file = new File([blob], '我的退休规划.png', { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText(data, 'system') });
        track('share_system');
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: '我的退休规划', text: shareText(data, 'system'), url: shareUrl('system') });
        track('share_system');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') throw error;
    }
  };
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  input.remove();
  return ok;
}

function injectShareBox() {
  const data = resultShareData();
  latestShareData = data;
  if (!data) return;
  const result = document.getElementById('resultView');
  if (result.querySelector('[data-v24-share-box]')) return;
  const amountCard = result.querySelector('.amount-decision.amount-good')?.closest('.card');
  if (!amountCard) return;
  const box = document.createElement('div');
  box.className = 'v24-share-box';
  box.dataset.v24ShareBox = '1';
  box.innerHTML = `<span class="v24-share-kicker">✨ 算都算了，晒一下结果</span><h3>退休后大概 ${data.amount}/月</h3><p>生成一张轻松点的朋友圈卡片。只展示退休结果，不展示你填写的个人数据。</p><div class="v24-share-actions"><button class="v24-share-primary" data-v24-card type="button">生成朋友圈卡片</button><button class="v24-share-secondary" data-v24-copy-text type="button">复制分享文案</button><button class="v24-share-tertiary" data-v24-copy-link type="button">复制链接</button></div><div class="v24-share-toast" aria-live="polite"></div>`;
  amountCard.appendChild(box);
  const toast = box.querySelector('.v24-share-toast');
  box.querySelector('[data-v24-card]').addEventListener('click', () => {
    track('share_open');
    showShareCard(data).catch(() => { toast.textContent = '卡片生成失败，请先复制分享文案。'; });
  });
  box.querySelector('[data-v24-copy-text]').addEventListener('click', async () => {
    const ok = await copyText(shareText(data, 'text')).catch(() => false);
    toast.textContent = ok ? '分享文案和链接已复制。' : '复制失败，请长按选择。';
    if (ok) track('share_copy_text');
  });
  box.querySelector('[data-v24-copy-link]').addEventListener('click', async () => {
    const ok = await copyText(shareUrl('link')).catch(() => false);
    toast.textContent = ok ? '分享链接已复制。' : '复制失败，请长按选择。';
    if (ok) track('share_copy_link');
  });
}

injectReleaseV24();
injectRelatedTools();

window.addEventListener('yanglao:v4-result', () => queueMicrotask(injectShareBox));

const observer = new MutationObserver(() => {
  injectReleaseV24();
  injectRelatedTools();
  if (!document.getElementById('resultView')?.classList.contains('hidden')) injectShareBox();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('beforeunload', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});