const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

// Fleming's Google task
const TASK_ID = 'GAV1YQqASc0UUBwwV';

async function main() {
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/${TASK_ID}?token=${TOKEN}`);
  const data = await res.json();
  console.log('Task:', data.data.name);
  console.log('Input:', JSON.stringify(data.data.input, null, 2));
}
main().catch(console.error);
