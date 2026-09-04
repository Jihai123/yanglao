import {
  REGION_POLICY_RUNTIME as BASE_RUNTIME,
  REGION_POLICY_RUNTIME_VERSION as BASE_VERSION,
  calcBasePolicyLabel as baseCalcBasePolicyLabel,
  contributionPolicyLabel,
} from './region-policy-runtime.generated.js?v=20260903-r1';

// Effective runtime registry. The generated snapshot remains the official-data
// baseline. This facade applies reviewed evidence upgrades plus a deliberately
// separate public-reference tier for regions whose official calc-base page is
// still unavailable. CI verifies both layers so a research candidate cannot
// silently become a production default.
export const REGION_POLICY_RUNTIME_VERSION = `${BASE_VERSION}-r4`;

const PUBLIC_REFERENCE_NOTE = '公开资料参考值 · 暂未找到可直接引用的省级人社官方原文。仅用于退休规划估算，如掌握当地最新官方数据，可自行修改。';

function publicReference(year, value, sourceLevel, url) {
  return {
    year,
    value,
    status: 'public_reference',
    runtimeEligible: true,
    userEditable: true,
    sourceLevel,
    url,
    note: PUBLIC_REFERENCE_NOTE,
  };
}

export const REGION_POLICY_RUNTIME = {
  ...BASE_RUNTIME,
  shanxi: {
    ...BASE_RUNTIME.shanxi,
    researchStatus: 'public_reference_enabled',
    calcBase: publicReference(
      2025,
      7253,
      'secondary_policy_reprint',
      'https://zc.51shebao.com/detail/839909',
    ),
  },
  chongqing: {
    ...BASE_RUNTIME.chongqing,
    researchStatus: 'public_reference_enabled',
    calcBase: publicReference(
      2025,
      8240,
      'corroborated_public_reports',
      'https://www.sohu.com/a/956602818_122343943',
    ),
  },
  sichuan: {
    ...BASE_RUNTIME.sichuan,
    researchStatus: 'public_reference_enabled',
    calcBase: publicReference(
      2025,
      8462,
      'unverified_public_reference',
      'https://m.sohu.com/a/962044797_122341601/',
    ),
  },
  shaanxi: {
    ...BASE_RUNTIME.shaanxi,
    researchStatus: 'public_reference_enabled',
    calcBase: publicReference(
      2025,
      7881,
      'public_filing_quote',
      'https://www.9fzt.com/detail/sz_000516_9_6821d7ee2f10de41b0023d3d28ff82d9.html',
    ),
  },
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

export function calcBasePolicyLabel(calcBase) {
  if (calcBase?.status === 'public_reference') {
    return `${calcBase.year}年 · ${calcBase.note || PUBLIC_REFERENCE_NOTE}`;
  }
  return baseCalcBasePolicyLabel(calcBase);
}

export { contributionPolicyLabel };

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
