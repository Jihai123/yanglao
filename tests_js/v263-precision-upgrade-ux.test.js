import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('V2.6.3 UX module is loaded with a fresh cache key', async () => {
  const html = await read('index.html');
  assert.match(html, /v263-precision-upgrade-ux\.js\?v=20260915-v263/);
  assert.match(html, /trust-v5\.js\?v=20260915-v263/);
});

test('quick upgrade has one CTA and starts a new precise analytics flow', async () => {
  const employee = await read('js/employee-v4.js');
  const fix = await read('js/v263-precision-upgrade-ux.js');
  assert.match(employee, /id="quickUpgradeBtn"/);
  assert.match(employee, /id="quickUpgradeBtnBottom"/);
  assert.match(fix, /quickUpgradeBtnBottom/);
  assert.match(fix, /\.remove\(\)/);
  assert.match(fix, /yanglao-v6-flow-feature/);
  assert.match(fix, /safeSessionSet\(FLOW_FEATURE_KEY, 'normal'\)/);
  assert.match(fix, /dispatchTrack\('flow_start', \{ feature: 'normal' \}\)/);
});

test('history months are bounded and validation focuses the bad field', async () => {
  const fix = await read('js/v263-precision-upgrade-ux.js');
  assert.match(fix, /input\.max = CURRENT_MONTH/);
  assert.match(fix, /结束年月不能晚于当前月份/);
  assert.match(fix, /aria-invalid/);
  assert.match(fix, /target\.focus/);
  assert.match(fix, /scrollIntoView/);
  assert.match(fix, /v263-field-error/);
});

test('page release badge and notes are updated to V2.6.3', async () => {
  const release = await read('js/release-v25.js');
  assert.match(release, /RELEASE_VERSION = 'v2\.6\.3'/);
  assert.match(release, /RELEASE_DATE = '2026-09-15'/);
  assert.match(release, /精简快速测算结果页的升级入口/);
  assert.match(release, /Quick 升级到精准测算后改为新建独立流程统计/);
  assert.match(release, /v2\.6\.0 · 2026-09-12/);
});
