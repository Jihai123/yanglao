import {
  DATA_VERIFIED_AT,
  NATIONAL_POLICY_SOURCES,
  OFFICIAL_UPDATES,
  REGION_NAMES,
  getRegion as getLegacyRegion,
} from './sources.js?v=20260829-v4';
import {
  REGION_POLICY_RUNTIME_VERSION,
  calcBasePolicyLabel,
  contributionPolicyLabel,
  getRuntimeRegion,
  resolveRuntimeRegion,
  runtimeSubregionOptions,
} from './region-policy-runtime.js?v=20260904-r3';

export { DATA_VERIFIED_AT, NATIONAL_POLICY_SOURCES, OFFICIAL_UPDATES, REGION_NAMES, REGION_POLICY_RUNTIME_VERSION };

export const REGION_POLICY_VERIFIED_AT = '2026-09-04';

function normalizeContribution(contribution) {
  if (!contribution) return undefined;
  return {
    ...contribution,
    current: contribution.status === 'current' || contribution.status === 'current_derived',
    fallback: contribution.status === 'recent_fallback' || contribution.status === 'recent_fallback_derived',
    label: contributionPolicyLabel(contribution),
  };
}

function normalizeCalcBase(calcBase) {
  if (!calcBase) return undefined;
  return {
    ...calcBase,
    label: calcBasePolicyLabel(calcBase),
    sourceLevel: calcBase.sourceLevel || 'official',
  };
}

function mergePolicy(regionKey, subregionKey = '') {
  const legacy = getLegacyRegion(regionKey);
  const runtime = resolveRuntimeRegion(regionKey, subregionKey);
  if (!runtime) return { ...legacy };
  return {
    ...legacy,
    ...runtime,
    name: runtime.name || legacy.name,
    level: 'region-policy-v2',
    contribution: normalizeContribution(runtime.contribution),
    calcBase: normalizeCalcBase(runtime.calcBase),
    needsSubregion: Boolean(runtime.needsSubregion),
    subregionRequired: Boolean(runtime.subregionRequired),
    subregionKey: runtime.subregionKey || '',
    subregionName: runtime.subregionName || '',
    policyRuntimeVersion: REGION_POLICY_RUNTIME_VERSION,
  };
}

export function getRegionV5(key) {
  const runtime = getRuntimeRegion(key);
  if (!runtime) return getLegacyRegion(key);
  return mergePolicy(key, '');
}

export function resolveRegionV5(regionKey, subregionKey = '') {
  return mergePolicy(regionKey, subregionKey);
}

export function regionOptionsV5() {
  return [
    ...Object.entries(REGION_NAMES).map(([key, name]) => ({ key, name })),
    { key: 'other', name: '暂不确定 / 其他' },
  ];
}

export function subregionOptionsV5(regionKey) {
  return runtimeSubregionOptions(regionKey);
}

export function calcBaseSourceLabelV5(calcBase) {
  return calcBase ? calcBasePolicyLabel(calcBase) : '未收录';
}

export function contributionSourceLabelV5(contribution) {
  return contribution ? contributionPolicyLabel(contribution) : '未收录';
}
