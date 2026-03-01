/**
 * Re-run only the 5 timed-out Apify tasks with a longer timeout (10 min)
 * and more memory (2048 MB for Google scrapers).
 *
 * Safe to re-run: ingest-reviews deduplicates by platform_review_id.
 */

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

const FAILED_TASKS = [
  { taskId: 'GAV1YQqASc0UUBwwV', name: 'google-flemings-cg',         memoryMbytes: 2048 },
  { taskId: 'mDQn4sNhyO71YI4dv', name: 'opentable-flemings-cg',      memoryMbytes: 1024 },
  { taskId: 'uFEisZM3xiOgUOk8Y', name: 'google-ruths-chris-cg',      memoryMbytes: 2048 },
  { taskId: 'zGr9fDYSnUKpKQHGG', name: 'opentable-mortons-cg',       memoryMbytes: 1024 },
  { taskId: 'jXRbWFgfGVyDErnzR', name: 'google-capital-grille-miami', memoryMbytes: 2048 },
];

const TIMEOUT_SECS = 600; // 10 minutes (was 5 min default)

async function updateTaskTimeout(taskId, name, memoryMbytes) {
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/${taskId}?token=${APIFY_TOKEN}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      options: {
        build: 'latest',
        memoryMbytes,
        timeoutSecs: TIMEOUT_SECS,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAIL update ${name}: ${res.status} ${err}`);
    return false;
  }
  console.log(`  OK   updated ${name} → timeout=${TIMEOUT_SECS}s, memory=${memoryMbytes}MB`);
  return true;
}

async function startRun(taskId, name) {
  const res = await fetch(
    `https://api.apify.com/v2/actor-tasks/${taskId}/runs?token=${APIFY_TOKEN}&timeout=${TIMEOUT_SECS}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAIL run ${name}: ${res.status} ${err}`);
    return;
  }

  const data = await res.json();
  console.log(`  RUN  ${name} → run ID: ${data.data.id}`);
}

async function main() {
  console.log(`=== Re-running ${FAILED_TASKS.length} timed-out tasks ===`);
  console.log(`Timeout: ${TIMEOUT_SECS}s (was 300s default)`);
  console.log(`Google scrapers: 2048 MB memory`);
  console.log('');

  // Step 1: Update task configs
  console.log('--- Updating task configs ---');
  for (const { taskId, name, memoryMbytes } of FAILED_TASKS) {
    await updateTaskTimeout(taskId, name, memoryMbytes);
    await new Promise(r => setTimeout(r, 300));
  }

  // Step 2: Start runs
  console.log('\n--- Starting runs ---');
  for (const { taskId, name } of FAILED_TASKS) {
    await startRun(taskId, name);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n=== Started ${FAILED_TASKS.length} re-runs ===`);
  console.log('Webhooks already attached — will auto-trigger ingest-reviews on completion.');
  console.log('Monitor at: https://console.apify.com/actors/runs');
}

main().catch(console.error);
