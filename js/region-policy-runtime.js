import {
  REGION_POLICY_RUNTIME as BASE_RUNTIME,
  REGION_POLICY_RUNTIME_VERSION as BASE_VERSION,
  calcBasePolicyLabel,
  contributionPolicyLabel,
} from './region-policy-runtime.generated.js?v=20260903-r1';

// Effective runtime registry. The generated snapshot remains the bulk baseline;
// this facade applies same-day evidence upgrades that have already been written
// to the canonical CSV files. CI compares this effective registry back to the
// dictionary so a candidate value cannot silently become a production default.
export const REGION_POLICY_RUNTIME_VERSION = `${BASE_VERSION}-r2`;

export const REGION_POLICY_RUNTIME = {
  ...BASE_RUNTIME,
  yunnan: {
    ...BASE_RUNTIME.yunnan,
    researchStatus: 'current_verified_joint_notice',
    contribution: {
      year: 2026,
      min: 4403,
      max: 22017,
      status: 'current',
      runtimeEligible: true,
      sourceLevel: 'official_joint_notice_state_media',
      url: 'https://www.yn.xinhuanet.com/20260829/77b8cbc9d5d3436fae154f284755e76e/c.html',
    },
  },
  guangdong: {
    ...BASE_RUNTIME.guangdong,
    subregions: {
      ...BASE_RUNTIME.guangdong.subregions,
      shenzhen: {
        name: '深圳企业职工',
        contribution: null,
        calcBase: {
          year: 2025,
          value: 11293,
          status: 'recent_fallback',
          runtimeEligible: true,
          sourceLevel: 'official_primary_subregional',
          url: 'https://hrss.sz.gov.cn/zmhd/cjwt/cjwt/shbz/content/post_12493488.html',
        },
      },
    },
  },
};

export { calcBasePolicyLabel, contributionPolicyLabel };

export function getRuntimeRegion(key) {
  return REGION_POLICY_RUNTIME[key] || null;
}

export function runtimeSubregionOptions(regionKey) {
  const region = getRuntimeRegion(regionKey);
  return Object.entries(region?.subregions || {}).map(([key, item]) => ({ key, name: item.name }));
}

export function resolveRuntimeRegion(regionKey, subregionKey = '') {
  const region = getRuntimeRegion(regionKey);
  if (!region) return null;
  if (!region.needsSubregion) return { ...region, subregionKey: '', subregionName: '', subregionRequired: false };
  const subregion = region.subregions?.[subregionKey];
  if (!subregion) {
    return { ...region, contribution: undefined, calcBase: undefined, subregionKey: '', subregionName: '', subregionRequired: true };
  }
  const hasContributionOverride = Object.prototype.hasOwnProperty.call(subregion, 'contribution');
  const hasCalcOverride = Object.prototype.hasOwnProperty.call(subregion, 'calcBase');
  return {
    ...region,
    contribution: hasContributionOverride ? subregion.contribution : region.contribution,
    calcBase: hasCalcOverride ? subregion.calcBase : region.calcBase,
    subregionKey,
    subregionName: subregion.name,
    subregionRequired: false,
  };
}
