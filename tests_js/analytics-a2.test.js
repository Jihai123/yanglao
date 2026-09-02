import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('analytics records only diagnostic buckets and flow identifiers', async () => {
  const source = await read('js/analytics.js');
  assert.match(source, /APP_VERSION = 'v2-prod-20260902-d1'/);
  for (const field of ['flow_id', 'source', 'device', 'step', 'reason_code', 'error_type', 'script_name', 'line_no', 'column_no']) {
    assert.match(source, new RegExp(`${field}:`));
  }
  for (const event of ['flow_start', 'step_view', 'validation_error', 'client_error']) {
    assert.match(source, new RegExp(`'${event}'`));
  }
  assert.match(source, /validationReason/);
  assert.match(source, /safeScriptName/);
  assert.match(source, /return 'mobile'/);
  assert.doesNotMatch(source, /params\.message|params\.stack|event\.message|event\.reason/);
});

test('event API accepts diagnostics and persists safe fields only', async () => {
  const php = await read('api/event.php');
  for (const event of ['flow_start', 'step_view', 'validation_error', 'client_error']) {
    assert.match(php, new RegExp(`'${event}'`));
  }
  for (const field of ['flow_id', 'step', 'source', 'device', 'reason_code', 'error_type', 'script_name', 'line_no', 'column_no']) {
    assert.match(php, new RegExp(field));
  }
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

test('admin diagnostics endpoint exposes validation and client error aggregates', async () => {
  const php = await read('api/diagnostics.php');
  for (const key of ['reason_code', 'validation_error', 'client_error', 'next_attempts', 'validation_attempts', 'seven_days']) {
    assert.match(php, new RegExp(key));
  }
});

test('admin dashboard exposes failure diagnostics without form data', async () => {
  const html = await read('admin/index.html');
  assert.match(html, /测算失败诊断/);
  assert.match(html, /DIAGNOSTICS_API/);
  assert.match(html, /validation_attempts/);
  assert.doesNotMatch(html, /currentAccount|monthlyContributionBase|paidYears/);
});

test('homepage loads cache-busted diagnostics analytics and discloses anonymous diagnostics', async () => {
  const html = await read('index.html');
  assert.match(html, /analytics\.js\?v=20260902-d1/);
  assert.match(html, /访问来源类别、设备类别、所选功能、测算步骤和是否到达结果/);
});
