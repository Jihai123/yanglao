// Generated from data/region-policy/employee-pension.v2.csv + subregions.v1.csv.
// Do not put user data here. This module contains public policy parameters only.
export const REGION_POLICY_RUNTIME_VERSION = '2026-09-03-release-gate';

export const REGION_POLICY_RUNTIME = {
  "beijing": {
    "name": "北京",
    "researchStatus": "current_verified",
    "contribution": {"year":2026,"min":7270,"max":36348,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rsj.beijing.gov.cn/xxgk/2024zcwj/202608/t20260821_4831461.html"},
    "calcBase": {"year":2025,"value":12049,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rsj.beijing.gov.cn/xxgk/2024zcwj/202511/t20251107_4265291.html"}
  },
  "tianjin": {
    "name": "天津","researchStatus":"current_verified_with_fallback_calc",
    "contribution":{"year":2026,"min":5180,"max":25902,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://www.tj.gov.cn/sy/tjxw/202608/t20260823_7356881.html"},
    "calcBase":{"year":2025,"value":9417,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_government","url":"https://www.tj.gov.cn/sy/tjxw/202511/t20251118_7179836.html"}
  },
  "hebei": {
    "name":"河北","researchStatus":"fallback_verified_reprint",
    "contribution":{"year":2025,"min":4007,"max":20034,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_hrss_reprint","url":"https://rsj.chengde.gov.cn/art/2025/10/22/art_2829_1087786.html"},
    "calcBase":{"year":2025,"value":7410,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_hrss_reprint","url":"https://rsj.chengde.gov.cn/art/2025/10/22/art_2829_1087786.html"}
  },
  "shanxi": {
    "name":"山西","researchStatus":"current_verified_calc_candidate_manual",
    "contribution":{"year":2026,"min":4244,"max":21219,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://shanxi.chinatax.gov.cn/son/detail/sf-11407-522-1824057"}
  },
  "neimenggu": {
    "name":"内蒙古","researchStatus":"current_verified_with_provisional_calc",
    "contribution":{"year":2026,"min":5058,"max":25290,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://neimenggu.chinatax.gov.cn/xxgk/tzgg/202608/t20260831_897017.html"},
    "calcBase":{"year":2026,"value":8179,"status":"current_provisional","runtimeEligible":true,"sourceLevel":"official_local_hrss_provisional","url":"https://rsj.baotou.gov.cn/ywdt/gzdt/202606/t20260622_928873.html"}
  },
  "liaoning": {
    "name":"辽宁","researchStatus":"fallback_verified_subregional","needsSubregion":true,
    "contribution":{"year":2025,"min":4359,"max":21792,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rst.ln.gov.cn/rst/zxzx/gsgg/2025092012232024861/index.shtml"},
    "subregions":{
      "province_except_shenyang_dalian":{"name":"全省（不含沈阳、大连）","calcBase":{"year":2025,"value":7346,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://rst.ln.gov.cn/rst/zxzx/gsgg/2025092012232024861/index.shtml"}},
      "shenyang":{"name":"沈阳","calcBase":{"year":2025,"value":8390,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://rst.ln.gov.cn/rst/zxzx/gsgg/2025092012232024861/index.shtml"}},
      "dalian":{"name":"大连","calcBase":{"year":2025,"value":8956,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://rst.ln.gov.cn/rst/zxzx/gsgg/2025092012232024861/index.shtml"}}
    }
  },
  "jilin": {
    "name":"吉林","researchStatus":"fallback_verified_subregional","needsSubregion":true,
    "contribution":{"year":2025,"min":4393.2,"max":21966,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://xxgk.jl.gov.cn/zcbm/fgw_97992/xxgkmlqy/202509/t20250922_9324837.html"},
    "subregions":{
      "province_except_changchun_reclamation":{"name":"全省（不含长春、农垦）","calcBase":{"year":2025,"value":7322.08,"rawPublishedValue":"87865元/年","status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://xxgk.jl.gov.cn/zcbm/fgw_97992/xxgkmlqy/202509/t20250922_9324837.html"}},
      "changchun":{"name":"长春","calcBase":{"year":2025,"value":7978.25,"rawPublishedValue":"95739元/年","status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://xxgk.jl.gov.cn/zcbm/fgw_97992/xxgkmlqy/202509/t20250922_9324837.html"}},
      "agricultural_reclamation":{"name":"农垦","contribution":{"year":2025,"min":1334.1,"max":6670.3,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://xxgk.jl.gov.cn/zcbm/fgw_97992/xxgkmlqy/202509/t20250922_9324837.html"},"calcBase":{"year":2025,"value":2223.42,"rawPublishedValue":"26681元/年","status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://xxgk.jl.gov.cn/zcbm/fgw_97992/xxgkmlqy/202509/t20250922_9324837.html"}}
    }
  },
  "heilongjiang": {
    "name":"黑龙江","researchStatus":"current_verified_formula",
    "contribution":{"year":2026,"min":4623,"max":23115,"status":"current_derived","runtimeEligible":true,"sourceLevel":"official_primary_formula_derived","url":"https://hrss.hlj.gov.cn/hrss/c116755/202603/31920862/files/2026%E5%B9%B4%E5%BA%A6%E5%85%A8%E7%9C%81%E5%9F%BA%E6%9C%AC%E5%85%BB%E8%80%81%E4%BF%9D%E9%99%A9%E4%BD%BF%E7%94%A8%E5%B7%A5%E8%B5%84%E5%9F%BA%E6%95%B0.pdf"},
    "calcBase":{"year":2026,"value":7705,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://hrss.hlj.gov.cn/hrss/c116755/202603/31920862/files/2026%E5%B9%B4%E5%BA%A6%E5%85%A8%E7%9C%81%E5%9F%BA%E6%9C%AC%E5%85%BB%E8%80%81%E4%BF%9D%E9%99%A9%E4%BD%BF%E7%94%A8%E5%B7%A5%E8%B5%84%E5%9F%BA%E6%95%B0.pdf"}
  },
  "shanghai": {
    "name":"上海","researchStatus":"current_with_calc_formula_anchor",
    "contribution":{"year":2026,"min":7546,"max":37731,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rsj.sh.gov.cn/tdjjf_17554/20260824/t0035_1443297.html"},
    "calcBase":{"year":2025,"value":12434,"status":"recent_fallback_formula_anchor","runtimeEligible":true,"sourceLevel":"official_primary_formula_anchor","url":"https://rsj.sh.gov.cn/tgsgg_17341/20250918/t0035_1435637.html"}
  },
  "jiangsu": {
    "name":"江苏","researchStatus":"fallback_verified_with_calc",
    "contribution":{"year":2025,"min":4952,"max":24762,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://jshrss.jiangsu.gov.cn/art/2025/9/18/art_77277_11643402.html"},
    "calcBase":{"year":2025,"value":8917,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_government_reprint","url":"https://www.jinhu.gov.cn/col/1387_142711/o/index.html"}
  },
  "zhejiang": {
    "name":"浙江","researchStatus":"fallback_verified_with_formula_calc",
    "contribution":{"year":2025,"min":4986,"max":25299,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://zhejiang.chinatax.gov.cn/art/2025/12/11/art_13314_645797.html"},
    "calcBase":{"year":2025,"value":8433,"status":"recent_fallback_derived","runtimeEligible":true,"sourceLevel":"official_primary_formula_derived","url":"https://rlsbt.zj.gov.cn/art/2025/9/18/art_1229506773_2569490.html"}
  },
  "anhui": {
    "name":"安徽","researchStatus":"fallback_verified_with_calc",
    "contribution":{"year":2025,"min":4311,"max":21556,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_reprint","url":"https://www.ahjd.gov.cn/Jczwgk/show/3644676.html"},
    "calcBase":{"year":2025,"value":7999,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary_canonical","url":"https://hrss.ah.gov.cn/public/6595721/80776356.html"}
  },
  "fujian": {
    "name":"福建","researchStatus":"fallback_verified",
    "contribution":{"year":2025,"min":4043,"max":22607,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rst.fujian.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/ldgx/202509/t20250922_7013397.htm"},
    "calcBase":{"year":2025,"value":7932,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rst.fujian.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/ldgx/202509/t20250922_7013397.htm"}
  },
  "jiangxi": {
    "name":"江西","researchStatus":"fallback_verified_with_calc",
    "contribution":{"year":2025,"min":3915,"max":19575,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local","url":"https://xjq.nc.gov.cn/xjqrmzf/shbx/202604/8ac7215a9886424ebcc603304c99e7a8.shtml"},
    "calcBase":{"year":2025,"value":7054,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_government_reprint","url":"https://www.jxln.gov.cn/lnxxxgk/zcwjscbhg/202512/8aa82bef0c2c4fcca30840e9549bc177.shtml"}
  },
  "shandong": {
    "name":"山东","researchStatus":"fallback_verified_subregional_calc","needsSubregion":true,
    "contribution":{"year":2025,"min":4504,"max":22518,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_reprint","url":"https://www.jinan.gov.cn/col/col118356/art/2026/art_68ec8fccb74b466f915ae5db4cf93951.html"},
    "subregions":{
      "province_except_heze":{"name":"全省（不含菏泽）","calcBase":{"year":2025,"value":7831,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary_subregional","url":"http://hrss.shandong.gov.cn/articles/ch00378/202510/1e743c80-1abf-47a8-b62a-db2518c0820b.shtml"}},
      "heze":{"name":"菏泽","calcBase":null}
    }
  },
  "henan": {"name":"河南","researchStatus":"fallback_verified_reprint","contribution":{"year":2025,"min":3831,"max":19155,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_reprint","url":"https://public.zzgx.gov.cn/D280901X/9691790.jhtml"}},
  "hubei": {
    "name":"湖北","researchStatus":"fallback_verified_subregional","needsSubregion":true,
    "subregions":{
      "tier1":{"name":"武汉市 / 省直","contribution":{"year":2025,"min":4498,"max":22488,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://rst.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/202509/t20250919_5775307.shtml"}},
      "tier2":{"name":"黄石 / 十堰 / 襄阳 / 宜昌 / 荆门 / 随州 / 恩施","contribution":{"year":2025,"min":4299,"max":21678,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://rst.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/202509/t20250919_5775307.shtml"}},
      "tier3":{"name":"荆州 / 鄂州 / 孝感 / 黄冈 / 咸宁 / 仙桃 / 天门 / 潜江 / 神农架","contribution":{"year":2025,"min":4254,"max":21462,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://rst.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/202509/t20250919_5775307.shtml"}}
    }
  },
  "hunan": {"name":"湖南","researchStatus":"current_verified","contribution":{"year":2026,"min":4106,"max":20529,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rst.hunan.gov.cn/rst/xxgk/zcfg/zxzc/202608/t20260822_34049202.html"},"calcBase":{"year":2025,"value":7694,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rst.hunan.gov.cn/rst/xxgk/zcfg/zxzc/202509/t20250922_33809937.html"}},
  "guangdong": {
    "name":"广东","researchStatus":"fallback_verified_subregional","needsSubregion":true,
    "subregions":{
      "guangzhou_province_direct":{"name":"广州 / 省直","contribution":{"year":2025,"min":5510,"max":27549,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://guangdong.chinatax.gov.cn/gdsw/ssfggds/2025-10/27/content_ba2a20bf040648e089f9edf9f557fa2b.shtml"},"calcBase":{"year":2025,"value":9493,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://guangdong.chinatax.gov.cn/gdsw/ssfggds/2025-10/27/content_ba2a20bf040648e089f9edf9f557fa2b.shtml"}},
      "other_excluding_shenzhen":{"name":"其他地区（不含深圳）","contribution":{"year":2025,"min":4775,"max":27549,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_subregional","url":"https://guangdong.chinatax.gov.cn/gdsw/ssfggds/2025-10/27/content_ba2a20bf040648e089f9edf9f557fa2b.shtml"},"calcBase":{"year":2025,"value":9493,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://guangdong.chinatax.gov.cn/gdsw/ssfggds/2025-10/27/content_ba2a20bf040648e089f9edf9f557fa2b.shtml"}},
      "shenzhen":{"name":"深圳","contribution":null,"calcBase":null}
    }
  },
  "guangxi": {"name":"广西","researchStatus":"fallback_verified_with_calc","contribution":{"year":2025,"min":4143,"max":20715,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://guangxi.chinatax.gov.cn/xwdt/ztzl/jdxjmqysbf/zcwj_16519/202511/t20251127_425843.html"},"calcBase":{"year":2025,"value":6983,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"http://rst.gxzf.gov.cn/zwgk/xxgkzcfg/fgfxlm/t25993557.shtml"}},
  "hainan": {"name":"海南","researchStatus":"fallback_verified_primary_url","contribution":{"year":2025,"min":4912.8,"max":24564,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://hrss.hainan.gov.cn/hrss/0503/202509/802b311fa8cd4218821074e1ae087a86.shtml?ddtab=true"}},
  "chongqing": {"name":"重庆","researchStatus":"fallback_verified_calc_candidate_manual","contribution":{"year":2025,"min":4404,"max":22017,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rlsbj.cq.gov.cn/zwgk_182/zfxxgkml/zcwj_145360/jfxzgfxwj/202509/t20250919_15024385.html"}},
  "sichuan": {"name":"四川","researchStatus":"fallback_verified_calc_candidate_manual","contribution":{"year":2025,"min":4588,"max":22938,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_reprint","url":"https://rsj.yaan.gov.cn/xinwen/show/05f5a92513584af1395fdc63c3dc0fcd.html"}},
  "guizhou": {"name":"贵州","researchStatus":"fallback_verified_formula_with_calc_anchor","contribution":{"year":2025,"min":4394.7,"max":21973.5,"status":"recent_fallback_derived","runtimeEligible":true,"sourceLevel":"official_primary_formula_derived","url":"https://rst.guizhou.gov.cn/zwgk/zfxxgk/fdzdgknr/qtfdxx/ggfwsx/202509/t20250919_88635347.html"},"calcBase":{"year":2025,"value":7324.5,"status":"recent_fallback_formula_anchor","runtimeEligible":true,"sourceLevel":"official_primary_formula_anchor","url":"https://rst.guizhou.gov.cn/zwgk/zfxxgk/fdzdgknr/qtfdxx/ggfwsx/202509/t20250919_88635347.html"}},
  "yunnan": {"name":"云南","researchStatus":"current_candidate_with_official_fallback","contribution":{"year":2026,"min":4403,"max":22017,"status":"current","runtimeEligible":false,"sourceLevel":"official_notice_reported_by_xinhua","url":"https://www.yn.xinhuanet.com/20260829/77b8cbc9d5d3436fae154f284755e76e/c.html"},"calcBase":{"year":2025,"value":8265,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_mohrss_portal","url":"https://chinajob.mohrss.gov.cn/c/2025-10-20/455967.shtml"}},
  "xizang": {"name":"西藏","researchStatus":"fallback_verified_with_calc_anchor","contribution":{"year":2025,"min":7066.2,"max":35331,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_reprint","url":"https://hrss.lasa.gov.cn/rsj/xxyw/202509/94481a07de4044239c6111a6cc4936ba.shtml"},"calcBase":{"year":2025,"value":11777,"status":"recent_fallback_formula_anchor","runtimeEligible":true,"sourceLevel":"official_local_hrss_reprint","url":"https://hrss.lasa.gov.cn/rsj/xxyw/202509/94481a07de4044239c6111a6cc4936ba.shtml"}},
  "shaanxi": {"name":"陕西","researchStatus":"split_quality_calc_candidate_manual","contribution":{"year":2025,"min":4650,"max":23250,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://shaanxi.chinatax.gov.cn/art/2025/9/30/art_5383_698154.html"}},
  "gansu": {"name":"甘肃","researchStatus":"current_verified_with_calc_fallback","contribution":{"year":2026,"min":4526,"max":22626,"status":"current","runtimeEligible":true,"sourceLevel":"official_primary_repost","url":"https://zwfw.gansu.gov.cn/jiuquan/zczx/jqyw/art/2026/art_e7467f7bccaf485fb93880312f551b39.html"},"calcBase":{"year":2024,"value":7594,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_hrss_reprint","url":"https://www.jyg.gov.cn/rsj/xwdt/bmdt/art/2025/art_2de3800b28314efb932da6c79eda737d.html"}},
  "qinghai": {"name":"青海","researchStatus":"split_quality","contribution":{"year":2025,"min":5289.6,"max":26448,"status":"recent_fallback_derived","runtimeEligible":false,"sourceLevel":"official_text_republished_formula_derived","url":"http://rsj.haibei.gov.cn/xwzx/tzgg/9282861.html"},"calcBase":{"year":2025,"value":9056,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_local_hrss_reprint","url":"http://rsj.haibei.gov.cn/xwzx/tzgg/9282861.html"}},
  "ningxia": {"name":"宁夏","researchStatus":"fallback_verified","contribution":{"year":2025,"min":4955,"max":24774,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://hrss.nx.gov.cn/xxgk/zcj/zcfg/shbz/202509/t20250921_5030586.html"},"calcBase":{"year":2025,"value":8366,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://hrss.nx.gov.cn/xxgk/zcj/zcfg/shbz/202509/t20250921_5030586.html"}},
  "xinjiang": {"name":"新疆","researchStatus":"fallback_verified_with_calc_anchor","contribution":{"year":2025,"min":5069,"max":25344,"status":"recent_fallback","runtimeEligible":true,"sourceLevel":"official_primary","url":"https://rst.xinjiang.gov.cn/xjrst/zcwj/202509/18cb0640282f47ed96226e02a95a9270.shtml"},"calcBase":{"year":2025,"value":8448,"status":"recent_fallback_formula_anchor","runtimeEligible":true,"sourceLevel":"official_primary_formula_anchor","url":"https://rst.xinjiang.gov.cn/xjrst/zcwj/202509/18cb0640282f47ed96226e02a95a9270.shtml"}}
};

export function contributionPolicyLabel(contribution) {
  if (!contribution) return '未收录';
  if (contribution.status === 'current') return `${contribution.year}年当前官方标准`;
  if (contribution.status === 'current_derived') return `${contribution.year}年按官方规则计算`;
  if (contribution.status === 'recent_fallback') return `${contribution.year}年最近官方标准`;
  if (contribution.status === 'recent_fallback_derived') return `${contribution.year}年按官方规则计算的最近标准`;
  return `${contribution.year || ''}年参考标准`.replace(/^年/, '');
}

export function calcBasePolicyLabel(calcBase) {
  if (!calcBase) return '未收录';
  if (calcBase.status === 'current') return `${calcBase.year}年当前官方值`;
  if (calcBase.status === 'current_provisional') return `${calcBase.year}年预发参考值`;
  if (calcBase.status === 'recent_fallback') return `${calcBase.year}年最近可核验官方值`;
  if (calcBase.status === 'recent_fallback_formula_anchor') return `${calcBase.year}年官方公式参考值`;
  if (calcBase.status === 'recent_fallback_derived') return `${calcBase.year}年官方公式折算值`;
  return `${calcBase.year || ''}年参考值`.replace(/^年/, '');
}

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
