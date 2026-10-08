import { track } from './analytics.js?v=20260929-v264';

// Directly launch an existing intent from a high-intent informational page.
// Analytics' capture listener creates the normal flow_id before landing_flow_start.
const routes = new Map([
  ['flexible-employment-pension', 'early'],
  ['minimum-pension-years', 'early'],
  ['retirement-age', 'age'],
]);
const params = new URLSearchParams(location.search);
const landing = params.get('landing') || '';
const entry = params.get('entry') || '';
if (routes.get(landing) === entry) {
  const button = document.querySelector('[data-intent="' + entry + '"]');
  if (button) {
    try { sessionStorage.setItem('yanglao-growth-landing', landing); } catch {}
    button.click();
    track('landing_flow_start', { feature: entry, step: landing });
    params.delete('entry');
    params.delete('landing');
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params.toString() : '') + location.hash);
  }
}
