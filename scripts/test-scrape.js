/**
 * Quick test: run a subset of tasks to verify fixes.
 * Tests:
 *   1. google-flemings-cg (was only 5 reviews — URL fixed to /maps/place/)
 *   2. opentable-pisco-y-nazca (was 0 reviews — URL fixed)
 *   3. google-pisco-y-nazca (coordinates fixed)
 */

const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

const TEST_TASKS = [
  { taskId: 'GAV1YQqASc0UUBwwV', name: 'google-flemings-cg' },
  { taskId: 'N6Fs92zJqXxwL1Kuf', name: 'opentable-pisco-y-nazca' },
  { taskId: 'B5yAuve2dAJsiQvE0', name: 'google-pisco-y-nazca' },
];

async function startRun(taskId) {
  const res = await fetch(
    `https://api.apify.com/v2/actor-tasks/${taskId}/runs?token=${TOKEN}&timeout=600`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  );
  const data = await res.json();
  return data.data;
}

async function waitForRun(runId, name) {
  const start = Date.now();
  while (true) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
    const data = await res.json();
    const d = data.data;

    if (d.status === 'SUCCEEDED' || d.status === 'FAILED' || d.status === 'TIMED-OUT' || d.status === 'ABORTED') {
      const dsRes = await fetch(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
      const dsData = await dsRes.json();
      const duration = Math.round((Date.now() - start) / 1000);
      return { name, status: d.status, items: dsData.data.itemCount, duration };
    }

    await new Promise(r => setTimeout(r, 15000)); // Poll every 15s
  }
}

async function main() {
  console.log('=== Quick Test Scrape (3 tasks) ===\n');

  // Start all 3 in parallel
  const runs = [];
  for (const task of TEST_TASKS) {
    const run = await startRun(task.taskId);
    console.log(`  Started ${task.name} → run ${run.id}`);
    runs.push({ runId: run.id, name: task.name });
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nWaiting for completion...\n');

  // Wait for all
  const results = await Promise.all(
    runs.map(r => waitForRun(r.runId, r.name))
  );

  for (const r of results) {
    const icon = r.status === 'SUCCEEDED' ? 'OK' : 'FAIL';
    console.log(`  ${icon}  ${r.name.padEnd(30)} ${r.status.padEnd(12)} ${r.items} items  ${r.duration}s`);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
