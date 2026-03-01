const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

const RUNS = [
  { runId: 'NTmPaTk2YVtsRicbx', name: 'google-flemings-cg' },
  { runId: 'frE13xEZVhdzE7jeB', name: 'google-ruths-chris-cg' },
  { runId: 'SC6l94Zzpac5h71wq', name: 'google-mortons-cg' },
  { runId: 'bG4cQu8fmpdenPAqs', name: 'google-perrys-cg' },
  { runId: 'cZ9WqhAmVfzdS9kd5', name: 'google-capital-grille-miami' },
  { runId: 'H3j3YwLasYSPvpRbk', name: 'google-pisco-y-nazca' },
  { runId: '2aPPedwwcidt0FsmD', name: 'opentable-pisco-y-nazca' },
];

async function safeJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return null; }
}

async function main() {
  console.log('Checking 7 runs...\n');

  for (const r of RUNS) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const data = await safeJson(`https://api.apify.com/v2/actor-runs/${r.runId}?token=${TOKEN}`);
    if (!data) { console.log(`  ???  ${r.name} - API error`); continue; }
    const d = data.data;
    let items = '?';
    if (d.status !== 'RUNNING' && d.status !== 'READY') {
      await new Promise(resolve => setTimeout(resolve, 500));
      const ds = await safeJson(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
      items = ds ? ds.data.itemCount : '?';
    }
    const dur = d.finishedAt ? Math.round((new Date(d.finishedAt) - new Date(d.startedAt)) / 1000) : '...';
    console.log(`  ${d.status.padEnd(12)} ${r.name.padEnd(32)} ${String(items).padStart(3)} items  ${dur}s`);
  }
}
main().catch(console.error);
