const RELEASE_VERSION = 'v2.6.4';
const RELEASE_DATE = '2026-09-29';

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
    <li>“累计实际缴费”和“视同缴费年限”改为分开填写；已确认的视同缴费年限会计入最低缴费年限判断，避免资格判断少算。</li>
    <li>视同缴费状态不确定，或当地视同缴费计发规则 / 过渡性养老金信息不完整时，不再硬阻断；只展示“按当前已确认资料可估算的部分”，不会冒充完整养老金总额。</li>
    <li>如果用户填写了官方过渡性养老金金额，该金额可计入已确认部分，但视同缴费对基础养老金的地方计发规则仍不自行猜测。</li>
    <li>新增“视同缴费年限 / 过渡性养老金是什么、怎么确认”的说明，并补充缴费基数查询提示；旧版保存过视同缴费数据的计划会要求重新确认一次口径。</li>
    <li>优化累计缴费月份和出生年月的防错；月份明确为 0～11 个月，出生年月不能选择未来月份。</li>
    <li>管理看板升级为 V2.6.4 独立统计基线，区分完整结果、部分结果、只看资格和真正校验阻断。</li>
  </ul>`;

  const previousV263 = document.createElement('details');
  previousV263.dataset.releaseVersion = 'v2.6.3';
  previousV263.innerHTML = `<summary>v2.6.3 · 2026-09-15</summary><ul>
    <li>精简快速测算结果页的升级入口，移除重复按钮。</li>
    <li>历史缴费年月不能超过当前月，校验失败会自动定位具体字段。</li>
    <li>Quick 升级到精准测算后新建独立流程统计，减少漏斗归因污染。</li>
    <li>管理看板支持当前版本 / 全部历史隔离与失败流程审计。</li>
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
    details.after(previousV263);
    previousV263.after(previousV26);
    previousV26.after(previousV25);
  } else {
    release.appendChild(details);
    release.appendChild(previousV263);
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
