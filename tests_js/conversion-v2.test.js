import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('首页突出快速测算并保留退休年龄和深度规划入口', async () => {
  const html = await read('index.html');
  assert.match(html, /data-intent="quick"/);
  assert.match(html, /30秒快速测算/);
  assert.match(html, /data-intent="age"/);
  assert.match(html, /data-intent="early"/);
  assert.match(html, /conversion-v2\.css/);
});

test('快速模式只要求四项信息并使用估算默认值继续计算', async () => {
  const source = await read('js/employee-v4.js');
  assert.match(source, /estimateMode: 'precise'/);
  assert.match(source, /state\.intent === 'quick'/);
  assert.match(source, /function quickCalculationInput/);
  assert.match(source, /data-quick-sex/);
  assert.match(source, /data-key="regionKey"/);
  assert.match(source, /data-key="paidYears"/);
  assert.match(source, /const quickBase = Number\(region\.calcBase\?\.value\) > 0 \? Number\(region\.calcBase\.value\) : 8000/);
  assert.match(source, /按你选择地区的公开参数或平均水平快速估算/);
  assert.match(source, /quick-upgrade/);
});

test('转化漏斗事件和后端白名单完整', async () => {
  const source = await read('js/employee-v4.js');
  const analytics = await read('js/analytics.js');
  const api = await read('api/event.php');
  for (const event of ['pension_start', 'pension_step1_submit', 'pension_step2_submit', 'pension_result_view', 'pension_upgrade_click', 'pension_save']) {
    assert.match(source, new RegExp(`'${event}'`));
    assert.match(api, new RegExp(`'${event}'`));
  }
  assert.match(analytics, /flow_id/);
  assert.match(analytics, /page: location\.pathname/);
  assert.match(analytics, /ts: Date\.now\(\)/);
});

test('精准测算入口从快速结果继续使用原有流程', async () => {
  const source = await read('js/employee-v4.js');
  assert.match(source, /function upgradeQuickResult/);
  assert.match(source, /state\.intent = 'normal'/);
  assert.match(source, /state\.estimateMode = 'precise'/);
  assert.match(source, /补充当前缴费基数、个人账户余额和未来缴费计划/);
});
