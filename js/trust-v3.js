import {
  DATA_VERIFIED_AT,
  NATIONAL_POLICY_SOURCES,
  OFFICIAL_UPDATES,
  getRegion,
  getSubregion,
  regionOptions,
  subregionOptions,
} from './sources.js?v=20260828-p15';

const REGION_KEY = 'yanglao-v3-region';
const SUBREGION_KEY = 'yanglao-v3-subregion';
let regionKey = localStorage.getItem(REGION_KEY) || 'other';
let subregionKey = localStorage.getItem(SUBREGION_KEY) || '';

function daysSince(dateString) {
  const then = new Date(`${dateString}T00:00:00+08:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}
function freshnessText() {
  const days = daysSince(DATA_VERIFIED_AT);
  if (days === 0) return { label: '今天核验', stale: false };
  if (days <= 30) return { label: `${days}天前核验`, stale: false };
  return { label: `已${days}天未复核`, stale: true };
}
function sourceLink(item, text = '官方原文') {
  return `<a class="official-link" href="${item.url}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
}
function renderHomeTrust() {
  const home = document.getElementById('homeView');
  if (!home || document.getElementById('homeTrustCard')) return;
  const freshness = freshnessText();
  const latest = OFFICIAL_UPDATES[0];
  const card = document.createElement('section');
  card.id = 'homeTrustCard';
  card.className = `trust-card trust-v3 ${freshness.stale ? 'trust-stale' : ''}`;
  card.innerHTML = `
    <div class="trust-head"><span class="verified-badge">官方来源</span><strong>${freshness.label}</strong></div>
    ${freshness.stale ? '<div class="freshness-warning">部分参数可能已更新，请核对当地人社最新公告。</div>' : ''}
    <details class="disclosure"><summary>查看政策依据</summary><div class="source-list">
      ${NATIONAL_POLICY_SOURCES.map(item => `<div class="source-item"><div><strong>${item.title}</strong><span>${item.issuer}${item.date ? ` · ${item.date}` : ''}</span></div>${sourceLink(item)}</div>`).join('')}
      ${latest ? `<div class="source-item"><div><strong>${latest.title}</strong><span>${latest.issuer} · ${latest.date}</span></div>${sourceLink(latest, '官方动态')}</div>` : ''}
    </div></details>`;
  const intents = home.querySelector('.intent-grid');
  if (intents) intents.after(card); else home.appendChild(card);
}
function normalizeSubregion() {
  const options = subregionOptions(regionKey);
  if (!options.length) { subregionKey = ''; localStorage.removeItem(SUBREGION_KEY); return; }
  if (!options.some(item => item.key === subregionKey)) {
    subregionKey = options[0].key;
    localStorage.setItem(SUBREGION_KEY, subregionKey);
  }
}
function effectiveData() {
  normalizeSubregion();
  const region = getRegion(regionKey);
  const subregion = getSubregion(regionKey, subregionKey);
  return { region, subregion, contribution: subregion?.contribution || region.contribution, name: subregion ? `${region.name} · ${subregion.name}` : region.name };
}
function panelHtml(data) {
  const { region, contribution, name } = data;
  const lines = [];
  if (region.calcBase) {
    lines.push(`<div class="region-line"><span>${region.calcBase.label}</span><strong>${region.calcBase.value.toLocaleString('zh-CN')}元/月</strong></div>`);
    lines.push(`<div class="region-meta">${region.calcBase.year}年 · ${sourceLink(region.calcBase)}</div>`);
  }
  if (contribution) {
    lines.push(`<div class="region-line"><span>${contribution.year}年缴费基数</span><strong>${contribution.min.toLocaleString('zh-CN')}～${contribution.max.toLocaleString('zh-CN')}元</strong></div>`);
    lines.push(`<div class="region-meta">${contribution.current ? '当前已核验' : '历史参考'} · ${sourceLink(contribution)}</div>`);
  }
  if (region.method) lines.push(`<div class="region-meta">${region.method.label} · ${sourceLink(region.method)}</div>`);
  if (region.note) lines.push(`<div class="region-note">${region.note}</div>`);
  if (!lines.length) lines.push(`<div class="region-note">${name}暂未收录最新金额参数。</div>`);
  return lines.join('');
}
function applyOfficialCalcBase(region) {
  if (!region.calcBase) return;
  const input = document.querySelector('#stepBody [data-key="currentCalcBase"]');
  if (!input) return;
  if (!(Number(input.value) > 0) || input.dataset.autoOfficial === '1') {
    input.value = String(region.calcBase.value);
    input.dataset.autoOfficial = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
function injectRegionField() {
  const body = document.getElementById('stepBody');
  if (!body || body.dataset.step !== 'amount' || !body.querySelector('[data-key="monthlyContributionBase"]')) return;
  if (document.getElementById('regionTrustField')) return;
  const field = document.createElement('div');
  field.id = 'regionTrustField'; field.className = 'field region-field';
  field.innerHTML = `<label>参保 / 退休地区</label><select id="regionSelect">${regionOptions().map(item => `<option value="${item.key}" ${item.key === regionKey ? 'selected' : ''}>${item.name}</option>`).join('')}</select><div id="subregionWrap"></div><div id="regionDataPanel" class="region-data"></div>`;
  body.prepend(field);
  function refresh() {
    normalizeSubregion();
    const subOptions = subregionOptions(regionKey);
    const subWrap = field.querySelector('#subregionWrap');
    subWrap.innerHTML = subOptions.length ? `<label class="sub-label">城市 / 地区档次</label><select id="subregionSelect">${subOptions.map(item => `<option value="${item.key}" ${item.key === subregionKey ? 'selected' : ''}>${item.name}</option>`).join('')}</select>` : '';
    subWrap.querySelector('#subregionSelect')?.addEventListener('change', event => { subregionKey = event.target.value; localStorage.setItem(SUBREGION_KEY, subregionKey); refresh(); });
    const data = effectiveData();
    field.querySelector('#regionDataPanel').innerHTML = panelHtml(data);
    applyOfficialCalcBase(data.region);
  }
  field.querySelector('#regionSelect').addEventListener('change', event => { regionKey = event.target.value; localStorage.setItem(REGION_KEY, regionKey); subregionKey = ''; localStorage.removeItem(SUBREGION_KEY); refresh(); });
  refresh();
}
function resultTrustHtml() {
  const data = effectiveData(); const freshness = freshnessText(); const crosscheck = NATIONAL_POLICY_SOURCES.find(item => item.type === 'crosscheck');
  return `<div class="card section" id="resultTrustCard"><div class="trust-head"><span class="verified-badge">政策依据</span><h2>${data.name}</h2></div><p class="muted">${DATA_VERIFIED_AT}核验 · ${freshness.label}</p>${crosscheck ? `<a class="official-check" href="${crosscheck.url}" target="_blank" rel="noopener noreferrer">官方待遇测算 ↗</a>` : ''}</div>`;
}
function injectResultTrust() {
  const result = document.getElementById('resultView');
  if (!result || result.classList.contains('hidden') || !result.children.length || document.getElementById('resultTrustCard')) return;
  result.insertAdjacentHTML('beforeend', resultTrustHtml());
}
renderHomeTrust();
const observer = new MutationObserver(() => { injectRegionField(); injectResultTrust(); });
observer.observe(document.body, { childList: true, subtree: true });
injectRegionField(); injectResultTrust();
