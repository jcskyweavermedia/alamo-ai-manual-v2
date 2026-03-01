const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const RUN_ID = process.argv[2] || 'fTGCD93jKgw78ZW0r';

async function main() {
  const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${RUN_ID}/log?token=${TOKEN}`);
  const log = await logRes.text();
  console.log('Last 3000 chars of log:');
  console.log(log.slice(-3000));
}
main().catch(console.error);
