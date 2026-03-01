const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function main() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ batchSize: 3 }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}
main().catch(console.error);
