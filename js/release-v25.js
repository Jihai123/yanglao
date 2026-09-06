const RELEASE_VERSION = 'v2.5.1';
const RELEASE_DATE = '2026-09-06';

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
    <li>修复缴费年限、缴费基数和居民养老金额在切换选项或直接查看结果时可能仍使用旧值的问题。</li>
    <li>修复离职 / 灵活就业入口修改出生年月后，默认规划年龄没有同步更新的问题。</li>
    <li>“继续上次测算”现在会及时出现，并回到上次实际填写的步骤。</li>
    <li>退休年龄和只看资格的结果页改为展示对应的退休政策依据；视同缴费年限明细选择后保持展开。</li>
  </ul>`;

  const previous = document.createElement('details');
  previous.dataset.releaseVersion = 'v2.5';
  previous.innerHTML = `<summary>v2.5 · 2026-09-04</summary><ul>
    <li>全国地区养老参数统一接入运行时：可靠参数优先自动带入，缺失或证据不足的数据继续不猜测。</li>
    <li>补充山西、重庆、四川、陕西养老金计算公开资料参考值，并明确标注“暂未找到可直接引用的省级人社官方原文”，支持用户自行修改。</li>
    <li>完善辽宁、吉林、山东、广东等存在地区分档的处理；山东菏泽、深圳灵活就业等缺少可靠参数的场景继续保持手动填写。</li>
    <li>更新广东深圳、云南等已核验地区参数，并让结果页的数据来源说明与实际计算参数保持一致。</li>
    <li>修复地区切换、手动修改被自动覆盖，以及地区参数刷新可能造成页面反复重绘的问题。</li>
  </ul>`;

  if (first) {
    first.open = false;
    first.before(details);
    details.after(previous);
  } else {
    release.appendChild(details);
    release.appendChild(previous);
  }
  return true;
}

if (!injectReleaseV25()) {
  const observer = new MutationObserver(() => {
    if (injectReleaseV25()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
