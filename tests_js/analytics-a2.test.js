import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('analytics records only diagnostic buckets and flow identifiers', async () => {
  const source = await read('js/analytics.js');
  assert.match(source, /APP_VERSION = 'v2-prod-20260903-d3'/);
  for (const field of ['flow_id', 'source', 'device', 'step', 'reason_code', 'error_type', 'script_name', 'line_no', 'column_no']) {
    assert.match(source, new RegExp(`${field}:`));
  }
  for (const event of ['flow_start', 'step_view', 'validation_error', 'client_error']) {
    assert.match(source, new RegExp(`'${event}'`));
  }
  assert.match(source, /params\.get\('from'\) === 'share'/);
  assert.match(source, /return 'share'/);
  assert.match(source, /#continuePlanBtn/);
  assert.match(source, /currentFlowFeature\(\)/);
  assert.match(source, /validationReason/);
  assert.match(source, /safeScriptName/);
  assert.match(source, /return 'mobile'/);
  assert.doesNotMatch(source, /params\.message|params\.stack|event\.message|event\.reason/);
});

test('v2.3 runtime removes ambiguous future base choice and guards result re-entry', async () => {
  const source = await read('js/v23-runtime.js');
  assert.match(source, /PUBLIC_VERSION = 'v2\.3'/);
  assert.match(source, /按当地最低标准/);
  assert.match(source, /我自己填写未来缴费基数/);
  assert.match(source, /forceLegacyFlexModeCustom/);
  assert.match(source, /resultSubmitting/);
  assert.match(source, /正在计算/);
  assert.match(source, /v23-field-error/);
  assert.match(source, /版本与更新记录/);
  assert.doesNotMatch(source, /data-flex-base-mode="unknown"/);
});

test('v2.4 growth layer adds related tools, share card and privacy-safe tracking', async () => {
  const source = await read('js/v24-growth.js');
  assert.match(source, /jobtest\.chatgpt5x\.com/);
  assert.match(source, /yiju\.zhibeimao\.com/);
  assert.match(source, /v2\.4\.1/);
  assert.match(source, /朋友圈分享卡片/);
  assert.match(source, /规划估算/);
  for (const event of ['share_open', 'share_card_generate', 'share_copy_text', 'share_copy_link', 'share_system', 'outbound_tool_click']) {
    assert.match(source, new RegExp(`'${event}'`));
  }
  assert.doesNotMatch(source, /currentAccount|monthlyContributionBase|paidYears|birth/);
});

test('event API accepts diagnostics and growth events while persisting safe fields only', async () => {
  const php = await read('api/event.php');
  for (const event of ['flow_start', 'step_view', 'validation_error', 'client_error', 'share_open', 'share_card_generate', 'share_copy_text', 'share_copy_link', 'share_system', 'outbound_tool_click']) {
    assert.match(php, new RegExp(`'${event}'`));
  }
  for (const field of ['flow_id', 'step', 'source', 'device', 'reason_code', 'error_type', 'script_name', 'line_no', 'column_no']) {
    assert.match(php, new RegExp(field));
  }
  assert.match(php, /'share'/);
  assert.doesNotMatch(php, /error_message|stack_trace/);
});

test('usage event schema and migrations support diagnostics dimensions', async () => {
  const schema = await read('api/schema.sql');
  const migration = await read('scripts/migrate-analytics-v2.php');
  const diagnosticsMigration = await read('scripts/migrate-analytics-diagnostics.php');
  for (const field of ['flow_id', 'step', 'source', 'device']) {
    assert.match(schema, new RegExp(`${field} VARCHAR`));
    assert.match(migration, new RegExp(`'${field}'`));
  }
  for (const field of ['reason_code', 'error_type', 'script_name', 'line_no', 'column_no']) {
    assert.match(schema, new RegExp(field));
    assert.match(diagnosticsMigration, new RegExp(`'${field}'`));
  }
  assert.match(migration, /column_exists/);
  assert.match(migration, /index_exists/);
  assert.match(diagnosticsMigration, /diagnostics_column_exists/);
});

test('admin diagnostics action exposes validation and client error aggregates', async () => {
  const php = await read('api/admin.php');
  for (const key of ['reason_code', 'validation_error', 'client_error', 'next_attempts', 'validation_attempts', 'seven_days']) {
    assert.match(php, new RegExp(key));
  }
  assert.match(php, /\$_GET\['action'\]/);
  assert.match(php, /=== 'diagnostics'/);
});

test('admin dashboard exposes failure diagnostics without form data', async () => {
  const html = await read('admin/index.html');
  assert.match(html, /测算失败诊断/);
  assert.match(html, /DIAGNOSTICS_API='\/api\/admin\.php\?action=diagnostics'/);
  assert.match(html, /validation_attempts/);
  assert.doesNotMatch(html, /diagnostics\.php/);
  assert.doesNotMatch(html, /currentAccount|monthlyContributionBase|paidYears/);
});

test('homepage loads v2.4 growth layer and cache-busted analytics', async () => {
  const html = await read('index.html');
  assert.match(html, /v23-runtime\.js\?v=20260902-v23/);
  assert.match(html, /v24-growth\.js\?v=20260903-v241/);
  assert.match(html, /growth-v24\.css\?v=20260903-v24/);
  assert.match(html, /analytics\.js\?v=20260903-d3/);
  assert.match(html, /分享\/相关工具点击/);
});
