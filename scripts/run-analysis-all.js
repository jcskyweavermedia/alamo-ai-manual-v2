const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

const CONCURRENCY = 3;
const BATCH_SIZE = 5;

async function callAnalyze() {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ batchSize: BATCH_SIZE }),
    });

    const data = await res.json();
    // Response format: { message, stats: { total, success, failed, skipped } }
    return data.stats || { total: 0, success: 0, failed: 0 };
  } catch {
    return { total: 0, success: 0, failed: 0, error: true };
  }
}

async function getPendingCount() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurant_reviews?select=id&analysis_status=eq.pending&limit=1`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'count=exact',
      }
    }
  );
  const count = res.headers.get('content-range');
  if (count) {
    const match = count.match(/\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  return 0;
}

async function main() {
  const initialPending = await getPendingCount();
  console.log(`=== Starting analysis: ${initialPending} pending reviews ===\n`);

  if (initialPending === 0) {
    console.log('No pending reviews to analyze.');
    return;
  }

  let round = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let emptyRounds = 0;
  const startTime = Date.now();

  while (emptyRounds < 3) {
    round++;

    const promises = Array.from({ length: CONCURRENCY }, () => callAnalyze());
    const results = await Promise.all(promises);

    let roundSuccess = 0;
    let roundFailed = 0;
    let roundEmpty = true;

    for (const r of results) {
      if (r.success > 0 || r.failed > 0) {
        roundEmpty = false;
        roundSuccess += r.success || 0;
        roundFailed += r.failed || 0;
      }
    }

    totalSuccess += roundSuccess;
    totalFailed += roundFailed;

    if (roundEmpty) {
      emptyRounds++;
    } else {
      emptyRounds = 0;
    }

    if (round % 5 === 0 || roundEmpty) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = await getPendingCount();
      console.log(`  Round ${round}: +${roundSuccess} ok, +${roundFailed} fail | Total: ${totalSuccess} | Pending: ${remaining} | ${elapsed}s`);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const remaining = await getPendingCount();
  console.log(`\n=== Done in ${round} rounds (${Math.round(elapsed / 60)}m ${elapsed % 60}s) ===`);
  console.log(`  Success: ${totalSuccess} | Failed: ${totalFailed} | Still pending: ${remaining}`);
}
main().catch(console.error);
