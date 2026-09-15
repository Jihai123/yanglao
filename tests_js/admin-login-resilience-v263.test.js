import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('admin login succeeds independently of enhanced analytics handoff', async () => {
  const html = await read('admin/index.html');

  assert.match(html, /const AUTH_API='\/api\/admin\.php'/);
  assert.match(html, /const DATA_API='\/api\/adminv\.php'/);
  assert.match(html, /renderLegacyFallback\(data\.dashboard\|\|\{\}\)/);
  assert.match(html, /loadDashboard\(\{preserveSession:true,fallbackDashboard:data\.dashboard\|\|\{\}\}\)/);
  assert.match(html, /for\(let attempt=0;attempt<3;attempt\+=1\)/);
  assert.match(html, /if\(lastStatus===401&&!preserveSession\)\{showLogin\(\);return false\}/);
  assert.match(html, /保留当前已登录看板/);
});

test('enhanced analytics features remain present after login resilience fix', async () => {
  const html = await read('admin/index.html');
  const api = await read('api/admin-v262.php');
  const proxy = await read('api/adminv.php');

  assert.match(html, /当前版本 V2\.6/);
  assert.match(html, /全部历史/);
  assert.match(html, /当前版本 · 失败流程审计/);
  assert.match(html, /renderDiagnostics\(data\.diagnostics\|\|\{\}\)/);
  assert.match(html, /renderAudit\(data\.audit\|\|\{\}\)/);
  assert.match(api, /'analytics_version' => 'a5'/);
  assert.match(api, /'blocked_flows'/);
  assert.match(api, /'recovered_flows'/);
  assert.match(proxy, /admin-v262\.php/);
});
