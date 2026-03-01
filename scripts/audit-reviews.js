/**
 * Audit review counts in Supabase by restaurant × platform.
 */

const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function query(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  return res.json();
}

async function main() {
  // Get restaurants
  const restaurants = await query('tracked_restaurants?select=id,display_name,name&order=id');
  const nameMap = {};
  for (const r of restaurants) {
    nameMap[r.id] = r.display_name || r.name || r.id.slice(0, 8);
  }

  // Get all reviews
  const reviews = await query('restaurant_reviews?select=restaurant_id,platform');

  // Count by restaurant + platform
  const counts = {};
  for (const r of reviews) {
    const name = nameMap[r.restaurant_id] || r.restaurant_id.slice(0, 8);
    if (!counts[name]) counts[name] = { google: 0, opentable: 0, tripadvisor: 0, total: 0 };
    counts[name][r.platform] = (counts[name][r.platform] || 0) + 1;
    counts[name].total += 1;
  }

  console.log('=== Review Counts by Restaurant x Platform ===\n');
  const header = 'Restaurant'.padEnd(22) + 'Google'.padStart(8) + 'OpenTbl'.padStart(9) + 'TripAdv'.padStart(9) + '  TOTAL'.padStart(8);
  console.log(header);
  console.log('-'.repeat(header.length));

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
  console.log('-'.repeat(header.length));
  console.log('GRAND TOTAL'.padEnd(22) + String(grandTotal).padStart(34));

  // Also check analysis status
  console.log('\n\n=== Analysis Status ===\n');
  const analyses = await query('restaurant_reviews?select=restaurant_id,analysis_status');
  const statusCounts = {};
  for (const r of analyses) {
    const name = nameMap[r.restaurant_id] || r.restaurant_id.slice(0, 8);
    if (!statusCounts[name]) statusCounts[name] = {};
    statusCounts[name][r.analysis_status] = (statusCounts[name][r.analysis_status] || 0) + 1;
  }
  for (const [name, statuses] of Object.entries(statusCounts).sort()) {
    const parts = Object.entries(statuses).map(([s, c]) => `${s}=${c}`).join(', ');
    console.log(`  ${name}: ${parts}`);
  }

  // Scrape runs
  console.log('\n\n=== Recent Scrape Runs ===\n');
  const runs = await query('scrape_runs?select=restaurant_id,platform,status,reviews_found,reviews_new,created_at&order=created_at.desc&limit=30');
  for (const run of runs) {
    const name = (nameMap[run.restaurant_id] || '???').padEnd(18);
    const plat = run.platform.padEnd(12);
    const status = run.status.padEnd(10);
    console.log(`  ${name} ${plat} ${status} found=${run.reviews_found ?? '?'} new=${run.reviews_new ?? '?'}`);
  }
}

main().catch(console.error);
