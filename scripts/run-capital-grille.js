const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

async function main() {
  // Check Pisco y Nazca Google run status
  const piscoCheck = await fetch(`https://api.apify.com/v2/actor-runs/H3j3YwLasYSPvpRbk?token=${TOKEN}`);
  const piscoData = await piscoCheck.json();
  if (piscoData.data.status !== 'RUNNING') {
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${piscoData.data.defaultDatasetId}?token=${TOKEN}`);
    const ds = await dsRes.json();
    console.log(`Pisco y Nazca Google: ${piscoData.data.status} | ${ds.data.itemCount} items`);
  } else {
    console.log('Pisco y Nazca Google: still running...');
  }

  // Start Capital Grille Google
  console.log('\nStarting Capital Grille Google...');
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/jXRbWFgfGVyDErnzR/runs?token=${TOKEN}&timeout=600`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  const run = await res.json();
  console.log('Run ID:', run.data.id);

  while (true) {
    await new Promise(r => setTimeout(r, 20000));
    const check = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}?token=${TOKEN}`);
    const d = (await check.json()).data;
    if (d.status !== 'RUNNING' && d.status !== 'READY') {
      const dsRes = await fetch(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
      const ds = (await dsRes.json()).data;
      const dur = Math.round((new Date(d.finishedAt) - new Date(d.startedAt)) / 1000);
      console.log(`\nCapital Grille: ${d.status} | ${ds.itemCount} items | ${dur}s`);

      if (ds.itemCount === 0) {
        const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}/log?token=${TOKEN}`);
        const log = await logRes.text();
        const lines = log.split('\n');
        for (const line of lines) {
          if (line.includes('Review card') || line.includes('Scrolling') || line.includes('Extracted') ||
              line.includes('collected') || line.includes('ERROR') || line.includes('Panel') ||
              line.includes('Reviews tab') || line.includes('Clicking') || line.includes('Sort') ||
              line.includes('star') || line.includes('DIAGNOSTIC') || line.includes('Processing') ||
              line.includes('search result')) {
            console.log(line.trim());
          }
        }
      }
      break;
    }
    process.stdout.write('.');
  }
}
main().catch(console.error);
