// Mirror of the "Normalize Step View" Code node in the "RSC Tracking" n8n
// workflow (RSC Tracking.json), kept here purely for readability/diffing
// outside n8n's UI -- see markusdan repo AGENTS.md/CLAUDE.md for the sync
// process. Editing this file does nothing in production by itself: the
// owner copy-pastes it into the matching n8n Code node, then re-exports the
// workflow, which overwrites RSC Tracking.json in this repo.
const item = $input.first().json;
const body = item.body || item;

const rawTimestamp = body.timestamp || new Date().toISOString();
const parsedDate = new Date(rawTimestamp);
const timestamp = Number.isNaN(parsedDate.getTime())
  ? new Date().toISOString()
  : parsedDate.toISOString();

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(timestamp));

return [
  {
    json: {
      timestamp,
      date: berlinDate,
      step: String(body.step || '').trim(),
      // Added for the Variant B branching-flow A/B test (see llm-wiki plan
      // 2026-09-17) -- defaults to "A" so older requests that predate the
      // variant field still log consistently.
      variant: String(body.variant || 'A').trim(),
    },
  },
];
