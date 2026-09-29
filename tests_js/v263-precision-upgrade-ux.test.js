import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('V2.6.3 UX module is loaded with a fresh cache key', async () => {
  const html = await read('index.html');
  assert.match(html, /v263-precision-upgrade-ux\.js\?v=20260915-v263/);
  assert.match(html, /trust-v5\.js\?v=20260929-v264/);
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

test('page release history keeps V2.6.3 under current V2.6.4', async () => {
  const release = await read('js/release-v25.js');
  assert.match(release, /RELEASE_VERSION = 'v2\.6\.4'/);
  assert.match(release, /RELEASE_DATE = '2026-09-29'/);
  assert.match(release, /v2\.6\.3 · 2026-09-15/);
  assert.match(release, /视同缴费年限会计入最低缴费年限判断/);
  assert.match(release, /v2\.6\.0 · 2026-09-12/);
});
