import { track } from './analytics.js?v=20260929-v264';

// Reuse existing first-party analytics and session-source detection.
// Only an allow-listed slug and intent are emitted; no form inputs or pension amounts.
const routes = new Map([
  ['flexible-employment-pension', 'early'],
  ['minimum-pension-years', 'early'],
  ['retirement-age', 'age'],
]);
for (const link of document.querySelectorAll('[data-landing-cta]')) {
  const slug = String(link.dataset.landingCta || '');
  const intent = routes.get(slug);
  if (!intent) continue;
  link.addEventListener('click', () => {
    try { sessionStorage.setItem('yanglao-growth-landing', slug); } catch {}
    track('landing_cta_click', { feature: intent, step: slug });
  });
}
