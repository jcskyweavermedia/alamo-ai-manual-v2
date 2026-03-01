/**
 * Manual ingestion: calls ingest-reviews directly with proper payloads.
 * Bypasses the broken webhook payloadTemplate issue.
 *
 * Steps:
 *   1. Delete stale scrape_runs from today's broken webhooks
 *   2. For each successful Apify run, get its datasetId
 *   3. Call ingest-reviews with correctly formed payload
 */

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }
const WEBHOOK_SECRET = 'tastly_webhook_secret_2026';
const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest-reviews`;
const GROUP_ID = '00000000-0000-0000-0000-000000000001';

// Best run per restaurant×platform (re-runs preferred where first batch timed out)
const RUNS = [
  { runId: 'L8mR1ZrUVLYESZLp3', platform: 'google',      restaurantId: '11111111-1111-1111-1111-111111111111', name: 'google-flemings-cg' },
  { runId: 'd1klND5UkkATZoaFx', platform: 'opentable',    restaurantId: '11111111-1111-1111-1111-111111111111', name: 'opentable-flemings-cg' },
  { runId: 'dCgl2nBuUWcv4BRdW', platform: 'tripadvisor',  restaurantId: '11111111-1111-1111-1111-111111111111', name: 'tripadvisor-flemings-cg' },
  { runId: 'ZsR375cRU45SvT2in', platform: 'google',      restaurantId: '22222222-2222-2222-2222-222222222222', name: 'google-ruths-chris-cg' },
  { runId: 'OGwq3bRRM4an9ED74', platform: 'opentable',    restaurantId: '22222222-2222-2222-2222-222222222222', name: 'opentable-ruths-chris-cg' },
  { runId: '9O1eMcbIuN1m8JLjB', platform: 'tripadvisor',  restaurantId: '22222222-2222-2222-2222-222222222222', name: 'tripadvisor-ruths-chris-cg' },
  { runId: '8sRKRt0nm3NI4rxyk', platform: 'google',      restaurantId: '33333333-3333-3333-3333-333333333333', name: 'google-mortons-cg' },
  { runId: 'Ye9UF9qpDxO977szB', platform: 'opentable',    restaurantId: '33333333-3333-3333-3333-333333333333', name: 'opentable-mortons-cg' },
  { runId: 'K0KsqRwbq3PxYWhp1', platform: 'tripadvisor',  restaurantId: '33333333-3333-3333-3333-333333333333', name: 'tripadvisor-mortons-cg' },
  { runId: '7Bafbr7pLH2E016wx', platform: 'google',      restaurantId: '44444444-4444-4444-4444-444444444444', name: 'google-perrys-cg' },
  { runId: 'J2g8dP2bPSB8Hx2ZV', platform: 'opentable',    restaurantId: '44444444-4444-4444-4444-444444444444', name: 'opentable-perrys-cg' },
  { runId: 'ljmXFVZRpcgopnkFf', platform: 'tripadvisor',  restaurantId: '44444444-4444-4444-4444-444444444444', name: 'tripadvisor-perrys-cg' },
  { runId: 'U59FDpcyPXG6p2vlv', platform: 'google',      restaurantId: '55555555-5555-5555-5555-555555555555', name: 'google-capital-grille-miami' },
  { runId: 's5ThA90U0U7RhsRCz', platform: 'opentable',    restaurantId: '55555555-5555-5555-5555-555555555555', name: 'opentable-capital-grille-miami' },
  { runId: 'p65dud7zYIwia7CjA', platform: 'tripadvisor',  restaurantId: '55555555-5555-5555-5555-555555555555', name: 'tripadvisor-capital-grille-miami' },
  { runId: 'Td1BShXkHaatlMWuj', platform: 'tripadvisor',  restaurantId: '66666666-6666-6666-6666-666666666666', name: 'tripadvisor-pisco-y-nazca' },
];

async function getDatasetId(runId) {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  const data = await res.json();
  return data.data.defaultDatasetId;
}

async function getDatasetItemCount(datasetId) {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${APIFY_TOKEN}`);
  const data = await res.json();
  return data.data.itemCount;
}

async function cleanStaleScrapeRuns() {
  console.log('--- Step 1: Cleaning stale scrape_runs ---');

  // Delete scrape_runs from today that were created by broken webhooks
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scrape_runs?created_at=gte.2026-02-27T00:00:00Z`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
    }
  );
  const deleted = await res.json();
  console.log(`  Deleted ${Array.isArray(deleted) ? deleted.length : 0} stale scrape_runs`);
}

async function callIngestReviews(run, datasetId) {
  const payload = {
    event: 'ACTOR.RUN.SUCCEEDED',
    runId: run.runId,
    datasetId: datasetId,
    actorId: 'manual-ingest',
    actorTaskId: null,
    status: 'SUCCEEDED',
    meta: {
      restaurant_id: run.restaurantId,
      platform: run.platform,
      group_id: GROUP_ID,
    },
  };

  const res = await fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Apify-Webhook-Secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  // Step 1: Clean stale runs
  await cleanStaleScrapeRuns();

  // Step 2: Get dataset IDs and item counts
  console.log('\n--- Step 2: Getting dataset info ---');
  const runInfo = [];
  for (const run of RUNS) {
    const datasetId = await getDatasetId(run.runId);
    const items = await getDatasetItemCount(datasetId);
    runInfo.push({ ...run, datasetId, items });
    process.stdout.write(`  ${run.name}: ${items} items\n`);
  }

  // Filter out empty datasets
  const toIngest = runInfo.filter(r => r.items > 0);
  console.log(`\n  ${toIngest.length} runs with data (${runInfo.length - toIngest.length} empty)`);

  // Step 3: Call ingest-reviews for each
  console.log('\n--- Step 3: Calling ingest-reviews ---');
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;

  for (const run of toIngest) {
    process.stdout.write(`  ${run.name} (${run.items} items)... `);
    try {
      const { status, body } = await callIngestReviews(run, run.datasetId);
      if (body.ok && body.counts) {
        const c = body.counts;
        console.log(`OK: inserted=${c.inserted}, dup=${c.duplicate}, updated=${c.updated}, errors=${c.errors}`);
        totalInserted += c.inserted || 0;
        totalDuplicates += c.duplicate || 0;
        totalErrors += c.errors || 0;
      } else if (body.ok && body.skipped) {
        console.log(`SKIPPED: ${body.reason}`);
      } else {
        console.log(`FAIL: ${JSON.stringify(body).slice(0, 200)}`);
        totalErrors++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      totalErrors++;
    }

    // Small delay between calls
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Duplicates: ${totalDuplicates}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(console.error);
