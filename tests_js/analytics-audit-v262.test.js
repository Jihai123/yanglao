import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('V2.6.2 dashboard defaults to current-version data and can switch to all history', async () => {
  const page = await read('admin/index.html');
  const api = await read('api/admin-v262.php');
  const proxy = await read('api/adminv.php');

  assert.match(page, /<option value="current">当前版本 V2\.6<\/option>/);
  assert.match(page, /<option value="all">全部历史<\/option>/);
  assert.match(page, /const DATA_API='\/api\/adminv\.php'/);
  assert.match(page, /scopeSelect/);
  assert.match(proxy, /admin-v262\.php/);
  assert.match(api, /\$scope === 'all' \? 'all' : 'current'/);
  assert.match(api, /function audit_scope_clause/);
});

test('audit endpoint current version stays aligned with analytics client version', async () => {
  const analytics = await read('js/analytics.js');
  const api = await read('api/admin-v262.php');
  const clientVersion = analytics.match(/const APP_VERSION = '([^']+)'/)?.[1];
  const auditVersion = api.match(/const CURRENT_ANALYTICS_APP_VERSION = '([^']+)'/)?.[1];

  assert.ok(clientVersion);
  assert.equal(auditVersion, clientVersion);
});

test('current-version scope is applied to funnels, sources, devices and step friction', async () => {
  const api = await read('api/admin-v262.php');

  assert.match(api, /WHERE created_at >= CURDATE\(\) - INTERVAL 29 DAY AND \{\$scopeClause\}/);
  assert.match(api, /AND \{\$flowEventScope\}/);
  assert.match(api, /AND \{\$flowStartScope\}/);
  assert.match(api, /event_name IN \('step_view', 'wizard_next'\) AND \{\$scopeClause\}/);
  assert.match(api, /'scope' => \$scope/);
  assert.match(api, /'analytics_version' => 'a5'/);
});

test('failure-flow audit returns recovery metrics and an anonymous timeline only', async () => {
  const api = await read('api/admin-v262.php');
  const page = await read('admin/index.html');

  assert.match(api, /function audit_flow_details/);
  assert.match(api, /'blocked_flows'/);
  assert.match(api, /'recovered_flows'/);
  assert.match(api, /'not_recovered_flows'/);
  assert.match(api, /'avg_attempts_per_blocked_flow'/);
  assert.match(api, /substr\(hash\('sha256', \$flowId\), 0, 10\)/);
  assert.doesNotMatch(api, /'visitor_id'\s*=>/);
  assert.doesNotMatch(api, /'session_id'\s*=>/);
  assert.match(page, /当前版本 · 失败流程审计/);
  assert.match(page, /最终恢复成功/);
  assert.match(page, /暂未恢复/);
});

test('audit timeline intentionally excludes personal pension inputs and raw error text', async () => {
  const api = await read('api/admin-v262.php');

  const timelineSelect = api.match(/SELECT created_at, event_name, feature, step, reason_code, source, device[\s\S]*?LIMIT 100/)?.[0] || '';
  assert.ok(timelineSelect);
  assert.doesNotMatch(timelineSelect, /birth|salary|wage|contribution_base|account_balance|error_message|stack/i);
  assert.match(timelineSelect, /validation_error/);
  assert.match(timelineSelect, /pension_result_view/);
});
