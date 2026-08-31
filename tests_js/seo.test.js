import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('homepage exposes canonical SEO metadata', async () => {
  const html = await text('index.html');
  assert.match(html, /<title>养老金计算器2026｜退休年龄查询｜退休规划助手<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+" \/>/);
  assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/yanglao\.zhibeimao\.com\/" \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/yanglao\.zhibeimao\.com\/" \/>/);
});

test('robots allows production and blocks private or duplicate paths', async () => {
  const robots = await text('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/v2-preview\//);
  assert.match(robots, /Sitemap: https:\/\/yanglao\.zhibeimao\.com\/sitemap\.xml/);
});

test('sitemap contains only the canonical public homepage for now', async () => {
  const sitemap = await text('sitemap.xml');
  assert.match(sitemap, /<loc>https:\/\/yanglao\.zhibeimao\.com\/<\/loc>/);
  assert.doesNotMatch(sitemap, /\/admin\//);
  assert.doesNotMatch(sitemap, /\/api\//);
  assert.doesNotMatch(sitemap, /\/v2-preview\//);
});

test('admin dashboard remains noindex', async () => {
  const admin = await text('admin/index.html');
  assert.match(admin, /<meta name="robots" content="noindex,nofollow" \/>/);
});
