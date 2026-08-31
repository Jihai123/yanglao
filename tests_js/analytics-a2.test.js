import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('analytics a2 records only diagnostic buckets and flow identifiers', async () => {
  const source = await read('js/analytics.js');
  assert.match(source, /APP_VERSION = 'v2-prod-20260831-a2'/);
  assert.doesNotMatch(source, /APP_VERSION = 'v5-preview'/);
  for (const field of ['flow_id', 'source', 'device', 'step']) {
    assert.match(source, new RegExp(`${field}:`));
  }
  for (const event of ['flow_start', 'step_view', 'client_error']) {
    assert.match(source, new RegExp(`'${event}'`));
  }
  assert.match(source, /normalizeSource/);
  assert.match(source, /return 'mobile'/);
  assert.doesNotMatch(source, /currentAccount|monthlyContributionBase|birth|paidYears/);
});

test('event API accepts analytics a2 events and persists new dimensions', async () => {
  const php = await read('api/event.php');
  for (const event of ['flow_start', 'step_view', 'client_error']) {
    assert.match(php, new RegExp(`'${event}'`));
  }
  for (const field of ['flow_id', 'step', 'source', 'device']) {
    assert.match(php, new RegExp(field));
  }
});

test('usage event schema and migration support a2 dimensions', async () => {
  const schema = await read('api/schema.sql');
  const migration = await read('scripts/migrate-analytics-v2.php');
  for (const field of ['flow_id', 'step', 'source', 'device']) {
    assert.match(schema, new RegExp(`${field} VARCHAR`));
    assert.match(migration, new RegExp(`'${field}'`));
  }
  assert.match(migration, /column_exists/);
  assert.match(migration, /index_exists/);
});

test('admin API exposes sources, devices, funnels, friction and visitor types', async () => {
  const php = await read('api/admin.php');
  for (const key of ['sources', 'devices', 'funnels', 'step_friction', 'new_visitors', 'returning_visitors', 'flow_conversion']) {
    assert.match(php, new RegExp(key));
  }
});

test('homepage loads cache-busted analytics a2 and discloses anonymous diagnostics', async () => {
  const html = await read('index.html');
  assert.match(html, /analytics\.js\?v=20260831-a2/);
  assert.match(html, /访问来源类别、设备类别、所选功能、测算步骤和是否到达结果/);
});
