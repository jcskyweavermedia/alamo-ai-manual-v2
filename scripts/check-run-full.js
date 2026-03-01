const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const RUN_ID = process.argv[2] || 'UP6denXglLGjR9gEF';

async function main() {
  // Get the full log
  const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${RUN_ID}/log?token=${TOKEN}`);
  const log = await logRes.text();
  console.log('=== FULL LOG ===');
  console.log(log);

  // Check for key-value store screenshot
  const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${RUN_ID}?token=${TOKEN}`);
  const runData = await runRes.json();
  const kvStoreId = runData.data.defaultKeyValueStoreId;
  console.log('\n=== Key-Value Store ID:', kvStoreId, '===');

  const keysRes = await fetch(`https://api.apify.com/v2/key-value-stores/${kvStoreId}/keys?token=${TOKEN}`);
  const keysData = await keysRes.json();
  console.log('Keys:', JSON.stringify(keysData.data));
}
main().catch(console.error);
