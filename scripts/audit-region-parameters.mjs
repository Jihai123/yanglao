import { mkdir, writeFile } from 'node:fs/promises';
import { DATA_VERIFIED_AT, REGION_NAMES, getRegionV4 } from '../js/sources-v4.js';

const now = new Date();
const currentYear = now.getUTCFullYear();

const rows = Object.entries(REGION_NAMES).map(([key, name]) => {
  const region = getRegionV4(key);
  const contribution = region.contribution || null;
  const calcBase = region.calcBase || null;
  const hasCurrentMinimum = Boolean(
    contribution?.current &&
    Number(contribution?.min) > 0 &&
    Number(contribution?.year) >= currentYear - 1
  );
  return {
    key,
    name,
    current_minimum_base: hasCurrentMinimum ? Number(contribution.min) : null,
    contribution_year: contribution?.year || null,
    contribution_source: contribution?.url || null,
    calc_base: Number(calcBase?.value) > 0 ? Number(calcBase.value) : null,
    calc_base_year: calcBase?.year || null,
    calc_base_source_level: calcBase?.sourceLevel || null,
    flex_rule_source: region.flexRule?.url || null,
    needs_minimum_review: !hasCurrentMinimum,
  };
});

const currentMinimumCount = rows.filter(row => row.current_minimum_base).length;
const calcBaseCount = rows.filter(row => row.calc_base).length;
const report = {
  generated_at: now.toISOString(),
  data_verified_at: DATA_VERIFIED_AT,
  total_regions: rows.length,
  current_minimum_covered: currentMinimumCount,
  current_minimum_missing: rows.length - currentMinimumCount,
  calc_base_covered: calcBaseCount,
  regions: rows,
};

await mkdir(new URL('../test-artifacts/reports/', import.meta.url), { recursive: true });
const output = new URL('../test-artifacts/reports/region-parameter-health.json', import.meta.url);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log(`region parameter audit: ${currentMinimumCount}/${rows.length} regions have a current verified minimum base`);
console.log(`calc-base coverage: ${calcBaseCount}/${rows.length}`);
for (const row of rows.filter(item => item.needs_minimum_review)) {
  console.log(`needs review: ${row.name}`);
}
