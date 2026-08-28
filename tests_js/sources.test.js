import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DATA_VERIFIED_AT,
  NATIONAL_POLICY_SOURCES,
  OFFICIAL_UPDATES,
  REGION_DATA,
  getRegion,
} from '../js/sources.js';

const OFFICIAL_HOSTS = [
  'mohrss.gov.cn',
  'gjzwfw.gov.cn',
  'beijing.gov.cn',
  'rsj.beijing.gov.cn',
  'rsj.sh.gov.cn',
  'jiangsu.gov.cn',
];

function officialUrl(url) {
  const host = new URL(url).hostname;
  return OFFICIAL_HOSTS.some(item => host === item || host.endsWith(`.${item}`));
}

test('source registry has a concrete verification date', () => {
  assert.match(DATA_VERIFIED_AT, /^20\d{2}-\d{2}-\d{2}$/);
});

test('all calculation policy sources use official government domains', () => {
  const sources = NATIONAL_POLICY_SOURCES.filter(item => item.type === 'calculation');
  assert.ok(sources.length >= 2);
  for (const source of sources) {
    assert.ok(officialUrl(source.url), source.url);
    assert.match(source.date, /^20\d{2}-\d{2}-\d{2}$/);
  }
});

test('official updates are informational unless explicitly modeled', () => {
  assert.ok(OFFICIAL_UPDATES.length >= 1);
  for (const item of OFFICIAL_UPDATES) {
    assert.equal(item.affectsCalculation, false);
    assert.ok(officialUrl(item.url));
  }
});

test('Beijing verified values retain source year and official URLs', () => {
  const beijing = REGION_DATA.beijing;
  assert.equal(beijing.calcBase.value, 12049);
  assert.equal(beijing.calcBase.year, 2025);
  assert.equal(beijing.contribution.year, 2026);
  assert.equal(beijing.contribution.min, 7270);
  assert.equal(beijing.contribution.max, 36348);
  assert.ok(officialUrl(beijing.calcBase.url));
  assert.ok(officialUrl(beijing.contribution.url));
});

test('Shanghai does not invent a pension calculation base', () => {
  const shanghai = REGION_DATA.shanghai;
  assert.equal(shanghai.calcBase, undefined);
  assert.equal(shanghai.contribution.year, 2026);
  assert.equal(shanghai.contribution.min, 7546);
  assert.equal(shanghai.contribution.max, 37731);
  assert.ok(officialUrl(shanghai.method.url));
});

test('unknown region falls back to manual mode', () => {
  assert.equal(getRegion('not-supported').level, 'manual');
});
