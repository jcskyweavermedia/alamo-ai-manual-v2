/**
 * Full database audit: review counts, analysis status, scrape runs, webhook delivery.
 */

const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const count = res.headers.get('content-range');
  const data = await res.json();
  return { data, count };
}

async function main() {
  // 1. Restaurant list
  console.log('=== Tracked Restaurants ===\n');
  const { data: restaurants } = await query('tracked_restaurants', '?select=id,display_name,restaurant_type,scrape_enabled&order=id');
  for (const r of restaurants) {
    console.log(`  ${r.id.slice(0, 8)}... ${(r.display_name || '?').padEnd(20)} type=${r.restaurant_type.padEnd(12)} scrape=${r.scrape_enabled}`);
  }
  const nameMap = {};
  for (const r of restaurants) nameMap[r.id] = r.display_name || r.id.slice(0, 8);

  // 2. Review counts by restaurant x platform
  console.log('\n=== Review Counts (restaurant_reviews) ===\n');
  const { data: reviews } = await query('restaurant_reviews', '?select=restaurant_id,platform,analysis_status');

  const counts = {};
  const statusCounts = {};
  for (const r of reviews) {
    const name = nameMap[r.restaurant_id] || r.restaurant_id.slice(0, 8);
    if (!counts[name]) counts[name] = { google: 0, opentable: 0, tripadvisor: 0, total: 0 };
    counts[name][r.platform] = (counts[name][r.platform] || 0) + 1;
    counts[name].total += 1;

    if (!statusCounts[name]) statusCounts[name] = {};
    statusCounts[name][r.analysis_status] = (statusCounts[name][r.analysis_status] || 0) + 1;
  }

  const header = 'Restaurant'.padEnd(22) + 'Google'.padStart(8) + 'OpenTbl'.padStart(9) + 'TripAdv'.padStart(9) + '  TOTAL';
  console.log(header);
  console.log('-'.repeat(56));

  let grandTotal = 0;
  for (const [name, c] of Object.entries(counts).sort()) {
    console.log(
      name.padEnd(22) +
      String(c.google).padStart(8) +
      String(c.opentable).padStart(9) +
      String(c.tripadvisor).padStart(9) +
      String(c.total).padStart(8)
    );
    grandTotal += c.total;
  }
  console.log('-'.repeat(56));
  console.log('GRAND TOTAL'.padEnd(22) + String(grandTotal).padStart(34));

  // 3. Analysis status
  console.log('\n\n=== Analysis Status ===\n');
  for (const [name, statuses] of Object.entries(statusCounts).sort()) {
    const parts = Object.entries(statuses).map(([s, c]) => `${s}=${c}`).join(', ');
    console.log(`  ${name.padEnd(22)} ${parts}`);
  }

  // Total pending
  const totalPending = reviews.filter(r => r.analysis_status === 'pending').length;
  const totalCompleted = reviews.filter(r => r.analysis_status === 'completed').length;
  const totalFailed = reviews.filter(r => r.analysis_status === 'failed').length;
  console.log(`\n  TOTALS: pending=${totalPending}, completed=${totalCompleted}, failed=${totalFailed}`);

  // 4. Scrape runs
  console.log('\n\n=== Scrape Runs (last 30) ===\n');
  const { data: runs } = await query('scrape_runs', '?select=restaurant_id,platform,status,reviews_found,reviews_new,created_at&order=created_at.desc&limit=30');

  if (runs.length === 0) {
    console.log('  (no scrape runs found)');
  } else {
    for (const run of runs) {
      const name = (nameMap[run.restaurant_id] || '???').padEnd(18);
      const plat = run.platform.padEnd(13);
      const status = run.status.padEnd(10);
      const ts = new Date(run.created_at).toISOString().slice(0, 19);
      console.log(`  ${name} ${plat} ${status} found=${String(run.reviews_found ?? '?').padStart(3)} new=${String(run.reviews_new ?? '?').padStart(3)}  ${ts}`);
    }
  }

  // 5. Review analyses count
  console.log('\n\n=== Review Analyses ===\n');
  const { data: analyses, count: analysisCount } = await query('review_analyses', '?select=id&limit=1');
  console.log(`  Total review_analyses rows: ${analysisCount || '?'}`);

  // 6. Flavor index
  const { data: flavorRows, count: flavorCount } = await query('flavor_index_daily', '?select=id&limit=1');
  console.log(`  Total flavor_index_daily rows: ${flavorCount || '?'}`);

  // 7. Review intelligence
  const { data: intelRows, count: intelCount } = await query('review_intelligence', '?select=id&limit=1');
  console.log(`  Total review_intelligence rows: ${intelCount || '?'}`);
}

main().catch(console.error);
