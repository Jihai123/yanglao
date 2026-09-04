import {
  DATA_VERIFIED_AT,
  NATIONAL_POLICY_SOURCES,
  OFFICIAL_UPDATES,
  getRegion,
  getSubregion,
  regionOptions,
  subregionOptions,
} from './sources.js';

const REGION_STORAGE_KEY = 'yanglao-v2-region';
const SUBREGION_STORAGE_KEY = 'yanglao-v2-subregion';
let regionKey = localStorage.getItem(REGION_STORAGE_KEY) || 'other';
let subregionKey = localStorage.getItem(SUBREGION_STORAGE_KEY) || '';

function sourceLink(item, label) {
  return `<a class="official-link" href="${item.url}" target="_blank" rel="noopener noreferrer">${label || item.title} ↗</a>`;
}

function renderHomeTrust() {
  const home = document.getElementById('homeView');
  if (!home || document.getElementById('homeTrustCard')) return;
  const sourceBox = home.querySelector('.source-box');
  const latest = OFFICIAL_UPDATES[0];
  const el = document.createElement('div');
  el.id = 'homeTrustCard';
  el.className = 'trust-card';
  el.innerHTML = `
    <div class="trust-head">
      <span class="verified-badge">官方来源可核验</span>
      <strong>政策与数据已核验至 ${DATA_VERIFIED_AT}</strong>
    </div>
    <p class="trust-copy">退休年龄和最低缴费年限使用国家现行政策；地区数值只有核验到官方来源和年份后才会自动带入。</p>
    <div class="trust-latest"><span>最新核验</span><strong>${latest.date} · ${latest.title}</strong></div>
    <details class="disclosure">
      <summary>查看人社部 / 官方政策依据</summary>
      <div class="source-list">
        ${NATIONAL_POLICY_SOURCES.map(item => `
          <div class="source-item">
            <div><strong>${item.title}</strong><span>${item.issuer}${item.date ? ` · ${item.date}` : ''}</span></div>
            ${sourceLink(item, '查看官方原文')}
          </div>`).join('')}
        <div class="source-item update-item">
          <div><strong>${latest.title}</strong><span>${latest.issuer} · ${latest.date} · 最新动态，不直接改变本次金额公式</span></div>
          ${sourceLink(latest, '查看官方动态')}
        </div>
      </div>
    </details>`;
  if (sourceBox) sourceBox.before(el); else home.appendChild(el);
}

function regionSelectHtml() {
  return regionOptions().map(item => `<option value="${item.key}" ${item.key === regionKey ? 'selected' : ''}>${item.name}</option>`).join('');
}

function normalizeSubregion() {
  const options = subregionOptions(regionKey);
  if (!options.length) {
    subregionKey = '';
    localStorage.removeItem(SUBREGION_STORAGE_KEY);
    return;
  }
  if (!options.some(item => item.key === subregionKey)) {
    subregionKey = options[0].key;
    localStorage.setItem(SUBREGION_STORAGE_KEY, subregionKey);
  }
}

function effectiveRegionData() {
  const region = getRegion(regionKey);
  const subregion = getSubregion(regionKey, subregionKey);
  return {
    region,
    subregion,
    contribution: subregion?.contribution || region.contribution,
    displayName: subregion ? `${region.name} · ${subregion.name}` : region.name,
  };
}

function regionDataHtml(region, contribution, monthlyBase, subregion) {
  const parts = [];
  if (subregion) {
    parts.push(`<div class="region-line"><span>当前地区档次</span><strong>${subregion.name}</strong></div>`);
  }
  if (region.calcBase) {
    parts.push(`<div class="region-line"><span>${region.calcBase.label}</span><strong>¥${region.calcBase.value.toLocaleString('zh-CN')} / 月</strong></div>`);
    parts.push(`<div class="region-meta">适用年度 ${region.calcBase.year} · 发布 ${region.calcBase.published} · ${sourceLink(region.calcBase, '官方来源')}</div>`);
  }
  if (contribution) {
    const freshness = contribution.current ? '当前年度已核验' : '历史最新已核验，仅供参考';
    parts.push(`<div class="region-line"><span>${contribution.year}年缴费基数范围</span><strong>¥${contribution.min.toLocaleString('zh-CN')} – ¥${contribution.max.toLocaleString('zh-CN')}</strong></div>`);
    if (contribution.standard) parts.push(`<div class="region-line"><span>${contribution.year}年缴费基数月标准</span><strong>¥${contribution.standard.toLocaleString('zh-CN')}</strong></div>`);
    parts.push(`<div class="region-meta">${freshness} · 发布 ${contribution.published} · ${sourceLink(contribution, '官方来源')}</div>`);
    if (contribution.current && Number(monthlyBase) > 0 && (Number(monthlyBase) < contribution.min || Number(monthlyBase) > contribution.max)) {
      parts.push(`<div class="region-warning">你当前填写的月缴费基数 ¥${Number(monthlyBase).toLocaleString('zh-CN')} 不在已核验的 ${contribution.year} 年官方上下限内，请确认是否使用了其他年度数据。</div>`);
    }
    if (!contribution.current) {
      parts.push(`<div class="region-note">该数值不是 ${new Date().getFullYear()} 年自动计算参数，系统不会用它校验你当前输入，也不会自动代入未来养老金金额。</div>`);
    }
  }
  if (region.method) {
    parts.push(`<div class="region-line"><span>${region.method.label}</span><strong>已核验</strong></div>`);
    parts.push(`<div class="region-meta">发布 ${region.method.published} · ${sourceLink(region.method, '查看官方办法')}</div>`);
  }
  if (region.note) parts.push(`<div class="region-note">${region.note}</div>`);
  if (!parts.length) parts.push('<div class="region-note">当前地区暂无已核验的自动参数，继续使用你填写的数据，不会偷偷套用其他城市数值。</div>');
  return parts.join('');
}

function renderSubregionField(field) {
  const old = field.querySelector('#subregionWrap');
  if (old) old.remove();
  normalizeSubregion();
  const options = subregionOptions(regionKey);
  if (!options.length) return;
  const wrap = document.createElement('div');
  wrap.id = 'subregionWrap';
  wrap.className = 'subregion-wrap';
  wrap.innerHTML = `
    <label>城市 / 地区档次</label>
    <select id="subregionSelect">${options.map(item => `<option value="${item.key}" ${item.key === subregionKey ? 'selected' : ''}>${item.name}</option>`).join('')}</select>
    <div class="help">该省官方参数存在地区差异，必须继续选择城市/档次，不能按全省统一值计算。</div>`;
  const panel = field.querySelector('#regionDataPanel');
  field.insertBefore(wrap, panel);
  wrap.querySelector('#subregionSelect').addEventListener('change', event => {
    subregionKey = event.target.value;
    localStorage.setItem(SUBREGION_STORAGE_KEY, subregionKey);
    updateRegionPanel(field);
  });
}

function updateRegionPanel(field) {
  const { region, subregion, contribution } = effectiveRegionData();
  const panel = field.querySelector('#regionDataPanel');
  const monthlyInput = document.querySelector('#stepBody [data-key="monthlyContributionBase"]');
  panel.innerHTML = regionDataHtml(region, contribution, monthlyInput?.value, subregion);

  if (region.calcBase) {
    const preciseInput = document.querySelector('#stepBody [data-key="currentCalcBase"]');
    if (preciseInput) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'use-official-btn';
      button.textContent = `使用官方参考值 ¥${region.calcBase.value.toLocaleString('zh-CN')}`;
      button.addEventListener('click', () => {
        preciseInput.value = region.calcBase.value;
        preciseInput.dispatchEvent(new Event('change', { bubbles: true }));
        button.textContent = '已带入官方参考值 ✓';
      });
      panel.appendChild(button);
    }
  }
}

function injectRegionField() {
  const stepTitle = document.getElementById('stepTitle');
  const stepBody = document.getElementById('stepBody');
  if (!stepTitle || !stepBody || !stepTitle.textContent.includes('最后补两项')) return;
  if (document.getElementById('regionTrustField')) return;

  const field = document.createElement('div');
  field.id = 'regionTrustField';
  field.className = 'field region-field';
  field.innerHTML = `
    <label>参保 / 退休地区</label>
    <select id="regionSelect">${regionSelectHtml()}</select>
    <div class="help">地区只使用已核验的官方参数；数据年份会一起展示，避免把旧参数当成今年数据。</div>
    <div id="regionDataPanel" class="region-data"></div>`;
  stepBody.prepend(field);

  const select = field.querySelector('#regionSelect');
  select.addEventListener('change', () => {
    regionKey = select.value;
    localStorage.setItem(REGION_STORAGE_KEY, regionKey);
    subregionKey = '';
    localStorage.removeItem(SUBREGION_STORAGE_KEY);
    renderSubregionField(field);
    updateRegionPanel(field);
  });
  const monthlyInput = stepBody.querySelector('[data-key="monthlyContributionBase"]');
  if (monthlyInput) monthlyInput.addEventListener('change', () => updateRegionPanel(field));
  renderSubregionField(field);
  updateRegionPanel(field);
}

function resultTrustHtml() {
  const { region, subregion, contribution, displayName } = effectiveRegionData();
  const calcSources = NATIONAL_POLICY_SOURCES.filter(item => item.type === 'calculation');
  const crosscheck = NATIONAL_POLICY_SOURCES.find(item => item.type === 'crosscheck');
  const regionLines = [];
  if (region.calcBase) regionLines.push(`${region.calcBase.label}：¥${region.calcBase.value.toLocaleString('zh-CN')}（${region.calcBase.year}，${region.calcBase.issuer}）`);
  if (contribution) {
    const freshness = contribution.current ? '当前年度' : '历史参考';
    regionLines.push(`${contribution.year}缴费基数：¥${contribution.min.toLocaleString('zh-CN')}–¥${contribution.max.toLocaleString('zh-CN')}（${freshness}，${contribution.issuer}）`);
  }
  if (region.method) regionLines.push(`${region.method.label}：${region.method.issuer}，发布于 ${region.method.published}`);
  if (subregion) regionLines.unshift(`地区档次：${subregion.name}`);

  return `
    <div class="card section" id="resultTrustCard">
      <div class="trust-head"><span class="verified-badge">可核验</span><h2>政策与数据依据</h2></div>
      <p class="muted">最后核验：${DATA_VERIFIED_AT}。国家政策规则与金额预测假设分开管理；官方没有给出的未来数值，不会伪装成确定值。</p>
      <div class="evidence-grid">
        <div class="evidence-box"><span>退休年龄 / 弹性退休</span><strong>国家政策规则</strong></div>
        <div class="evidence-box"><span>地区参数</span><strong>${displayName} · ${region.level === 'manual' ? '手动/估算' : '官方源已核验'}</strong></div>
        <div class="evidence-box"><span>未来养老金金额</span><strong>规划预测，不是待遇承诺</strong></div>
      </div>
      ${regionLines.length ? `<div class="region-result"><strong>${displayName}地区依据</strong>${regionLines.map(line => `<span>${line}</span>`).join('')}</div>` : `<div class="region-note">${region.note || '当前地区没有自动参数，结果使用用户输入与公开的国家规则。'}</div>`}
      <div class="source-list compact">
        ${calcSources.map(item => `<div class="source-item"><div><strong>${item.title}</strong><span>${item.issuer} · ${item.date}</span></div>${sourceLink(item, '官方原文')}</div>`).join('')}
      </div>
      ${crosscheck ? `<a class="official-check" href="${crosscheck.url}" target="_blank" rel="noopener noreferrer">去人社部官方养老待遇测算服务交叉验证 ↗</a>` : ''}
    </div>`;
}

function injectResultTrust() {
  const result = document.getElementById('resultView');
  if (!result || !result.children.length || document.getElementById('resultTrustCard')) return;
  result.insertAdjacentHTML('beforeend', resultTrustHtml());
}

function boot() {
  renderHomeTrust();
  injectRegionField();
  injectResultTrust();
  const observer = new MutationObserver(() => {
    injectRegionField();
    injectResultTrust();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

boot();
