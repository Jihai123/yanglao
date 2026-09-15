const RELEASE_VERSION = 'v2.6.3';
const RELEASE_DATE = '2026-09-15';

function injectReleaseV25() {
  const release = document.getElementById('releaseNotes');
  if (!release || release.dataset.v25ReleaseReady === '1') return false;

  release.dataset.v25ReleaseReady = '1';
  const badge = release.querySelector('.v23-version-badge');
  if (badge) badge.textContent = RELEASE_VERSION;

  const first = release.querySelector('details');
  const details = document.createElement('details');
  details.open = true;
  details.dataset.releaseVersion = RELEASE_VERSION;
  details.innerHTML = `<summary>${RELEASE_VERSION} · ${RELEASE_DATE}</summary><ul>
    <li>精简快速测算结果页的升级入口：保留一个“进入精准测算”主入口，移除重复按钮，减少操作歧义。</li>
    <li>优化历史缴费年月校验：月份选择不能超过当前月；如果已有未来月份数据，提交后会自动定位并聚焦到具体错误字段。</li>
    <li>Quick 升级到精准测算后改为新建独立流程统计，后续精准填写与校验失败不再混入“30秒快速测算”漏斗。</li>
    <li>管理看板继续支持当前版本 / 全部历史隔离与失败流程审计，便于区分真实产品摩擦和历史统计噪声。</li>
  </ul>`;

  const previousV26 = document.createElement('details');
  previousV26.dataset.releaseVersion = 'v2.6.0';
  previousV26.innerHTML = `<summary>v2.6.0 · 2026-09-12</summary><ul>
    <li>新增“30秒快速测算”：只需出生年月、性别、参保地区和已缴养老保险年限，即可先看到养老金估算结果。</li>
    <li>首页改为单一主 CTA，并将结果升级为“我的退休报告”，补充影响因素和提高准确度入口。</li>
    <li>快速测算缺少缴费基数、个人账户余额等信息时不再阻断，改用明确标注的默认参考值继续估算。</li>
    <li>新增养老金转化漏斗埋点，持续观察开始测算、提交步骤、查看结果和升级精准测算的完成情况。</li>
    <li>修复缴费年限、缴费基数和居民养老金额在切换选项或直接查看结果时可能仍使用旧值的问题。</li>
    <li>修复离职 / 灵活就业入口修改出生年月后，默认规划年龄没有同步更新的问题。</li>
    <li>“继续上次测算”现在会及时出现，并回到上次实际填写的步骤。</li>
    <li>退休年龄和只看资格的结果页改为展示对应的退休政策依据；视同缴费年限明细选择后保持展开。</li>
  </ul>`;

  const previousV25 = document.createElement('details');
  previousV25.dataset.releaseVersion = 'v2.5';
  previousV25.innerHTML = `<summary>v2.5 · 2026-09-04</summary><ul>
    <li>全国地区养老参数统一接入运行时：可靠参数优先自动带入，缺失或证据不足的数据继续不猜测。</li>
    <li>补充山西、重庆、四川、陕西养老金计算公开资料参考值，并明确标注“暂未找到可直接引用的省级人社官方原文”，支持用户自行修改。</li>
    <li>完善辽宁、吉林、山东、广东等存在地区分档的处理；山东菏泽、深圳灵活就业等缺少可靠参数的场景继续保持手动填写。</li>
    <li>更新广东深圳、云南等已核验地区参数，并让结果页的数据来源说明与实际计算参数保持一致。</li>
    <li>修复地区切换、手动修改被自动覆盖，以及地区参数刷新可能造成页面反复重绘的问题。</li>
  </ul>`;

  if (first) {
    first.open = false;
    first.before(details);
    details.after(previousV26);
    previousV26.after(previousV25);
  } else {
    release.appendChild(details);
    release.appendChild(previousV26);
    release.appendChild(previousV25);
  }
  return true;
}

if (!injectReleaseV25()) {
  const observer = new MutationObserver(() => {
    if (injectReleaseV25()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
