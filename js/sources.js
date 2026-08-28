export const DATA_VERIFIED_AT = '2026-08-28';

export const NATIONAL_POLICY_SOURCES = [
  {
    id: 'gradual-retirement',
    type: 'calculation',
    date: '2024-09-13',
    effective: '2025-01-01',
    issuer: '全国人大常委会 / 国务院',
    title: '关于实施渐进式延迟法定退休年龄的决定',
    summary: '规定渐进式延迟法定退休年龄、2030—2039最低缴费年限逐步提高，以及弹性退休基本框架。',
    url: 'https://www.mohrss.gov.cn/SYrlzyhshbzb/dongtaixinwen/buneiyaowen/rsxw/202409/t20240913_525781.html',
  },
  {
    id: 'flexible-retirement',
    type: 'calculation',
    date: '2025-01-01',
    effective: '2025-01-01',
    issuer: '人力资源社会保障部 / 中共中央组织部 / 财政部',
    title: '《实施弹性退休制度暂行办法》',
    summary: '明确弹性提前/延迟退休范围、办理规则，以及弹性延迟退休最低缴费年限按本人法定退休年龄对应年份确定。',
    url: 'https://www.mohrss.gov.cn/wap/zc/zcwj/202501/t20250101_533701.html',
  },
  {
    id: 'official-pension-calculator',
    type: 'crosscheck',
    date: '',
    effective: '',
    issuer: '人力资源社会保障部',
    title: '养老待遇测算（国家政务服务平台）',
    summary: '可用于与本站规划结果进行官方渠道交叉验证。',
    url: 'https://app.gjzwfw.gov.cn/jmopen/webapp/html5/yldycs/index.html',
  },
];

export const OFFICIAL_UPDATES = [
  {
    date: '2026-07-22',
    issuer: '人力资源社会保障部',
    title: '2026年7月例行新闻发布会',
    summary: '人社部通报延迟法定退休年龄改革总体平稳有序，并继续优化国家社保公共服务平台。',
    affectsCalculation: false,
    url: 'https://www.mohrss.gov.cn/SYrlzyhshbzb/dongtaixinwen/buneiyaowen/rsxw/202607/t20260722_580692.html',
  },
  {
    date: '2025-07-10',
    issuer: '人力资源社会保障部 / 财政部',
    title: '2025年调整退休人员基本养老金',
    summary: '全国总体调整比例按2024年退休人员月人均基本养老金的2%确定；适用于2024年12月31日前已退休并领取基本养老金人员。',
    affectsCalculation: false,
    url: 'https://www.mohrss.gov.cn/wap/zc/zcwj/202507/t20250710_548466.html',
  },
];

export const REGION_NAMES = {
  beijing: '北京', tianjin: '天津', hebei: '河北', shanxi: '山西', neimenggu: '内蒙古',
  liaoning: '辽宁', jilin: '吉林', heilongjiang: '黑龙江', shanghai: '上海', jiangsu: '江苏',
  zhejiang: '浙江', anhui: '安徽', fujian: '福建', jiangxi: '江西', shandong: '山东',
  henan: '河南', hubei: '湖北', hunan: '湖南', guangdong: '广东', guangxi: '广西',
  hainan: '海南', chongqing: '重庆', sichuan: '四川', guizhou: '贵州', yunnan: '云南',
  xizang: '西藏', shaanxi: '陕西', gansu: '甘肃', qinghai: '青海', ningxia: '宁夏', xinjiang: '新疆',
};

export const REGION_DATA = {
  other: {
    name: '其他地区',
    level: 'manual',
    note: '尚未收录可自动带入的最新官方参数。为了避免把过期或非官方数据当成准确值，金额测算继续使用你填写的数据。',
  },
  beijing: {
    name: '北京',
    level: 'verified',
    calcBase: {
      value: 12049,
      year: 2025,
      label: '2025年养老保险待遇计算基数',
      published: '2025-11-07',
      issuer: '北京市人力资源和社会保障局等',
      url: 'https://rsj.beijing.gov.cn/xxgk/2024zcwj/202511/t20251107_4265291.html',
    },
    contribution: {
      year: 2026,
      min: 7270,
      max: 36348,
      published: '2026-08-21',
      issuer: '北京市人力资源和社会保障局等',
      url: 'https://rsj.beijing.gov.cn/xxgk/2024zcwj/202608/t20260821_4831461.html',
    },
  },
  shanghai: {
    name: '上海',
    level: 'verified-partial',
    contribution: {
      year: 2026,
      min: 7546,
      max: 37731,
      published: '2026-08-24',
      issuer: '上海市人力资源和社会保障局',
      url: 'https://rsj.sh.gov.cn/tdjjf_17554/20260824/t0035_1443297.html',
    },
    method: {
      published: '2026-08-13',
      issuer: '上海市人力资源和社会保障局',
      label: '企业基本养老金计发办法',
      url: 'https://rsj.sh.gov.cn/tshbx_17729/20260813/t0035_1443100.html',
    },
    note: '已核验2026缴费基数上下限和最新计发办法；当前未自动推导计发基数，精确输入时请按上海人社最新公布口径填写。',
  },
  jiangsu: {
    name: '江苏',
    level: 'verified-method',
    method: {
      published: '2025-02-26',
      issuer: '江苏省人力资源和社会保障厅',
      label: '江苏省企业职工基本养老保险实施办法',
      url: 'https://www.jiangsu.gov.cn/art/2025/2/26/art_64797_11500401.html',
    },
    note: '已核验养老金计发公式来源；当前不自动带入未核验为2026最新的数值参数。',
  },
};

export function getRegion(key) {
  if (REGION_DATA[key]) return REGION_DATA[key];
  return {
    ...REGION_DATA.other,
    name: REGION_NAMES[key] || REGION_DATA.other.name,
  };
}

export function regionOptions() {
  return [
    ...Object.entries(REGION_NAMES).map(([key, name]) => ({ key, name })),
    { key: 'other', name: '其他 / 暂不确定' },
  ];
}
