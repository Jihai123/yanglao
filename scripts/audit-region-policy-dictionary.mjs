import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { REGION_NAMES } from '../js/sources.js';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map(values => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

function asNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const mainPath = new URL('../data/region-policy/employee-pension.v2.csv', import.meta.url);
const subregionPath = new URL('../data/region-policy/subregions.v1.csv', import.meta.url);
const [mainText, subregionText] = await Promise.all([
  readFile(mainPath, 'utf8'),
  readFile(subregionPath, 'utf8'),
]);

const rows = parseCsv(mainText);
const subregions = parseCsv(subregionText);
const expectedKeys = Object.keys(REGION_NAMES);
const actualKeys = rows.map(row => row.region_key);
const uniqueKeys = new Set(actualKeys);

const publishedStatuses = new Set(['current', 'recent_fallback']);
const derivedStatuses = new Set(['current_derived', 'recent_fallback_derived']);
const planningStatuses = new Set([...publishedStatuses, ...derivedStatuses]);

const allowedCalcStatuses = new Set([
  'current',
  'recent_fallback',
  'current_provisional',
  'recent_fallback_formula_anchor',
  'recent_fallback_derived',
  'stale',
  'missing',
]);
const calcPublishedStatuses = new Set(['current', 'recent_fallback']);
const calcProvisionalStatuses = new Set(['current_provisional']);
const calcFormulaAnchorStatuses = new Set(['recent_fallback_formula_anchor']);
const calcDerivedStatuses = new Set(['recent_fallback_derived']);

const errors = [];
if (rows.length !== expectedKeys.length) errors.push(`expected ${expectedKeys.length} province-level rows, got ${rows.length}`);
if (uniqueKeys.size !== rows.length) errors.push('duplicate region_key found in employee-pension.v2.csv');
for (const key of expectedKeys) {
  if (!uniqueKeys.has(key)) errors.push(`missing region: ${key}`);
}
for (const key of uniqueKeys) {
  if (!expectedKeys.includes(key)) errors.push(`unknown region: ${key}`);
}

function hasSubregionRange(regionKey) {
  return subregions.some(item =>
    item.region_key === regionKey &&
    item.parameter_type === 'contribution' &&
    asNumber(item.min) > 0 &&
    asNumber(item.max) > 0
  );
}

function hasSubregionCalcBase(regionKey) {
  return subregions.some(item =>
    item.region_key === regionKey &&
    item.parameter_type === 'calcBase' &&
    asNumber(item.value) > 0
  );
}

for (const row of rows) {
  const contributionEligible = row.contribution_runtime_eligible === 'true';
  const calcEligible = row.calc_base_runtime_eligible === 'true';
  const fallbackEligible = row.fallback_eligible === 'true';
  const derivedContribution = derivedStatuses.has(row.contribution_status);
  const hasDirectRange = asNumber(row.contribution_min) > 0 && asNumber(row.contribution_max) > 0;
  const hasAnyRange = hasDirectRange || hasSubregionRange(row.region_key);
  const hasDirectCalc = asNumber(row.calc_base_value) > 0;
  const hasCalc = hasDirectCalc || hasSubregionCalcBase(row.region_key);
  const calcStatus = row.calc_base_status || 'missing';
  const calcSourceLevel = String(row.calc_base_source_level || '');
  const note = String(row.note || '');
  const declaresSubregional = String(row.research_status || '').includes('subregional') ||
    String(row.contribution_source_level || '').includes('subregional') ||
    calcSourceLevel.includes('subregional');

  if (!allowedCalcStatuses.has(calcStatus)) {
    errors.push(`${row.region_name}: unknown calc-base status ${calcStatus}`);
  }
  if (declaresSubregional && !subregions.some(item => item.region_key === row.region_key)) {
    errors.push(`${row.region_name}: declares subregional policy but has no subregion rows`);
  }
  if (calcStatus !== 'missing' && !hasDirectCalc && calcSourceLevel.includes('subregional') && !hasSubregionCalcBase(row.region_key)) {
    errors.push(`${row.region_name}: subregional calc-base status without numeric subregional calc base`);
  }
  if (fallbackEligible && row.contribution_status === 'missing' && calcStatus === 'missing') {
    errors.push(`${row.region_name}: fallback_eligible but both parameter groups are missing`);
  }
  if ((row.contribution_status === 'current' || row.contribution_status === 'current_derived') && !row.contribution_year) {
    errors.push(`${row.region_name}: current contribution missing year`);
  }
  if (row.calc_base_value && !row.calc_base_year) {
    errors.push(`${row.region_name}: calc-base value missing year`);
  }

  if (contributionEligible) {
    if (!planningStatuses.has(row.contribution_status)) {
      errors.push(`${row.region_name}: contribution eligible with non-planning status ${row.contribution_status}`);
    }
    if (!hasAnyRange) errors.push(`${row.region_name}: contribution eligible without numeric range or subregional range`);
    if (!row.contribution_source_url && !row.reference_source_url) {
      errors.push(`${row.region_name}: contribution eligible without contribution/reference source URL`);
    }
    if (!String(row.contribution_source_level || '').includes('official')) {
      errors.push(`${row.region_name}: contribution eligible without official-grade contribution source level`);
    }
  }

  if (calcEligible) {
    if (calcStatus === 'missing' || calcStatus === 'stale') {
      errors.push(`${row.region_name}: calc-base eligible with non-runtime status ${calcStatus}`);
    }
    if (!hasCalc) errors.push(`${row.region_name}: calc-base eligible without numeric calc base or subregional calc base`);
    if (!row.calc_base_source_url) errors.push(`${row.region_name}: calc-base eligible without calc-base source URL`);
    if (!calcSourceLevel.includes('official')) {
      errors.push(`${row.region_name}: calc-base eligible without official-grade calc source level`);
    }
    if (/(secondary|corroborated|candidate)/.test(calcSourceLevel)) {
      errors.push(`${row.region_name}: calc-base eligible from secondary/corroborated source`);
    }
  }

  if (calcProvisionalStatuses.has(calcStatus)) {
    if (!calcSourceLevel.includes('provisional')) {
      errors.push(`${row.region_name}: provisional calc-base status without provisional source label`);
    }
    if (!/(预发|暂用|暂按|正式.*调整|正式.*公布)/.test(note)) {
      errors.push(`${row.region_name}: provisional calc-base note does not disclose provisional nature`);
    }
  }

  if (calcFormulaAnchorStatuses.has(calcStatus)) {
    if (!calcSourceLevel.includes('formula_anchor')) {
      errors.push(`${row.region_name}: formula-anchor calc status without formula_anchor source label`);
    }
    if (!/(公式|计发依据|待遇计发|待遇核定|用于确定)/.test(note)) {
      errors.push(`${row.region_name}: formula-anchor calc note does not explain policy linkage`);
    }
  }

  if (calcDerivedStatuses.has(calcStatus)) {
    if (!calcSourceLevel.includes('derived')) {
      errors.push(`${row.region_name}: derived calc status without derived source label`);
    }
    if (!row.reference_source_url || !row.formula_source_url) {
      errors.push(`${row.region_name}: derived calc-base missing reference/formula provenance`);
    }
    if (!/(折算|公式|换算)/.test(note)) {
      errors.push(`${row.region_name}: derived calc note does not disclose calculation`);
    }
  }

  if (derivedContribution) {
    if (!hasDirectRange) errors.push(`${row.region_name}: derived contribution status without direct numeric range`);
    if (!row.reference_monthly) errors.push(`${row.region_name}: derived contribution status without reference_monthly`);
    if (!row.reference_source_url) errors.push(`${row.region_name}: derived contribution status without reference source`);
    if (!row.formula_source_url) errors.push(`${row.region_name}: derived contribution status without formula source`);
  }
}

function hasDirectRange(row, statuses) {
  return statuses.has(row.contribution_status) && asNumber(row.contribution_min) > 0 && asNumber(row.contribution_max) > 0;
}

const currentPublishedContribution = rows.filter(row => hasDirectRange(row, new Set(['current'])));
const currentDerivedContribution = rows.filter(row => hasDirectRange(row, new Set(['current_derived'])));
const fallbackPublishedContribution = rows.filter(row => hasDirectRange(row, new Set(['recent_fallback'])));
const fallbackDerivedContribution = rows.filter(row => hasDirectRange(row, new Set(['recent_fallback_derived'])));
const planningContributionCovered = rows.filter(row => hasDirectRange(row, planningStatuses) || hasSubregionRange(row.region_key));
const publishedContributionCovered = rows.filter(row => hasDirectRange(row, publishedStatuses) || hasSubregionRange(row.region_key));

const calcBaseCovered = rows.filter(row => asNumber(row.calc_base_value) > 0 || hasSubregionCalcBase(row.region_key));
const calcPublishedCovered = rows.filter(row =>
  calcPublishedStatuses.has(row.calc_base_status) && (asNumber(row.calc_base_value) > 0 || hasSubregionCalcBase(row.region_key))
);
const calcProvisionalCovered = rows.filter(row =>
  calcProvisionalStatuses.has(row.calc_base_status) && asNumber(row.calc_base_value) > 0
);
const calcFormulaAnchorCovered = rows.filter(row =>
  calcFormulaAnchorStatuses.has(row.calc_base_status) && asNumber(row.calc_base_value) > 0
);
const calcDerivedCovered = rows.filter(row =>
  calcDerivedStatuses.has(row.calc_base_status) && asNumber(row.calc_base_value) > 0
);
const calcDirectDefaultEligible = rows.filter(row =>
  row.calc_base_runtime_eligible === 'true' && asNumber(row.calc_base_value) > 0
);
const calcSubregionOnlyEligible = rows.filter(row =>
  row.calc_base_runtime_eligible === 'true' && !asNumber(row.calc_base_value) && hasSubregionCalcBase(row.region_key)
);

const contributionRuntimeEligible = rows.filter(row => row.contribution_runtime_eligible === 'true');
const calcBaseRuntimeEligible = rows.filter(row => row.calc_base_runtime_eligible === 'true');
const fullyRuntimeEligible = rows.filter(row => row.contribution_runtime_eligible === 'true' && row.calc_base_runtime_eligible === 'true');
const needsContributionReview = rows.filter(row => row.contribution_runtime_eligible !== 'true');
const needsCalcBaseReview = rows.filter(row => row.calc_base_runtime_eligible !== 'true');

const report = {
  generated_at: new Date().toISOString(),
  dictionary_version: 2,
  total_regions: rows.length,
  current_published_contribution_with_numeric_range: currentPublishedContribution.length,
  current_formula_derived_contribution_with_numeric_range: currentDerivedContribution.length,
  recent_fallback_published_contribution_with_numeric_range: fallbackPublishedContribution.length,
  recent_fallback_formula_derived_contribution_with_numeric_range: fallbackDerivedContribution.length,
  published_contribution_covered_including_subregions: publishedContributionCovered.length,
  planning_contribution_covered_including_formula_derived_and_subregions: planningContributionCovered.length,
  calc_base_covered: calcBaseCovered.length,
  calc_base_published_covered: calcPublishedCovered.length,
  calc_base_provisional_covered: calcProvisionalCovered.length,
  calc_base_formula_anchor_covered: calcFormulaAnchorCovered.length,
  calc_base_derived_covered: calcDerivedCovered.length,
  calc_base_direct_default_runtime_eligible: calcDirectDefaultEligible.length,
  calc_base_subregion_only_runtime_eligible: calcSubregionOnlyEligible.length,
  contribution_runtime_eligible_regions: contributionRuntimeEligible.length,
  calc_base_runtime_eligible_regions: calcBaseRuntimeEligible.length,
  fully_runtime_eligible_regions: fullyRuntimeEligible.length,
  needs_contribution_review: needsContributionReview.map(row => ({
    key: row.region_key,
    name: row.region_name,
    research_status: row.research_status,
    contribution_status: row.contribution_status,
    note: row.note,
  })),
  needs_calc_base_review: needsCalcBaseReview.map(row => ({
    key: row.region_key,
    name: row.region_name,
    research_status: row.research_status,
    calc_base_status: row.calc_base_status,
    note: row.note,
  })),
  errors,
};

await mkdir(new URL('../test-artifacts/reports/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../test-artifacts/reports/region-policy-dictionary-health.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

console.log(`region policy dictionary v2: ${rows.length}/${expectedKeys.length} province-level rows`);
console.log(`current published contribution ranges: ${currentPublishedContribution.length}/${rows.length}`);
console.log(`current formula-derived contribution ranges: ${currentDerivedContribution.length}/${rows.length}`);
console.log(`recent fallback published ranges: ${fallbackPublishedContribution.length}/${rows.length}`);
console.log(`recent fallback formula-derived ranges: ${fallbackDerivedContribution.length}/${rows.length}`);
console.log(`published contribution coverage incl. subregions: ${publishedContributionCovered.length}/${rows.length}`);
console.log(`planning contribution coverage incl. derived/subregions: ${planningContributionCovered.length}/${rows.length}`);
console.log(`calc-base coverage (all verified planning types incl. subregions): ${calcBaseCovered.length}/${rows.length}`);
console.log(`calc-base published coverage: ${calcPublishedCovered.length}/${rows.length}`);
console.log(`calc-base provisional coverage: ${calcProvisionalCovered.length}/${rows.length}`);
console.log(`calc-base formula-anchor coverage: ${calcFormulaAnchorCovered.length}/${rows.length}`);
console.log(`calc-base derived coverage: ${calcDerivedCovered.length}/${rows.length}`);
console.log(`calc-base direct defaults runtime-eligible: ${calcDirectDefaultEligible.length}/${rows.length}`);
console.log(`calc-base subregion-only runtime-eligible: ${calcSubregionOnlyEligible.length}/${rows.length}`);
console.log(`contribution runtime-eligible: ${contributionRuntimeEligible.length}/${rows.length}`);
console.log(`calc-base runtime-eligible: ${calcBaseRuntimeEligible.length}/${rows.length}`);
console.log(`fully runtime-eligible: ${fullyRuntimeEligible.length}/${rows.length}`);
for (const row of needsContributionReview) console.log(`needs contribution review: ${row.region_name} — ${row.research_status}`);
for (const row of needsCalcBaseReview) console.log(`needs calc-base review: ${row.region_name} — ${row.research_status}`);

if (errors.length) {
  for (const error of errors) console.error(`dictionary error: ${error}`);
  process.exitCode = 1;
}
