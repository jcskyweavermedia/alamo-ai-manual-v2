const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }
const WEBHOOK_SECRET = 'tastly_webhook_secret_2026';
const GROUP_ID = '00000000-0000-0000-0000-000000000001';

// Correct restaurant ID mapping (from actual DB)
const RESTAURANT_IDS = {
  'google-flemings-cg': '11111111-1111-1111-1111-111111111111',
  'google-ruths-chris-cg': '22222222-2222-2222-2222-222222222222',
  'google-mortons-cg': '33333333-3333-3333-3333-333333333333',
  'google-perrys-cg': '44444444-4444-4444-4444-444444444444',
  'google-capital-grille-miami': '55555555-5555-5555-5555-555555555555',
  'google-pisco-y-nazca': '66666666-6666-6666-6666-666666666666',
  'opentable-pisco-y-nazca': '66666666-6666-6666-6666-666666666666',
};

const PLATFORM_MAP = {
  'google-flemings-cg': 'google',
  'google-ruths-chris-cg': 'google',
  'google-mortons-cg': 'google',
  'google-perrys-cg': 'google',
  'google-capital-grille-miami': 'google',
  'google-pisco-y-nazca': 'google',
  'opentable-pisco-y-nazca': 'opentable',
};

const RUNS = [
  { runId: 'NTmPaTk2YVtsRicbx', name: 'google-flemings-cg' },
  { runId: 'frE13xEZVhdzE7jeB', name: 'google-ruths-chris-cg' },
  { runId: 'SC6l94Zzpac5h71wq', name: 'google-mortons-cg' },
  { runId: 'bG4cQu8fmpdenPAqs', name: 'google-perrys-cg' },
  { runId: 'DEnH4hIeMpDw8uQ5y', name: 'google-capital-grille-miami' },
  { runId: 'H3j3YwLasYSPvpRbk', name: 'google-pisco-y-nazca' },
  { runId: '2aPPedwwcidt0FsmD', name: 'opentable-pisco-y-nazca' },
];

async function ingestRun(run) {
  // Get run info for dataset ID
  const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.runId}?token=${TOKEN}`);
  const runData = await runRes.json();
  const datasetId = runData.data.defaultDatasetId;

  // Build ingest-reviews payload
  const payload = {
    event: 'ACTOR.RUN.SUCCEEDED',
    runId: run.runId,
    datasetId: datasetId,
    meta: {
      restaurant_id: RESTAURANT_IDS[run.name],
      platform: PLATFORM_MAP[run.name],
      group_id: GROUP_ID,
    }
  };

  const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/ingest-reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'X-Apify-Webhook-Secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const result = await ingestRes.json();
  const counts = result.counts || {};
  console.log(`  ${result.ok ? 'OK' : 'ERR'}  ${run.name.padEnd(32)} ins:${counts.inserted || 0} dup:${counts.duplicate || 0} upd:${counts.updated || 0} err:${counts.errors || 0}${result.error ? ' [' + result.error + ']' : ''}`);
  return { name: run.name, inserted: counts.inserted || 0 };
}

async function main() {
  console.log('=== Ingesting new reviews (corrected IDs) ===\n');

  let totalInserted = 0;
  for (const run of RUNS) {
    await new Promise(r => setTimeout(r, 2000));
    const result = await ingestRun(run);
    totalInserted += result.inserted;
  }

  console.log(`\n=== Total inserted: ${totalInserted} ===`);
}
main().catch(console.error);
