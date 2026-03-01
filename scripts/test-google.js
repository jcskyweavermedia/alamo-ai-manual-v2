const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

async function main() {
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/GAV1YQqASc0UUBwwV/runs?token=${TOKEN}&timeout=600`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  const run = await res.json();
  console.log('Started run:', run.data.id);

  while (true) {
    await new Promise(r => setTimeout(r, 15000));
    const check = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}?token=${TOKEN}`);
    const d = (await check.json()).data;
    const done = d.status !== 'RUNNING' && d.status !== 'READY';
    if (done) {
      const dsRes = await fetch(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
      const ds = (await dsRes.json()).data;
      const dur = Math.round((new Date(d.finishedAt) - new Date(d.startedAt)) / 1000);
      console.log(`\nStatus: ${d.status} | Items: ${ds.itemCount} | Duration: ${dur}s`);

      if (d.status !== 'SUCCEEDED') {
        const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}/log?token=${TOKEN}`);
        const log = await logRes.text();
        console.log('\nLast 1500 chars of log:');
        console.log(log.slice(-1500));
      }
      break;
    }
    process.stdout.write('.');
  }
}
main().catch(console.error);
