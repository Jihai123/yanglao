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

const mainPath = new URL('../data/region-policy/employee-pension.v1.csv', import.meta.url);
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

const errors = [];
if (rows.length !== expectedKeys.length) errors.push(`expected ${expectedKeys.length} province-level rows, got ${rows.length}`);
if (uniqueKeys.size !== rows.length) errors.push('duplicate region_key found in employee-pension.v1.csv');
for (const key of expectedKeys) {
  if (!uniqueKeys.has(key)) errors.push(`missing region: ${key}`);
}
for (const key of uniqueKeys) {
  if (!expectedKeys.includes(key)) errors.push(`unknown region: ${key}`);
}

for (const row of rows) {
  const runtimeEligible = row.runtime_eligible === 'true';
  const fallbackEligible = row.fallback_eligible === 'true';
  if (runtimeEligible && !row.contribution_source_url && !row.calc_base_source_url) {
    errors.push(`${row.region_name}: runtime_eligible without any source URL`);
  }
  if (fallbackEligible && row.contribution_status === 'missing' && row.calc_base_status === 'missing') {
    errors.push(`${row.region_name}: fallback_eligible but both parameter groups are missing`);
  }
  if (row.contribution_status === 'current' && !row.contribution_year) {
    errors.push(`${row.region_name}: current contribution missing year`);
  }
  if (row.calc_base_value && !row.calc_base_year) {
    errors.push(`${row.region_name}: calc-base value missing year`);
  }
}

const subregionKeys = new Set(subregions.map(row => row.region_key));
for (const key of ['liaoning', 'jilin', 'hubei', 'guangdong']) {
  if (!subregionKeys.has(key)) errors.push(`${REGION_NAMES[key]}: expected subregional rows are missing`);
}

const currentContribution = rows.filter(row =>
  row.contribution_status === 'current' && asNumber(row.contribution_min) > 0 && asNumber(row.contribution_max) > 0
);
const fallbackContribution = rows.filter(row =>
  row.contribution_status === 'recent_fallback' && asNumber(row.contribution_min) > 0 && asNumber(row.contribution_max) > 0
);
const currentOrFallbackContribution = rows.filter(row => {
  if (!['current', 'recent_fallback'].includes(row.contribution_status)) return false;
  const direct = asNumber(row.contribution_min) > 0 && asNumber(row.contribution_max) > 0;
  const sub = subregions.some(item => item.region_key === row.region_key && item.parameter_type === 'contribution' && asNumber(item.min) > 0 && asNumber(item.max) > 0);
  return direct || sub;
});
const calcBaseCovered = rows.filter(row =>
  asNumber(row.calc_base_value) > 0 || subregions.some(item => item.region_key === row.region_key && item.parameter_type === 'calcBase' && asNumber(item.value) > 0)
);
const runtimeEligible = rows.filter(row => row.runtime_eligible === 'true');
const needsReview = rows.filter(row => row.runtime_eligible !== 'true');

const report = {
  generated_at: new Date().toISOString(),
  total_regions: rows.length,
  current_contribution_with_numeric_range: currentContribution.length,
  recent_fallback_contribution_with_numeric_range: fallbackContribution.length,
  current_or_recent_fallback_contribution_covered: currentOrFallbackContribution.length,
  calc_base_covered: calcBaseCovered.length,
  runtime_eligible_region_rows: runtimeEligible.length,
  needs_review: needsReview.map(row => ({
    key: row.region_key,
    name: row.region_name,
    research_status: row.research_status,
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

console.log(`region policy dictionary: ${rows.length}/${expectedKeys.length} province-level rows`);
console.log(`current contribution numeric coverage: ${currentContribution.length}/${rows.length}`);
console.log(`current + recent fallback contribution coverage: ${currentOrFallbackContribution.length}/${rows.length}`);
console.log(`calc-base coverage (including subregions): ${calcBaseCovered.length}/${rows.length}`);
console.log(`runtime-eligible region rows: ${runtimeEligible.length}/${rows.length}`);
for (const row of needsReview) console.log(`needs review: ${row.region_name} — ${row.research_status}`);

if (errors.length) {
  for (const error of errors) console.error(`dictionary error: ${error}`);
  process.exitCode = 1;
}
