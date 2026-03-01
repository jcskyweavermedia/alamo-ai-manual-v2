/**
 * Concurrent analyze-review runner.
 * Fires CONCURRENCY parallel calls to analyze-review, each with batchSize=5.
 * markProcessing() in the edge function ensures no duplicate processing.
 *
 * Effective throughput: ~15 reviews per ~90s cycle (3 × 5).
 */

const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }
const ANALYZE_URL = `${SUPABASE_URL}/functions/v1/analyze-review`;

const CONCURRENCY = 3;
const BATCH_SIZE = 5;
const DELAY_BETWEEN_ROUNDS_MS = 5000;

async function getPendingCount() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurant_reviews?select=id&analysis_status=eq.pending`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    }
  );
  const range = res.headers.get('content-range');
  if (range?.includes('/')) return parseInt(range.split('/')[1], 10);
  return 0;
}

async function callAnalyze(workerId) {
  const start = Date.now();
  try {
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
    const processed = body.stats?.total ?? 0;
    const success = body.stats?.success ?? 0;
    const failed = body.stats?.failed ?? 0;
    return { workerId, processed, success, failed, duration, error: null };
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    if (err.message.includes('Unexpected end of JSON')) {
      return { workerId, processed: '?', success: '?', failed: 0, duration, error: 'timeout' };
    }
    return { workerId, processed: 0, success: 0, failed: 0, duration, error: err.message };
  }
}

async function main() {
  let pending = await getPendingCount();
  const startTime = Date.now();

  console.log(`=== Concurrent analyze-review runner ===`);
  console.log(`Pending: ${pending} | Concurrency: ${CONCURRENCY} | Batch: ${BATCH_SIZE}`);
  console.log(`Effective: ~${CONCURRENCY * BATCH_SIZE} reviews per round (~90s each)`);
  console.log(`Estimated rounds: ${Math.ceil(pending / (CONCURRENCY * BATCH_SIZE))}`);
  console.log('');

  let round = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let hardErrors = 0;

  while (pending > 0) {
    round++;
    const roundStart = Date.now();

    // Fire CONCURRENCY parallel calls
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(callAnalyze(i + 1));
    }

    const results = await Promise.all(workers);
    const roundDuration = ((Date.now() - roundStart) / 1000).toFixed(1);

    // Summarize round
    let roundProcessed = 0;
    let roundSuccess = 0;
    let roundFailed = 0;
    let roundTimeouts = 0;
    let roundErrors = 0;

    for (const r of results) {
      if (r.error === 'timeout') {
        roundTimeouts++;
      } else if (r.error) {
        roundErrors++;
      } else {
        roundProcessed += r.processed;
        roundSuccess += r.success;
        roundFailed += r.failed;
      }
    }

    totalSuccess += roundSuccess;
    totalFailed += roundFailed;

    // Refresh pending count
    pending = await getPendingCount();
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

    const parts = [];
    if (roundSuccess > 0) parts.push(`${roundSuccess} ok`);
    if (roundFailed > 0) parts.push(`${roundFailed} fail`);
    if (roundTimeouts > 0) parts.push(`${roundTimeouts} timeout`);
    if (roundErrors > 0) parts.push(`${roundErrors} err`);

    console.log(
      `Round ${String(round).padStart(3)} | ${parts.join(', ').padEnd(30)} | ${roundDuration}s | ${pending} remaining | ${elapsed}min elapsed | ${totalSuccess} total`
    );

    if (roundErrors >= CONCURRENCY) {
      hardErrors++;
      if (hardErrors >= 3) {
        console.log('\n3 rounds of all-error — stopping.');
        break;
      }
    } else {
      hardErrors = 0;
    }

    if (pending > 0) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_ROUNDS_MS));
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n=== DONE ===`);
  console.log(`Rounds: ${round}`);
  console.log(`Total success: ${totalSuccess}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Remaining pending: ${pending}`);
  console.log(`Total time: ${totalElapsed} minutes`);
}

main().catch(console.error);
