const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const RUN_ID = process.argv[2];

async function main() {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${RUN_ID}?token=${TOKEN}`);
  const d = (await res.json()).data;
  console.log(`Status: ${d.status}`);
  if (d.status !== 'RUNNING' && d.status !== 'READY') {
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
    const ds = (await dsRes.json()).data;
    console.log(`Items: ${ds.itemCount}`);
  }
}
main().catch(console.error);
