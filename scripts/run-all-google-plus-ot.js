const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

const TASKS = [
  { taskId: 'GAV1YQqASc0UUBwwV', name: 'google-flemings-cg' },
  { taskId: 'uFEisZM3xiOgUOk8Y', name: 'google-ruths-chris-cg' },
  { taskId: 't0ZVfs6HY6DjBwQZD', name: 'google-mortons-cg' },
  { taskId: 'wgnWNXhEeE4tLIHAo', name: 'google-perrys-cg' },
  { taskId: 'jXRbWFgfGVyDErnzR', name: 'google-capital-grille-miami' },
  { taskId: 'B5yAuve2dAJsiQvE0', name: 'google-pisco-y-nazca' },
  { taskId: 'N6Fs92zJqXxwL1Kuf', name: 'opentable-pisco-y-nazca' },
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
      return { name, runId, status: d.status, items: dsData.data.itemCount, duration, datasetId: d.defaultDatasetId };
    }

    await new Promise(r => setTimeout(r, 20000)); // Poll every 20s
  }
}

async function main() {
  console.log('=== Starting 7 scrape tasks ===\n');

  const runs = [];
  for (const task of TASKS) {
    const run = await startRun(task.taskId);
    console.log(`  Started ${task.name} -> run ${run.id}`);
    runs.push({ runId: run.id, name: task.name });
    await new Promise(r => setTimeout(r, 2000)); // Stagger starts
  }

  console.log('\nWaiting for all to complete...\n');

  const results = await Promise.all(
    runs.map(r => waitForRun(r.runId, r.name))
  );

  let totalItems = 0;
  for (const r of results) {
    const icon = r.status === 'SUCCEEDED' ? 'OK' : 'FAIL';
    console.log(`  ${icon}  ${r.name.padEnd(32)} ${r.status.padEnd(12)} ${String(r.items).padStart(3)} items  ${r.duration}s`);
    totalItems += r.items;
  }

  const failed = results.filter(r => r.status !== 'SUCCEEDED');
  console.log(`\n  Total: ${totalItems} items | ${results.length - failed.length} succeeded, ${failed.length} failed`);

  if (failed.length > 0) {
    console.log('\n--- Failed run logs ---');
    for (const f of failed) {
      const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${f.runId}/log?token=${TOKEN}`);
      const log = await logRes.text();
      console.log(`\n[${f.name}] Last 1000 chars:`);
      console.log(log.slice(-1000));
    }
  }

  console.log('\n=== Done ===');
}
main().catch(console.error);
