/**
 * Calls analyze-review edge function repeatedly until all pending reviews
 * are analyzed. Processes 10 reviews per call (~35-50s each with gpt-5-mini).
 *
 * Usage:
 *   node scripts/run-analysis-loop.js           # Run until all done
 *   node scripts/run-analysis-loop.js --max=5   # Run max 5 batches
 */

const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }
const ANALYZE_URL = `${SUPABASE_URL}/functions/v1/analyze-review`;

const BATCH_SIZE = 5; // Smaller batches to avoid edge function timeout
const DELAY_BETWEEN_BATCHES_MS = 3000; // 3s cooldown between batches

async function getPendingCount() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurant_reviews?select=id&analysis_status=eq.pending`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'count=exact',
        'Range': '0-0', // Don't fetch actual rows, just count
      },
    }
  );
  const range = res.headers.get('content-range');
  // Format: "0-0/576" or "*/0"
  if (range?.includes('/')) {
    return parseInt(range.split('/')[1], 10);
  }
  return 0;
}

async function callAnalyzeReview() {
  const start = Date.now();
  const res = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ batchSize: BATCH_SIZE }),
  });

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const body = await res.json();
  return { status: res.status, body, duration };
}

async function main() {
  const maxArg = process.argv.find(a => a.startsWith('--max='));
  const maxBatches = maxArg ? parseInt(maxArg.split('=')[1], 10) : Infinity;

  let pendingCount = await getPendingCount();
  console.log(`=== analyze-review batch runner ===`);
  console.log(`Pending reviews: ${pendingCount}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Estimated batches: ${Math.ceil(pendingCount / BATCH_SIZE)}`);
  console.log(`Max batches: ${maxBatches === Infinity ? 'unlimited' : maxBatches}`);
  console.log('');

  let batchNum = 0;
  let totalAnalyzed = 0;
  let totalFailed = 0;
  let consecutiveErrors = 0;

  while (pendingCount > 0 && batchNum < maxBatches) {
    batchNum++;
    process.stdout.write(`Batch ${batchNum} (${pendingCount} remaining)... `);

    try {
      const { status, body, duration } = await callAnalyzeReview();

      const processed = body.processed ?? body.stats?.total ?? 0;
      const success = body.stats?.success ?? body.results?.filter(r => r.status === 'success').length ?? processed;
      const failed = body.stats?.failed ?? body.results?.filter(r => r.status !== 'success').length ?? 0;

      if (status === 200 && processed > 0) {
        totalAnalyzed += success;
        totalFailed += failed;
        consecutiveErrors = 0;
        console.log(`${processed} processed (${success} ok, ${failed} fail) in ${duration}s`);
      } else if (status === 200 && processed === 0) {
        console.log(`No reviews to process. Done!`);
        break;
      } else if (status === 504) {
        console.log(`TIMEOUT (${duration}s) — will retry`);
        consecutiveErrors++;
      } else {
        console.log(`HTTP ${status}: ${JSON.stringify(body).slice(0, 150)} (${duration}s)`);
        consecutiveErrors++;
      }
    } catch (err) {
      // "Unexpected end of JSON input" usually means the function timed out
      // but the work may have completed server-side. Treat as warning.
      if (err.message.includes('Unexpected end of JSON')) {
        console.log(`TIMEOUT (response truncated) — work may have completed server-side`);
        // Don't count as error; check pending count to confirm progress
      } else {
        console.log(`ERROR: ${err.message}`);
        consecutiveErrors++;
      }
    }

    if (consecutiveErrors >= 3) {
      console.log('\n3 consecutive errors — stopping.');
      break;
    }

    // Refresh pending count every 5 batches (also catches server-side completions from timeouts)
    if (batchNum % 5 === 0) {
      pendingCount = await getPendingCount();
      console.log(`  [refresh] ${pendingCount} pending`);
    } else {
      pendingCount = Math.max(0, pendingCount - BATCH_SIZE);
    }

    // Cooldown
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
  }

  // Final count
  const finalPending = await getPendingCount();

  console.log(`\n=== SUMMARY ===`);
  console.log(`Batches run: ${batchNum}`);
  console.log(`Total analyzed: ${totalAnalyzed}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Remaining pending: ${finalPending}`);
}

main().catch(console.error);
