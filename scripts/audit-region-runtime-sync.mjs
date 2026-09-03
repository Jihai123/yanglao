import { readFile } from 'node:fs/promises';
import { REGION_POLICY_RUNTIME } from '../js/region-policy-runtime.generated.js';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) { row.push(field); field = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
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

function number(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameNumber(a, b) {
  const left = number(a);
  const right = number(b);
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) < 0.011;
}

const main = parseCsv(await readFile(new URL('../data/region-policy/employee-pension.v2.csv', import.meta.url), 'utf8'));
const subregions = parseCsv(await readFile(new URL('../data/region-policy/subregions.v1.csv', import.meta.url), 'utf8'));
const errors = [];

for (const row of main) {
  const runtime = REGION_POLICY_RUNTIME[row.region_key];
  if (!runtime) { errors.push(`${row.region_name}: missing runtime entry`); continue; }

  const directContribution = number(row.contribution_min) > 0 && number(row.contribution_max) > 0;
  if (directContribution && runtime.contribution) {
    if (!sameNumber(runtime.contribution.min, row.contribution_min)) errors.push(`${row.region_name}: contribution min drift`);
    if (!sameNumber(runtime.contribution.max, row.contribution_max)) errors.push(`${row.region_name}: contribution max drift`);
    if (Number(runtime.contribution.year) !== Number(row.contribution_year)) errors.push(`${row.region_name}: contribution year drift`);
    if (Boolean(runtime.contribution.runtimeEligible) !== (row.contribution_runtime_eligible === 'true')) errors.push(`${row.region_name}: contribution eligibility drift`);
  }

  const directCalc = number(row.calc_base_value) > 0;
  if (directCalc) {
    if (!runtime.calcBase) errors.push(`${row.region_name}: direct calc base missing from runtime`);
    else {
      if (!sameNumber(runtime.calcBase.value, row.calc_base_value)) errors.push(`${row.region_name}: calc-base value drift`);
      if (Number(runtime.calcBase.year) !== Number(row.calc_base_year)) errors.push(`${row.region_name}: calc-base year drift`);
      if (Boolean(runtime.calcBase.runtimeEligible) !== (row.calc_base_runtime_eligible === 'true')) errors.push(`${row.region_name}: calc-base eligibility drift`);
    }
  } else if (row.calc_base_runtime_eligible !== 'true' && runtime.calcBase) {
    errors.push(`${row.region_name}: manual-only calc candidate leaked into runtime`);
  }
}

for (const row of subregions) {
  const runtime = REGION_POLICY_RUNTIME[row.region_key]?.subregions?.[row.subregion_key];
  if (!runtime) { errors.push(`${row.region_name}/${row.subregion_name}: missing runtime subregion`); continue; }
  if (row.parameter_type === 'contribution' && number(row.min) > 0 && number(row.max) > 0) {
    if (!runtime.contribution) errors.push(`${row.region_name}/${row.subregion_name}: contribution missing`);
    else {
      if (!sameNumber(runtime.contribution.min, row.min)) errors.push(`${row.region_name}/${row.subregion_name}: contribution min drift`);
      if (!sameNumber(runtime.contribution.max, row.max)) errors.push(`${row.region_name}/${row.subregion_name}: contribution max drift`);
    }
  }
  if (row.parameter_type === 'calcBase' && number(row.value) > 0) {
    if (!runtime.calcBase) errors.push(`${row.region_name}/${row.subregion_name}: calc base missing`);
    else {
      const unit = row.unit || 'yuan/month';
      const expected = unit === 'yuan/year' ? number(row.value) / 12 : number(row.value);
      if (!sameNumber(runtime.calcBase.value, expected)) errors.push(`${row.region_name}/${row.subregion_name}: calc-base drift`);
    }
  }
  if (row.status === 'missing') {
    const leaked = row.parameter_type === 'calcBase' ? runtime.calcBase : runtime.contribution;
    if (leaked) errors.push(`${row.region_name}/${row.subregion_name}: missing policy unexpectedly auto-filled`);
  }
}

console.log(`region runtime sync audit: ${main.length} province rows, ${subregions.length} subregion rows`);
if (errors.length) {
  for (const error of errors) console.error(`runtime sync error: ${error}`);
  process.exitCode = 1;
}
