import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const host = 'https://yanglao.zhibeimao.com';
const routes = [
  ['guides/flexible-employment-pension.html','flexible-employment-pension','early'],
  ['guides/minimum-pension-years.html','minimum-pension-years','early'],
  ['tools/retirement-age.html','retirement-age','age'],
];

test('acquisition P1 has three independent crawlable intent pages', async () => {
  for (const [path,slug,intent] of routes) {
    const html = await read(path);
    const url = host + '/' + path;
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<title>[^<]{25,}<\/title>/);
    assert.match(html, /<h1>[^<]{15,}<\/h1>/);
    assert.ok(html.includes('<link rel="canonical" href="' + url + '">'));
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.match(html, /<meta name="description" content="[^"]{55,}"/);
    assert.ok(html.includes('data-landing-cta="' + slug + '"'));
    assert.ok(html.includes('href="/?entry=' + intent + '&landing=' + slug + '"'));
    assert.match(html, /landing-growth\.js\?v=20261008-p1/);
    assert.match(html, /政策依据与更新/);
    assert.match(html, /2026-10-08/);
    assert.doesNotMatch(html, /<script[^>]*src="[^"]*employee-v4/);
  }
});

test('landing pages have official references and cross-links, not duplicate algorithms', async () => {
  const flex = await read(routes[0][0]);
  const years = await read(routes[1][0]);
  const age = await read(routes[2][0]);
  assert.match(flex, /灵活就业/);
  assert.match(flex, /20%/);
  assert.match(years, /2025—2039/);
  assert.match(years, /2030 年/);
  assert.match(years, /20 年/);
  assert.match(age, /退休年龄/);
  for(const html of [flex,years,age]){
    assert.match(html, /mohrss\.gov\.cn|gov\.cn/);
    assert.match(html, /\/guides\/flexible-employment-pension\.html/);
    assert.match(html, /\/guides\/minimum-pension-years\.html/);
    assert.match(html, /\/tools\/retirement-age\.html/);
    assert.doesNotMatch(html, /function calcPension|function calcRetirementAge/);
  }
});

test('homepage and sitemap discover new pages without removing canonical homepage', async () => {
  const home = await read('index.html');
  const map = await read('sitemap.xml');
  assert.match(home, /landing-entry\.js\?v=20261008-p1/);
  assert.match(map, /<loc>https:\/\/yanglao\.zhibeimao\.com\/<\/loc>/);
  for(const [path] of routes){
    assert.ok(home.includes('href="/' + path + '"'));
    assert.ok(map.includes('<loc>' + host + '/' + path + '</loc>'));
  }
  assert.doesNotMatch(map, /<loc>.*\/(admin|api|v2-preview)\//);
});

test('landing tracking uses first-party anonymous events and preserves existing flow', async () => {
  const growth = await read('js/landing-growth.js');
  const entry = await read('js/landing-entry.js');
  const api = await read('api/event.php');
  const admin = await read('api/admin.php');
  const query = await read('api/acquisition-query.php');
  const dashboard = await read('admin/index.html');
  for(const name of ['landing_cta_click','landing_flow_start']){
    assert.match(api, new RegExp(name));
  }
  assert.match(growth, /import \{ track \} from/);
  assert.match(growth, /sessionStorage\.setItem/);
  assert.match(entry, /button\.click\(\)/);
  assert.match(entry, /history\.replaceState/);
  assert.match(admin, /require_once __DIR__ . '\/acquisition-query.php'/);
  assert.match(query, /function landing_acquisition_data\(/);
  assert.match(admin, /'acquisition' => safe_landing_acquisition_data\(\$pdo\)/);
  assert.match(query, /unavailable' => true/);
  assert.match(dashboard, /获客落地页/);
  assert.match(dashboard, /renderLandingAcquisition/);
  assert.doesNotMatch(growth + entry, /monthlyContributionBase|currentAccount|birth|password/);
});
