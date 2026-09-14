import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('前后端诊断版本与 V2.6 埋点版本保持一致', async () => {
  const analytics = await read('js/analytics.js');
  const admin = await read('api/admin.php');
  const appVersion = analytics.match(/const APP_VERSION = '([^']+)'/)?.[1];
  const diagnosticsVersion = admin.match(/const DIAGNOSTICS_APP_VERSION = '([^']+)'/)?.[1];
  assert.ok(appVersion);
  assert.equal(diagnosticsVersion, appVersion);
});

test('看板把通用结果和养老金专用结果按 flow 去重视为到达结果', async () => {
  const admin = await read('api/admin.php');
  assert.match(admin, /event_name IN \('result_view', 'pension_result_view'\)/);
  assert.match(admin, /flow_event\.event_name IN \('result_view', 'pension_result_view'\)/);
  assert.match(admin, /COUNT\(DISTINCT CASE WHEN \{\$resultEvent\} AND flow_id <> '' THEN flow_id END\) AS result_flows/);
});

test('快速测算漏斗区分进入、有效提交和结果', async () => {
  const admin = await read('api/admin.php');
  const dashboard = await read('admin/index.html');
  assert.match(admin, /step = 'quick'/);
  assert.match(admin, /event_name = 'pension_step2_submit' AND flow_event\.feature = 'quick'/);
  assert.match(admin, /'submitted' => \(int\)\$row\['quick_submit'\]/);
  assert.match(dashboard, /quick:'30秒快速测算'/);
  assert.match(dashboard, /quick:\[\['quick','进入快速页'\],\['submitted','有效提交'\]\]/);
  assert.match(dashboard, /normal:\[\['identity','身份'\],\['status','参保状态'\],\['amount','金额信息'\]\]/);
});

test('快速结果同时补齐通用 result_view，避免其他分析消费者漏数', async () => {
  const analytics = await read('js/analytics.js');
  assert.match(analytics, /name === 'pension_result_view'/);
  assert.match(analytics, /String\(params\.feature \|\| currentFlowFeature\(\)\) === 'quick'/);
  assert.match(analytics, /track\('result_view', \{ feature: 'quick', step: 'result' \}\)/);
});

test('V2.6 诊断同时展示 quick 专项和精准金额页', async () => {
  const admin = await read('api/admin.php');
  const dashboard = await read('admin/index.html');
  assert.match(admin, /'quick' => \[/);
  assert.match(admin, /'submit_flows'/);
  assert.match(admin, /'result_flows'/);
  assert.match(dashboard, /今天快速测算：开始/);
  assert.match(dashboard, /今天精准金额页/);
  assert.match(dashboard, /当前诊断版本/);
});
