import {
  DATA_VERIFIED_AT,
  NATIONAL_POLICY_SOURCES,
  OFFICIAL_UPDATES,
  REGION_NAMES,
  getRegion as getBaseRegion,
} from './sources.js?v=20260829-v4';

export { DATA_VERIFIED_AT, NATIONAL_POLICY_SOURCES, OFFICIAL_UPDATES, REGION_NAMES };

// V4 only adds values that have an explicit provenance. `direct` means a primary
// government source is already recorded in the repository. `corroborated` means
// a public filing explicitly attributes the value to the local HRSS authority;
// it is useful as a planning anchor but is displayed as such, not as a primary-source value.
const V4_OVERRIDES = {
  shaanxi: {
    name: '陕西',
    level: 'corroborated',
    calcBase: {
      value: 7881,
      year: 2025,
      label: '2025年基本养老金计发基数',
      published: '2026-07-31',
      issuer: '公开证券文件（引述陕西省人社厅数据）',
      sourceLevel: 'corroborated',
      url: 'https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=12472847&stockid=000516',
      note: '该公开文件明确写明“根据陕西省人力资源和社会保障厅数据，2025年陕西省基本养老金计发基数为7881元/月”。当前未找到可稳定直链的陕西人社原始公告，因此页面按“公开披露参考值”展示。',
    },
    flexRule: {
      minRatio: 0.6,
      maxRatio: 3,
      label: '灵活就业人员可在本省全口径城镇单位就业人员平均工资60%—300%之间选择缴费基数',
      sourceLevel: 'direct',
      url: 'https://rst.shaanxi.gov.cn/sy/bsdt/202503/t20250310_3458757.html',
    },
  },
};

export function getRegionV4(key) {
  const base = getBaseRegion(key);
  const override = V4_OVERRIDES[key];
  if (!override) {
    const calcBase = base.calcBase
      ? { ...base.calcBase, sourceLevel: base.calcBase.sourceLevel || 'direct' }
      : undefined;
    return { ...base, calcBase };
  }
  return {
    ...base,
    ...override,
    calcBase: override.calcBase || (base.calcBase ? { ...base.calcBase, sourceLevel: base.calcBase.sourceLevel || 'direct' } : undefined),
    contribution: override.contribution || base.contribution,
    method: override.method || base.method,
  };
}

export function regionOptionsV4() {
  return [
    ...Object.entries(REGION_NAMES).map(([key, name]) => ({ key, name })),
    { key: 'other', name: '暂不确定 / 其他' },
  ];
}

export function calcBaseSourceLabel(calcBase) {
  if (!calcBase) return '未收录';
  if (calcBase.sourceLevel === 'direct') return '官方已核验';
  if (calcBase.sourceLevel === 'corroborated') return '公开披露参考';
  return '参考数据';
}
