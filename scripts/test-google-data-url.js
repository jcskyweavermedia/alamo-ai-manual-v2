const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const ACTOR_ID = '08Y1eaayqJpq3lDO3';

async function main() {
  // Test with data= URL format (most reliable for direct place loading)
  // Fleming's Prime Steakhouse Coral Gables - try /maps/place/ with the data parameter
  const input = {
    startUrls: [
      { url: "https://www.google.com/maps/place/Fleming's+Prime+Steakhouse+%26+Wine+Bar/@25.748469,-80.258359,17z/data=!4m2!3m1!1s0x88d9c7f32a6c453f:0x2cf8e4b5b1e32e0c" }
    ],
    maxItems: 10
  };

  console.log('Starting actor with data= URL format...');
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${TOKEN}&timeout=300&memory=2048`, {
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
        const lines = log.split('\n');
        for (const line of lines) {
          if (line.includes('DIAGNOSTIC') || line.includes('Panel') || line.includes('Reviews tab') ||
              line.includes('networkidle') || line.includes('proxy') || line.includes('Clicking') ||
              line.includes('Extracted') || line.includes('collected') || line.includes('Page title') ||
              line.includes('Processing') || line.includes('Navigating') || line.includes('Sort') ||
              line.includes('ERROR') || line.includes('body text') || line.includes('btn[') ||
              line.includes('tab[') || line.includes('Scrolling') || line.includes('role=')) {
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
