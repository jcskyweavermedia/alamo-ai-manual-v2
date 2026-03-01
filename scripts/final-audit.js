/**
 * Final comprehensive audit of the entire review pipeline.
 */
const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SK) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function q(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SK, 'Authorization': `Bearer ${SK}`, 'Prefer': 'count=exact', 'Range': '0-999' }
  });
  const count = r.headers.get('content-range');
  const data = await r.json();
  return { data: Array.isArray(data) ? data : [], total: count ? parseInt(count.split('/')[1]) : 0 };
}

async function main() {
  // 1. Restaurants
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           FINAL PIPELINE AUDIT — 2026-02-28                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const { data: restaurants } = await q('tracked_restaurants?select=id,display_name,restaurant_type,scrape_enabled&order=id');
  const nameMap = {};
  for (const r of restaurants) nameMap[r.id] = r.display_name;

  console.log('1. TRACKED RESTAURANTS');
  console.log('─'.repeat(56));
  for (const r of restaurants) {
    console.log(`   ${r.display_name.padEnd(20)} ${r.restaurant_type.padEnd(12)} scrape=${r.scrape_enabled}`);
  }
  console.log(`   Total: ${restaurants.length}\n`);

  // 2. Review counts by restaurant × platform
  const { data: reviews } = await q('restaurant_reviews?select=restaurant_id,platform,analysis_status');
  const counts = {};
  const statusCounts = {};
  for (const r of reviews) {
    const name = nameMap[r.restaurant_id] || '?';
    if (!counts[name]) counts[name] = { google: 0, opentable: 0, tripadvisor: 0, total: 0 };
    counts[name][r.platform] = (counts[name][r.platform] || 0) + 1;
    counts[name].total += 1;
    if (!statusCounts[r.analysis_status]) statusCounts[r.analysis_status] = 0;
    statusCounts[r.analysis_status]++;
  }

  console.log('2. REVIEW COUNTS (restaurant_reviews)');
  console.log('─'.repeat(56));
  const h = '   ' + 'Restaurant'.padEnd(20) + 'Google'.padStart(8) + 'OpenTbl'.padStart(9) + 'TripAdv'.padStart(9) + '  TOTAL';
  console.log(h);
  let grandTotal = 0;
  for (const [name, c] of Object.entries(counts).sort()) {
    console.log('   ' + name.padEnd(20) + String(c.google).padStart(8) + String(c.opentable).padStart(9) + String(c.tripadvisor).padStart(9) + String(c.total).padStart(8));
    grandTotal += c.total;
  }
  console.log('   ' + '─'.repeat(54));
  console.log('   ' + 'GRAND TOTAL'.padEnd(20) + String(grandTotal).padStart(34));
  console.log('');

  // 3. Analysis status
  console.log('3. ANALYSIS STATUS');
  console.log('─'.repeat(56));
  for (const [status, count] of Object.entries(statusCounts).sort()) {
    console.log(`   ${status.padEnd(15)} ${count}`);
  }
  console.log('');

  // 4. Review analyses
  const { total: analysisTotal } = await q('review_analyses?select=id&limit=1');
  console.log('4. REVIEW ANALYSES');
  console.log('─'.repeat(56));
  console.log(`   Total review_analyses rows: ${analysisTotal}`);

  // Coverage stats
  const { data: allAnalyses } = await q('review_analyses?select=staff_mentioned,items_mentioned,strengths,opportunities&limit=1000');
  let withStaff = 0, withItems = 0, withStrengths = 0, withOpps = 0;
  for (const a of allAnalyses) {
    if (a.staff_mentioned && a.staff_mentioned.length > 0) withStaff++;
    if (a.items_mentioned && a.items_mentioned.length > 0) withItems++;
    if (a.strengths && a.strengths.length > 0) withStrengths++;
    if (a.opportunities && a.opportunities.length > 0) withOpps++;
  }
  const at = allAnalyses.length;
  console.log(`   Strengths populated:     ${withStrengths}/${at} (${Math.round(withStrengths/at*100)}%)`);
  console.log(`   Opportunities populated: ${withOpps}/${at} (${Math.round(withOpps/at*100)}%)`);
  console.log(`   Staff mentions:          ${withStaff}/${at} (${Math.round(withStaff/at*100)}%)`);
  console.log(`   Item mentions:           ${withItems}/${at} (${Math.round(withItems/at*100)}%)`);

  const staffNames = new Set();
  const itemNames = new Set();
  for (const a of allAnalyses) {
    if (a.staff_mentioned) for (const s of a.staff_mentioned) staffNames.add(s.name || s);
    if (a.items_mentioned) for (const i of a.items_mentioned) itemNames.add(i.name || i);
  }
  console.log(`   Unique staff names:      ${staffNames.size}`);
  console.log(`   Unique menu items:       ${itemNames.size}`);
  console.log('');

  // 5. Scrape runs
  const { total: scrapeTotal } = await q('scrape_runs?select=id&limit=1');
  console.log('5. SCRAPE RUNS');
  console.log('─'.repeat(56));
  console.log(`   Total scrape_runs: ${scrapeTotal}`);
  console.log('');

  // 6. Rollups
  const { total: flavorTotal } = await q('flavor_index_daily?select=id&limit=1');
  const { total: intelTotal } = await q('review_intelligence?select=id&limit=1');
  console.log('6. ROLLUPS');
  console.log('─'.repeat(56));
  console.log(`   flavor_index_daily rows:   ${flavorTotal}`);
  console.log(`   review_intelligence rows:  ${intelTotal}`);
  console.log('');

  // 7. Failed/pending reviews
  const pendingCount = reviews.filter(r => r.analysis_status === 'pending').length;
  const failedCount = reviews.filter(r => r.analysis_status === 'failed').length;
  const completedCount = reviews.filter(r => r.analysis_status === 'completed').length;
  const processingCount = reviews.filter(r => r.analysis_status === 'processing').length;

  console.log('7. PIPELINE HEALTH');
  console.log('─'.repeat(56));
  console.log(`   Reviews ingested:     ${grandTotal}`);
  console.log(`   Analyses completed:   ${completedCount}`);
  console.log(`   Analyses pending:     ${pendingCount}`);
  console.log(`   Analyses processing:  ${processingCount}`);
  console.log(`   Analyses failed:      ${failedCount}`);
  console.log(`   Coverage:             ${Math.round(completedCount/grandTotal*100)}%`);
  console.log('');

  if (pendingCount === 0 && failedCount <= 5 && processingCount === 0) {
    console.log('✓ PIPELINE HEALTHY — All reviews ingested and analyzed.');
  } else if (pendingCount > 0) {
    console.log(`⚠ ${pendingCount} reviews still pending analysis.`);
  }
  if (failedCount > 0) {
    console.log(`⚠ ${failedCount} reviews failed analysis — may need retry.`);
  }
  if (processingCount > 0) {
    console.log(`⚠ ${processingCount} reviews stuck in processing — may need recovery.`);
  }
}

main().catch(console.error);
