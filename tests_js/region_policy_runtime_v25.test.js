import test from 'node:test';
import assert from 'node:assert/strict';

import { REGION_NAMES } from '../js/sources.js';
import {
  REGION_POLICY_RUNTIME_VERSION,
  getRegionV5,
  resolveRegionV5,
  subregionOptionsV5,
} from '../js/sources-v5.js';

test('release-gated runtime registry covers all 31 provincial regions', () => {
  assert.match(REGION_POLICY_RUNTIME_VERSION, /^2026-09-03-/);
  for (const key of Object.keys(REGION_NAMES)) {
    assert.equal(getRegionV5(key).name, REGION_NAMES[key], key);
  }
});

test('fallback contribution values remain clearly non-current but runtime eligible', () => {
  const sichuan = getRegionV5('sichuan');
  assert.equal(sichuan.contribution.year, 2025);
  assert.equal(sichuan.contribution.min, 4588);
  assert.equal(sichuan.contribution.current, false);
  assert.equal(sichuan.contribution.fallback, true);
  assert.equal(sichuan.contribution.runtimeEligible, true);
  assert.match(sichuan.contribution.label, /最近官方标准/);
});

test('provisional and formula-based calc bases keep semantic labels', () => {
  const innerMongolia = getRegionV5('neimenggu');
  assert.equal(innerMongolia.calcBase.value, 8179);
  assert.match(innerMongolia.calcBase.label, /预发参考值/);

  const shanghai = getRegionV5('shanghai');
  assert.equal(shanghai.calcBase.value, 12434);
  assert.match(shanghai.calcBase.label, /官方公式参考值/);
});

test('approved public references auto-fill but remain explicitly non-official and editable', () => {
  const expected = {
    shanxi: 7253,
    chongqing: 8240,
    sichuan: 8462,
    shaanxi: 7881,
  };
  for (const [key, value] of Object.entries(expected)) {
    const region = getRegionV5(key);
    assert.equal(region.calcBase.value, value, key);
    assert.equal(region.calcBase.status, 'public_reference', key);
    assert.equal(region.calcBase.runtimeEligible, true, key);
    assert.equal(region.calcBase.userEditable, true, key);
    assert.match(region.calcBase.label, /公开资料参考值/, key);
    assert.match(region.calcBase.label, /官方原文暂未找到/, key);
    assert.match(region.calcBase.label, /自行修改/, key);
  }
});

test('regions without a stable reference still stay manual-only', () => {
  for (const key of ['henan', 'hubei', 'hainan']) {
    const region = getRegionV5(key);
    assert.equal(region.calcBase, undefined, key);
  }
});

test('subregional calc-base policies require explicit selection and never leak province defaults', () => {
  assert.equal(resolveRegionV5('liaoning', '').subregionRequired, true);
  assert.equal(resolveRegionV5('liaoning', '').calcBase, undefined);
  assert.equal(resolveRegionV5('liaoning', 'shenyang').calcBase.value, 8390);

  assert.equal(resolveRegionV5('shandong', '').calcBase, undefined);
  assert.equal(resolveRegionV5('shandong', 'province_except_heze').calcBase.value, 7831);
  assert.equal(resolveRegionV5('shandong', 'heze').calcBase, undefined);
});

test('Guangdong keeps contribution subregions separate and uses Shenzhen enterprise calc base', () => {
  assert.equal(subregionOptionsV5('guangdong').length, 3);
  const guangzhou = resolveRegionV5('guangdong', 'guangzhou_province_direct');
  assert.equal(guangzhou.contribution.min, 5510);
  assert.equal(guangzhou.calcBase.value, 9493);

  const shenzhen = resolveRegionV5('guangdong', 'shenzhen');
  assert.equal(shenzhen.contribution, undefined);
  assert.equal(shenzhen.calcBase.value, 11293);
  assert.match(shenzhen.calcBase.label, /2025年最近可核验官方值/);
});

test('Yunnan 2026 contribution range is current and runtime eligible', () => {
  const yunnan = getRegionV5('yunnan');
  assert.equal(yunnan.contribution.year, 2026);
  assert.equal(yunnan.contribution.min, 4403);
  assert.equal(yunnan.contribution.max, 22017);
  assert.equal(yunnan.contribution.current, true);
  assert.equal(yunnan.contribution.runtimeEligible, true);
  assert.match(yunnan.contribution.label, /2026年当前官方标准/);
});

test('Jilin annual published calc bases are normalized to monthly planning values', () => {
  const changchun = resolveRegionV5('jilin', 'changchun');
  assert.equal(changchun.calcBase.rawPublishedValue, '95739元/年');
  assert.equal(changchun.calcBase.value, 7978.25);
});
