import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('preview feedback and analytics call root API paths', () => {
  const feedback = fs.readFileSync(new URL('../js/feedback.js', import.meta.url), 'utf8');
  const analytics = fs.readFileSync(new URL('../js/analytics.js', import.meta.url), 'utf8');

  assert.match(feedback, /const API = '\/api\/feedback\.php';/);
  assert.doesNotMatch(feedback, /const API = '\.\/api\/feedback\.php';/);
  assert.match(analytics, /const API = '\/api\/event\.php';/);
  assert.doesNotMatch(analytics, /const API = '\.\/api\/event\.php';/);
});
