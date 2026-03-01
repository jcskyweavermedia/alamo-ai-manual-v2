const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function query(table, select, filters = {}, limit = 1000) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;
  for (const [k, v] of Object.entries(filters)) {
    url += `&${k}=${encodeURIComponent(v)}`;
  }
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact',
    }
  });
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error('Query error:', table, data);
    return { data: [], total: 0 };
  }
  const range = res.headers.get('content-range');
  const total = range ? parseInt(range.split('/')[1]) : data.length;
  return { data, total };
}

async function main() {
  console.log('========================================');
  console.log('  FINAL PIPELINE AUDIT');
  console.log('========================================\n');

  // 1. Restaurant summary
  const { data: restaurants } = await query('tracked_restaurants', 'id,name,restaurant_type');
  console.log('TRACKED RESTAURANTS:');
  for (const r of restaurants) {
    console.log(`  ${r.restaurant_type === 'own' ? '*' : ' '} ${r.name}`);
  }

  // 2. Reviews by restaurant and platform
  const { data: reviews, total: totalReviews } = await query('restaurant_reviews', 'restaurant_id,platform,analysis_status', {}, 2000);

  console.log(`\nREVIEWS: ${totalReviews} total`);

  // Group by restaurant_id + platform
  const byRestPlatform = {};
  const byStatus = {};
  for (const r of reviews) {
    const key = `${r.restaurant_id}_${r.platform}`;
    byRestPlatform[key] = (byRestPlatform[key] || 0) + 1;
    byStatus[r.analysis_status] = (byStatus[r.analysis_status] || 0) + 1;
  }

  // Create nice grid
  const restMap = {};
  for (const r of restaurants) restMap[r.id] = r.name.replace(/\s*-\s*.+$/, '');

  const platforms = ['google', 'opentable', 'tripadvisor'];
  console.log(`\n${'Restaurant'.padEnd(35)} ${'Google'.padStart(8)} ${'OTable'.padStart(8)} ${'TripAdv'.padStart(8)} ${'Total'.padStart(8)}`);
  console.log('-'.repeat(75));

  let grandTotal = 0;
  for (const r of restaurants) {
    const name = restMap[r.id] || r.id.slice(0, 8);
    let rowTotal = 0;
    const cells = platforms.map(p => {
      const count = byRestPlatform[`${r.id}_${p}`] || 0;
      rowTotal += count;
      return String(count).padStart(8);
    });
    grandTotal += rowTotal;
    console.log(`${name.padEnd(35)} ${cells.join('')} ${String(rowTotal).padStart(8)}`);
  }
  console.log('-'.repeat(75));
  console.log(`${'TOTAL'.padEnd(35)} ${String(platforms.reduce((s, p) => s + Object.entries(byRestPlatform).filter(([k]) => k.endsWith('_' + p)).reduce((a, [, v]) => a + v, 0), 0)).padStart(8)} ${String(Object.entries(byRestPlatform).filter(([k]) => k.endsWith('_opentable')).reduce((a, [, v]) => a + v, 0)).padStart(8)} ${String(Object.entries(byRestPlatform).filter(([k]) => k.endsWith('_tripadvisor')).reduce((a, [, v]) => a + v, 0)).padStart(8)} ${String(grandTotal).padStart(8)}`);

  // 3. Analysis status
  console.log('\nANALYSIS STATUS:');
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`  ${status.padEnd(15)} ${count}`);
  }

  // 4. Review analyses count
  const { total: totalAnalyses } = await query('review_analyses', 'id', {}, 1);
  console.log(`\nREVIEW ANALYSES: ${totalAnalyses}`);

  // 5. Quality check — sample extraction stats
  const { data: analyses } = await query('review_analyses', 'overall_sentiment,strengths,opportunities,staff_mentioned,items_mentioned', {}, 2000);

  let withStrengths = 0, withStaff = 0, withItems = 0;
  const allStaff = new Set();
  const allItems = new Set();
  for (const a of analyses) {
    if (a.strengths && a.strengths.length > 0) withStrengths++;
    if (a.staff_mentioned && a.staff_mentioned.length > 0) {
      withStaff++;
      for (const s of a.staff_mentioned) allStaff.add(typeof s === 'string' ? s : s.name || JSON.stringify(s));
    }
    if (a.items_mentioned && a.items_mentioned.length > 0) {
      withItems++;
      for (const i of a.items_mentioned) allItems.add(typeof i === 'string' ? i : i.name || JSON.stringify(i));
    }
  }

  console.log('\nEXTRACTION QUALITY:');
  console.log(`  Analyses with strengths:     ${withStrengths}/${analyses.length} (${Math.round(withStrengths / analyses.length * 100)}%)`);
  console.log(`  Analyses with staff mentions: ${withStaff}/${analyses.length} (${Math.round(withStaff / analyses.length * 100)}%)`);
  console.log(`  Analyses with item mentions:  ${withItems}/${analyses.length} (${Math.round(withItems / analyses.length * 100)}%)`);
  console.log(`  Unique staff names:           ${allStaff.size}`);
  console.log(`  Unique menu items:            ${allItems.size}`);

  // 6. Scrape runs summary
  const { data: scrapeRuns } = await query('scrape_runs', 'status,platform', {}, 100);
  const runsByStatus = {};
  for (const r of scrapeRuns) {
    runsByStatus[r.status] = (runsByStatus[r.status] || 0) + 1;
  }
  console.log('\nSCRAPE RUNS:');
  for (const [status, count] of Object.entries(runsByStatus).sort()) {
    console.log(`  ${status.padEnd(15)} ${count}`);
  }

  console.log('\n========================================');
  console.log('  AUDIT COMPLETE');
  console.log('========================================');
}
main().catch(console.error);
