import './release-v25.js?v=20260904-r1';
import {
  DATA_VERIFIED_AT,
  NATIONAL_POLICY_SOURCES,
  getRegionV5,
  resolveRegionV5,
} from './sources-v5.js?v=20260904-r4';

const PLAN_KEY = 'yanglao-v4-plan';
const SUBREGION_PREFIX = 'yanglao-v25-subregion:';
const REVIEW_INTERVAL_DAYS = 30;

function daysSince(dateString) {
  const then = new Date(`${dateString}T00:00:00+08:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

function readPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null') || {}; } catch { return {}; }
}

function readSubregion(regionKey) {
  try { return sessionStorage.getItem(`${SUBREGION_PREFIX}${regionKey}`) || ''; } catch { return ''; }
}

function sourceLink(item, label = '查看政策依据') {
  if (!item?.url) return '';
  return `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
}

function renderHomeTrust() {
  const slot = document.getElementById('trustSlot');
  if (!slot) return;
  const days = daysSince(DATA_VERIFIED_AT);
  const rules = NATIONAL_POLICY_SOURCES.find(item => item.id === 'gradual-retirement');
  const stale = days > REVIEW_INTERVAL_DAYS;
  const label = stale ? '政策资料需要重新核验' : '政策资料最近核验';
  const extra = stale ? ` · 已超过${REVIEW_INTERVAL_DAYS}天` : '';
  slot.innerHTML = `<div class="trust-strip ${stale ? 'trust-stale' : ''}"><div><span class="trust-dot"></span><strong>${label}</strong><span>${DATA_VERIFIED_AT}${extra}</span></div>${sourceLink(rules)}</div>`;
}

function resultTrustHtml() {
  const plan = readPlan();
  const regionKey = plan.regionKey || 'other';
  const baseRegion = getRegionV5(regionKey);
  const subregionKey = baseRegion?.needsSubregion ? readSubregion(regionKey) : '';
  const region = resolveRegionV5(regionKey, subregionKey) || baseRegion;
  const crosscheck = NATIONAL_POLICY_SOURCES.find(item => item.type === 'crosscheck');
  const calcBase = region?.calcBase;
  const area = region?.subregionName ? ` · ${region.subregionName}` : '';
  const baseText = calcBase?.runtimeEligible && Number(calcBase.value) > 0
    ? `${calcBase.label} · 养老金计算参考值 ${Math.round(calcBase.value).toLocaleString('zh-CN')}元/月${area}`
    : region?.subregionRequired
      ? '需要先选择对应地区范围'
      : '未收录可自动带入的养老金计算参考值';
  return `<div class="result-trust" id="resultTrustCard"><div><strong>数据依据</strong><span>${region?.name || baseRegion?.name || '其他地区'} · ${baseText}</span></div>${sourceLink(crosscheck, '去官方待遇测算交叉核对')}</div>`;
}

function injectResultTrust() {
  const result = document.getElementById('resultView');
  if (!result || result.classList.contains('hidden') || !result.children.length || document.getElementById('resultTrustCard')) return;
  const actions = result.querySelector('.result-actions');
  if (actions) actions.insertAdjacentHTML('beforebegin', resultTrustHtml());
  else result.insertAdjacentHTML('beforeend', resultTrustHtml());
}

renderHomeTrust();
const observer = new MutationObserver(injectResultTrust);
observer.observe(document.body, { childList: true, subtree: true });
injectResultTrust();
