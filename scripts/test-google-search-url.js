const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const ACTOR_ID = '08Y1eaayqJpq3lDO3';

async function main() {
  // Test with search URL format (was working before)
  const input = {
    startUrls: [
      { url: "https://www.google.com/maps/search/Fleming's+Prime+Steakhouse+%26+Wine+Bar+Coral+Gables+FL" }
    ],
    maxItems: 10
  };

  console.log('Starting actor with search URL format...');
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${TOKEN}&timeout=600&memory=2048`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const run = await res.json();
  console.log('Run ID:', run.data.id);

  while (true) {
    await new Promise(r => setTimeout(r, 15000));
    const check = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}?token=${TOKEN}`);
    const d = (await check.json()).data;
    if (d.status !== 'RUNNING' && d.status !== 'READY') {
      const dsRes = await fetch(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
      const ds = (await dsRes.json()).data;
      const dur = Math.round((new Date(d.finishedAt) - new Date(d.startedAt)) / 1000);
      console.log(`\nStatus: ${d.status} | Items: ${ds.itemCount} | Duration: ${dur}s`);

      if (ds.itemCount === 0 || d.status !== 'SUCCEEDED') {
        const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}/log?token=${TOKEN}`);
        const log = await logRes.text();
        // Find diagnostic lines
        const lines = log.split('\n');
        for (const line of lines) {
          if (line.includes('DIAGNOSTIC') || line.includes('Panel') || line.includes('Reviews tab') ||
              line.includes('networkidle') || line.includes('consent') || line.includes('proxy') ||
              line.includes('body text') || line.includes('Clicking') || line.includes('search result') ||
              line.includes('Scrolling') || line.includes('Extracted') || line.includes('collected') ||
              line.includes('Page title') || line.includes('role=') || line.includes('Processing') ||
              line.includes('Navigating') || line.includes('review card') || line.includes('Sort') ||
              line.includes('ERROR') || line.includes('tab[')) {
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
