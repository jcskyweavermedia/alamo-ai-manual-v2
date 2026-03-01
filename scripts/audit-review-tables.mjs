/**
 * Full audit of review-related tables via Supabase PostgREST.
 * Uses the service role key (from supabase/.temp) or falls back to anon key.
 * Since we only have the anon key, we'll use it — RLS will filter by group,
 * which is fine for our seeded user (admin in alamo-prime).
 *
 * For tables without direct REST access, we call RPC functions.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eEPfgN9bd5jWRJ-ye1MnMw_p6V92UDs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sign in as admin to get RLS access
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'juancarlosmarchan@skyweavermedia.com',
  password: process.argv[2] || '',
});

if (authError) {
  console.error('Auth error:', authError.message);
  console.error('Usage: node scripts/audit-review-tables.mjs <password>');
  process.exit(1);
}
console.log('Authenticated as:', authData.user.email);
console.log('');

async function query(table, select = '*', options = {}) {
  let q = supabase.from(table).select(select, { count: 'exact', ...options });
  if (options.filter) {
    for (const [col, val] of Object.entries(options.filter)) {
      q = q.eq(col, val);
    }
  }
  if (options.order) q = q.order(options.order.col, { ascending: options.order.asc ?? true });
  if (options.limit) q = q.limit(options.limit);
  const { data, error, count } = await q;
  if (error) console.error(`  ERROR on ${table}:`, error.message);
  return { data: data || [], count, error };
}

function printSection(title) {
  console.log('='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function printTable(rows, cols) {
  if (!rows || rows.length === 0) { console.log('  (no rows)'); return; }
  // Compute column widths
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
  const header = cols.map((c, i) => c.padEnd(widths[i])).join(' | ');
  console.log('  ' + header);
  console.log('  ' + cols.map((_, i) => '-'.repeat(widths[i])).join('-+-'));
  for (const r of rows) {
    console.log('  ' + cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join(' | '));
  }
}

// ============ 1. TABLE COUNTS ============
printSection('1. TABLE ROW COUNTS');
const tables = ['tracked_restaurants', 'restaurant_reviews', 'review_analyses', 'flavor_index_daily', 'review_intelligence', 'scrape_runs', 'credit_costs', 'ai_usage_log'];
const counts = {};
for (const t of tables) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  counts[t] = error ? `ERROR: ${error.message}` : count;
  console.log(`  ${t}: ${counts[t]}`);
}
console.log('');

// ============ 2. TRACKED RESTAURANTS ============
printSection('2. TRACKED RESTAURANTS');
const { data: restaurants } = await query('tracked_restaurants', 'id,name,type,platform', { order: { col: 'type' } });
printTable(restaurants, ['id', 'name', 'type', 'platform']);
console.log('');

// ============ 3. RESTAURANT REVIEWS BY RESTAURANT ============
printSection('3. RESTAURANT REVIEWS BREAKDOWN');
const { data: allReviews } = await query('restaurant_reviews', 'id,restaurant_id,rating,review_date,analysis_status,platform');
// Group by restaurant
const reviewsByRest = {};
for (const r of allReviews) {
  if (!reviewsByRest[r.restaurant_id]) reviewsByRest[r.restaurant_id] = [];
  reviewsByRest[r.restaurant_id].push(r);
}
const restMap = {};
for (const r of restaurants) restMap[r.id] = r.name;

const reviewSummary = Object.entries(reviewsByRest).map(([rid, reviews]) => ({
  restaurant: restMap[rid] || rid,
  total: reviews.length,
  earliest: reviews.reduce((a, b) => a.review_date < b.review_date ? a : b).review_date,
  latest: reviews.reduce((a, b) => a.review_date > b.review_date ? a : b).review_date,
  avg_rating: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2),
})).sort((a, b) => a.restaurant.localeCompare(b.restaurant));
printTable(reviewSummary, ['restaurant', 'total', 'earliest', 'latest', 'avg_rating']);
console.log('');

// ============ 4. RATING DISTRIBUTION ============
printSection('4. RATING DISTRIBUTION PER RESTAURANT');
for (const [rid, reviews] of Object.entries(reviewsByRest).sort((a, b) => (restMap[a[0]] || '').localeCompare(restMap[b[0]] || ''))) {
  const dist = [1, 2, 3, 4, 5].map(r => ({ rating: r, count: reviews.filter(rv => rv.rating === r).length }));
  console.log(`  ${restMap[rid] || rid}:`);
  for (const d of dist) {
    const bar = '#'.repeat(Math.round(d.count / 2));
    console.log(`    ${d.rating}★: ${String(d.count).padStart(3)} ${bar}`);
  }
  console.log('');
}

// ============ 5. ANALYSIS STATUS ============
printSection('5. ANALYSIS STATUS PER RESTAURANT');
for (const [rid, reviews] of Object.entries(reviewsByRest).sort((a, b) => (restMap[a[0]] || '').localeCompare(restMap[b[0]] || ''))) {
  const statuses = {};
  for (const r of reviews) {
    statuses[r.analysis_status] = (statuses[r.analysis_status] || 0) + 1;
  }
  console.log(`  ${restMap[rid] || rid}: ${JSON.stringify(statuses)}`);
}
console.log('');

// ============ 6. REVIEW ANALYSES BREAKDOWN ============
printSection('6. REVIEW ANALYSES BREAKDOWN');
const { data: allAnalyses } = await query('review_analyses', 'id,restaurant_id,overall_sentiment,emotion,return_intent,high_severity_flag,items_mentioned,staff_mentioned,strengths,opportunities,rating,review_date');

const analysesByRest = {};
for (const a of allAnalyses) {
  if (!analysesByRest[a.restaurant_id]) analysesByRest[a.restaurant_id] = [];
  analysesByRest[a.restaurant_id].push(a);
}

const analysisSummary = Object.entries(analysesByRest).map(([rid, analyses]) => ({
  restaurant: restMap[rid] || rid,
  total: analyses.length,
  with_items: analyses.filter(a => a.items_mentioned && JSON.stringify(a.items_mentioned) !== '[]').length,
  with_staff: analyses.filter(a => a.staff_mentioned && JSON.stringify(a.staff_mentioned) !== '[]').length,
  with_strengths: analyses.filter(a => a.strengths && JSON.stringify(a.strengths) !== '[]').length,
  with_opps: analyses.filter(a => a.opportunities && JSON.stringify(a.opportunities) !== '[]').length,
  high_severity: analyses.filter(a => a.high_severity_flag).length,
})).sort((a, b) => a.restaurant.localeCompare(b.restaurant));
printTable(analysisSummary, ['restaurant', 'total', 'with_items', 'with_staff', 'with_strengths', 'with_opps', 'high_severity']);
console.log('');

// ============ 7. SENTIMENT DISTRIBUTION ============
printSection('7. SENTIMENT DISTRIBUTION PER RESTAURANT');
for (const [rid, analyses] of Object.entries(analysesByRest).sort((a, b) => (restMap[a[0]] || '').localeCompare(restMap[b[0]] || ''))) {
  const sentiments = {};
  for (const a of analyses) sentiments[a.overall_sentiment] = (sentiments[a.overall_sentiment] || 0) + 1;
  console.log(`  ${restMap[rid] || rid}: ${JSON.stringify(sentiments)}`);
}
console.log('');

// ============ 8. EMOTION DISTRIBUTION (Alamo Prime) ============
printSection('8. EMOTION DISTRIBUTION (Alamo Prime)');
const apAnalyses = analysesByRest['11111111-1111-1111-1111-111111111111'] || [];
const emotions = {};
for (const a of apAnalyses) emotions[a.emotion] = (emotions[a.emotion] || 0) + 1;
const emotionRows = Object.entries(emotions).sort().map(([e, c]) => ({ emotion: e, count: c }));
printTable(emotionRows, ['emotion', 'count']);
console.log('');

// ============ 9. RETURN INTENT ============
printSection('9. RETURN INTENT PER RESTAURANT');
for (const [rid, analyses] of Object.entries(analysesByRest).sort((a, b) => (restMap[a[0]] || '').localeCompare(restMap[b[0]] || ''))) {
  const intents = {};
  for (const a of analyses) intents[a.return_intent] = (intents[a.return_intent] || 0) + 1;
  console.log(`  ${restMap[rid] || rid}: ${JSON.stringify(intents)}`);
}
console.log('');

// ============ 10. HIGH SEVERITY DETAILS ============
printSection('10. HIGH SEVERITY ALERTS');
const severeAnalyses = allAnalyses.filter(a => a.high_severity_flag);
console.log(`  Total high-severity: ${severeAnalyses.length}`);
for (const a of severeAnalyses) {
  // Need to fetch the full record with high_severity_details
  const { data: full } = await supabase.from('review_analyses').select('high_severity_details,restaurant_id,rating,review_date').eq('id', a.id).single();
  console.log(`  - ${restMap[full?.restaurant_id] || 'unknown'} | rating=${full?.rating} | date=${full?.review_date} | details=${JSON.stringify(full?.high_severity_details)}`);
}
console.log('');

// ============ 11. FLAVOR INDEX DAILY ============
printSection('11. FLAVOR INDEX DAILY BREAKDOWN');
const { data: fidAll } = await query('flavor_index_daily', 'restaurant_id,date,flavor_index,total_reviews,five_star,four_star,three_star,two_star,one_star,food_sentiment,service_sentiment,ambience_sentiment,value_sentiment');
const fidByRest = {};
for (const f of fidAll) {
  if (!fidByRest[f.restaurant_id]) fidByRest[f.restaurant_id] = [];
  fidByRest[f.restaurant_id].push(f);
}

const fidSummary = Object.entries(fidByRest).map(([rid, rows]) => ({
  restaurant: restMap[rid] || rid,
  days: rows.length,
  earliest: rows.reduce((a, b) => a.date < b.date ? a : b).date,
  latest: rows.reduce((a, b) => a.date > b.date ? a : b).date,
  avg_fi: (rows.reduce((s, r) => s + (r.flavor_index || 0), 0) / rows.length).toFixed(2),
  avg_total_reviews: (rows.reduce((s, r) => s + (r.total_reviews || 0), 0) / rows.length).toFixed(1),
})).sort((a, b) => a.restaurant.localeCompare(b.restaurant));
printTable(fidSummary, ['restaurant', 'days', 'earliest', 'latest', 'avg_fi', 'avg_total_reviews']);
console.log('');

// Latest 3 days for Alamo Prime
console.log('  Latest 3 days (Alamo Prime):');
const apFid = (fidByRest['11111111-1111-1111-1111-111111111111'] || []).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
for (const f of apFid) {
  console.log(`    ${f.date}: FI=${f.flavor_index} reviews=${f.total_reviews} stars=[${f.five_star},${f.four_star},${f.three_star},${f.two_star},${f.one_star}] food=${f.food_sentiment} svc=${f.service_sentiment} amb=${f.ambience_sentiment} val=${f.value_sentiment}`);
}
console.log('');

// ============ 12. REVIEW INTELLIGENCE ============
printSection('12. REVIEW INTELLIGENCE BREAKDOWN');
const { data: riAll } = await query('review_intelligence', 'restaurant_id,period_type,period_start,total_reviews,avg_rating,flavor_index,positive_pct,negative_pct,top_strengths,top_opportunities,top_positive_items,top_complaints');

const riByRestPeriod = {};
for (const r of riAll) {
  const key = `${r.restaurant_id}|${r.period_type}`;
  if (!riByRestPeriod[key]) riByRestPeriod[key] = [];
  riByRestPeriod[key].push(r);
}

const riSummary = Object.entries(riByRestPeriod).map(([key, rows]) => {
  const [rid, period] = key.split('|');
  return {
    restaurant: restMap[rid] || rid,
    period_type: period,
    periods: rows.length,
    earliest: rows.reduce((a, b) => a.period_start < b.period_start ? a : b).period_start,
    latest: rows.reduce((a, b) => a.period_start > b.period_start ? a : b).period_start,
  };
}).sort((a, b) => a.restaurant.localeCompare(b.restaurant) || a.period_type.localeCompare(b.period_type));
printTable(riSummary, ['restaurant', 'period_type', 'periods', 'earliest', 'latest']);
console.log('');

// Latest month for Alamo Prime
const apRiMonth = riAll
  .filter(r => r.restaurant_id === '11111111-1111-1111-1111-111111111111' && r.period_type === 'month')
  .sort((a, b) => b.period_start.localeCompare(a.period_start));
if (apRiMonth.length > 0) {
  const latest = apRiMonth[0];
  console.log('  Latest month (Alamo Prime):');
  console.log(`    period_start: ${latest.period_start}`);
  console.log(`    total_reviews: ${latest.total_reviews}, avg_rating: ${latest.avg_rating}, flavor_index: ${latest.flavor_index}`);
  console.log(`    positive_pct: ${latest.positive_pct}, negative_pct: ${latest.negative_pct}`);
  console.log(`    top_strengths: ${JSON.stringify(latest.top_strengths)}`);
  console.log(`    top_opportunities: ${JSON.stringify(latest.top_opportunities)}`);
  console.log(`    top_positive_items: ${JSON.stringify(latest.top_positive_items)}`);
  console.log(`    top_complaints: ${JSON.stringify(latest.top_complaints)}`);
}
console.log('');

// ============ 13. NON-EMPTY STRENGTHS/OPPS IN REVIEW INTELLIGENCE ============
printSection('13. REVIEW INTELLIGENCE: NON-EMPTY STRENGTHS/OPPORTUNITIES');
for (const r of riAll) {
  const hasStr = r.top_strengths && JSON.stringify(r.top_strengths) !== '[]' && JSON.stringify(r.top_strengths) !== 'null';
  const hasOpp = r.top_opportunities && JSON.stringify(r.top_opportunities) !== '[]' && JSON.stringify(r.top_opportunities) !== 'null';
  if (hasStr || hasOpp) {
    console.log(`  ${restMap[r.restaurant_id] || r.restaurant_id} | ${r.period_type} | ${r.period_start}`);
    if (hasStr) console.log(`    strengths: ${JSON.stringify(r.top_strengths).substring(0, 120)}`);
    if (hasOpp) console.log(`    opportunities: ${JSON.stringify(r.top_opportunities).substring(0, 120)}`);
  }
}
const riWithStrengths = riAll.filter(r => r.top_strengths && JSON.stringify(r.top_strengths) !== '[]' && JSON.stringify(r.top_strengths) !== 'null').length;
const riWithOpps = riAll.filter(r => r.top_opportunities && JSON.stringify(r.top_opportunities) !== '[]' && JSON.stringify(r.top_opportunities) !== 'null').length;
console.log(`  Total with strengths: ${riWithStrengths}/${riAll.length}`);
console.log(`  Total with opportunities: ${riWithOpps}/${riAll.length}`);
console.log('');

// ============ 14. ORPHAN CHECKS ============
printSection('14. ORPHAN CHECKS');
// Analyses without matching reviews
let orphanedAnalyses = 0;
for (const a of allAnalyses) {
  const matchingReview = allReviews.find(r => r.id === a.id); // analysis.review_id = review.id
  // Actually we need review_id field
}
// We need to check via a different approach - get review_id from analyses
const { data: analysesWithReviewId } = await query('review_analyses', 'id,review_id');
const reviewIdSet = new Set(allReviews.map(r => r.id));
orphanedAnalyses = analysesWithReviewId.filter(a => !reviewIdSet.has(a.review_id)).length;
console.log(`  Analyses without matching review: ${orphanedAnalyses}`);

const restIdSet = new Set(restaurants.map(r => r.id));
const orphanedReviews = allReviews.filter(r => !restIdSet.has(r.restaurant_id)).length;
console.log(`  Reviews without matching restaurant: ${orphanedReviews}`);
console.log('');

// ============ 15. GROUP ID CONSISTENCY ============
printSection('15. GROUP ID CONSISTENCY');
const groupIds = new Set();
for (const r of restaurants) groupIds.add(r.group_id || 'null');
// Need group_id from reviews
const { data: reviewGroups } = await query('restaurant_reviews', 'group_id');
const revGroupIds = new Set(reviewGroups.map(r => r.group_id));
const { data: analysisGroups } = await query('review_analyses', 'group_id');
const anaGroupIds = new Set(analysisGroups.map(r => r.group_id));
const { data: fidGroups } = await query('flavor_index_daily', 'group_id');
const fidGroupIds = new Set(fidGroups.map(r => r.group_id));
const { data: riGroups } = await query('review_intelligence', 'group_id');
const riGroupIds = new Set(riGroups.map(r => r.group_id));

console.log(`  tracked_restaurants groups: ${JSON.stringify([...groupIds])}`);
console.log(`  restaurant_reviews groups:  ${JSON.stringify([...revGroupIds])}`);
console.log(`  review_analyses groups:     ${JSON.stringify([...anaGroupIds])}`);
console.log(`  flavor_index_daily groups:  ${JSON.stringify([...fidGroupIds])}`);
console.log(`  review_intelligence groups: ${JSON.stringify([...riGroupIds])}`);
console.log('');

// ============ 16. RPC FUNCTION TEST ============
printSection('16. RPC FUNCTION TESTS');

// Test compute_flavor_index_range
const { data: fiRange, error: fiErr } = await supabase.rpc('compute_flavor_index_range', {
  p_restaurant_id: '11111111-1111-1111-1111-111111111111',
  p_start_date: '2026-01-01',
  p_end_date: '2026-02-25',
});
console.log(`  compute_flavor_index_range: ${fiErr ? 'ERROR: ' + fiErr.message : 'OK'}`);
if (fiRange && fiRange.length > 0) {
  const r = fiRange[0];
  console.log(`    flavor_index=${r.flavor_index} total=${r.total_reviews} avg=${r.avg_rating} 5★=${r.five_star} 4★=${r.four_star} 3★=${r.three_star} 2★=${r.two_star} 1★=${r.one_star}`);
}

// Test get_competitor_ids
const { data: compIds, error: compErr } = await supabase.rpc('get_competitor_ids', {
  p_restaurant_id: '11111111-1111-1111-1111-111111111111',
});
console.log(`  get_competitor_ids: ${compErr ? 'ERROR: ' + compErr.message : `OK (${compIds?.length} competitors)`}`);

// Test aggregate_staff_mentions
const { data: staffData, error: staffErr } = await supabase.rpc('aggregate_staff_mentions', {
  p_restaurant_id: '11111111-1111-1111-1111-111111111111',
  p_start_date: '2025-12-01',
  p_end_date: '2026-02-28',
  p_limit: 5,
});
console.log(`  aggregate_staff_mentions: ${staffErr ? 'ERROR: ' + staffErr.message : `OK (${staffData?.length} staff)`}`);
if (staffData) {
  for (const s of staffData) console.log(`    ${s.staff_name} (${s.role}): ${s.mentions} mentions, ${s.positive}+ ${s.negative}- ${s.neutral}~`);
}

// Test aggregate_item_mentions
const { data: itemData, error: itemErr } = await supabase.rpc('aggregate_item_mentions', {
  p_restaurant_id: '11111111-1111-1111-1111-111111111111',
  p_start_date: '2025-12-01',
  p_end_date: '2026-02-28',
  p_limit: 10,
});
console.log(`  aggregate_item_mentions: ${itemErr ? 'ERROR: ' + itemErr.message : `OK (${itemData?.length} items)`}`);
if (itemData) {
  for (const it of itemData) console.log(`    ${it.item_name} (${it.item_type}): ${it.mentions} mentions, ${it.positive}+ ${it.negative}-`);
}

// Test get_dashboard_competitors
const { data: dashComp, error: dashCompErr } = await supabase.rpc('get_dashboard_competitors', {
  p_unit_id: '11111111-1111-1111-1111-111111111111',
  p_start_date: '2026-01-01',
  p_end_date: '2026-02-25',
});
console.log(`  get_dashboard_competitors: ${dashCompErr ? 'ERROR: ' + dashCompErr.message : `OK (${dashComp?.length} rows)`}`);
if (dashComp) {
  for (const c of dashComp) console.log(`    ${c.name}: FI=${c.flavor_index} delta=${c.delta} avg=${c.avg_rating} reviews=${c.total_reviews} own=${c.is_own}`);
}

// Test get_severity_alerts
const { data: alerts, error: alertErr } = await supabase.rpc('get_severity_alerts', {
  p_restaurant_ids: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444'],
  p_start_date: '2025-12-01',
  p_end_date: '2026-02-28',
  p_limit: 10,
});
console.log(`  get_severity_alerts: ${alertErr ? 'ERROR: ' + alertErr.message : `OK (${alerts?.length} alerts)`}`);
if (alerts) {
  for (const a of alerts) console.log(`    ${a.restaurant_name} | ${a.alert_type} | ${a.review_date} | ${a.summary}`);
}

// Test get_category_trend_weekly
const { data: catTrend, error: catErr } = await supabase.rpc('get_category_trend_weekly', {
  p_restaurant_ids: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
  p_category: 'food',
  p_start_date: '2026-01-01',
  p_end_date: '2026-02-25',
});
console.log(`  get_category_trend_weekly: ${catErr ? 'ERROR: ' + catErr.message : `OK (${catTrend?.length} rows)`}`);

// Test get_subcategory_breakdown
const { data: subCat, error: subCatErr } = await supabase.rpc('get_subcategory_breakdown', {
  p_restaurant_id: '11111111-1111-1111-1111-111111111111',
  p_start_date: '2025-12-01',
  p_end_date: '2026-02-28',
  p_bucket: 'food',
  p_limit: 10,
});
console.log(`  get_subcategory_breakdown (food): ${subCatErr ? 'ERROR: ' + subCatErr.message : `OK (${subCat?.length} categories)`}`);
if (subCat) {
  for (const s of subCat) console.log(`    ${s.category}: intensity=${s.avg_intensity} mentions=${s.mentions} trend=${s.trend_delta}`);
}

const { data: subCatSvc, error: subCatSvcErr } = await supabase.rpc('get_subcategory_breakdown', {
  p_restaurant_id: '11111111-1111-1111-1111-111111111111',
  p_start_date: '2025-12-01',
  p_end_date: '2026-02-28',
  p_bucket: 'service',
  p_limit: 10,
});
console.log(`  get_subcategory_breakdown (service): ${subCatSvcErr ? 'ERROR: ' + subCatSvcErr.message : `OK (${subCatSvc?.length} categories)`}`);
if (subCatSvc) {
  for (const s of subCatSvc) console.log(`    ${s.category}: intensity=${s.avg_intensity} mentions=${s.mentions} trend=${s.trend_delta}`);
}

console.log('');
printSection('AUDIT COMPLETE');
console.log(`  Total tables checked: 8`);
console.log(`  Total RPC functions tested: 8`);

// Summary of issues
const issues = [];
if (counts['restaurant_reviews'] < 390) issues.push(`restaurant_reviews: expected >=390, got ${counts['restaurant_reviews']}`);
if (counts['review_analyses'] < 368) issues.push(`review_analyses: expected >=368, got ${counts['review_analyses']}`);
if (counts['flavor_index_daily'] < 100) issues.push(`flavor_index_daily: expected >=100, got ${counts['flavor_index_daily']}`);
if (counts['review_intelligence'] < 20) issues.push(`review_intelligence: expected >=20, got ${counts['review_intelligence']}`);
if (orphanedAnalyses > 0) issues.push(`${orphanedAnalyses} orphaned analyses (no matching review)`);
if (orphanedReviews > 0) issues.push(`${orphanedReviews} orphaned reviews (no matching restaurant)`);
if (severeAnalyses.length < 4) issues.push(`High severity: expected 4, got ${severeAnalyses.length}`);
if (fiErr) issues.push(`compute_flavor_index_range failed: ${fiErr.message}`);
if (compErr) issues.push(`get_competitor_ids failed: ${compErr.message}`);
if (staffErr) issues.push(`aggregate_staff_mentions failed: ${staffErr.message}`);
if (itemErr) issues.push(`aggregate_item_mentions failed: ${itemErr.message}`);
if (dashCompErr) issues.push(`get_dashboard_competitors failed: ${dashCompErr.message}`);
if (alertErr) issues.push(`get_severity_alerts failed: ${alertErr.message}`);
if (catErr) issues.push(`get_category_trend_weekly failed: ${catErr.message}`);
if (subCatErr) issues.push(`get_subcategory_breakdown failed: ${subCatErr.message}`);
if (riWithStrengths === 0) issues.push('review_intelligence: NO rows have top_strengths populated');
if (riWithOpps === 0) issues.push('review_intelligence: NO rows have top_opportunities populated');
if ((staffData?.length || 0) === 0) issues.push('aggregate_staff_mentions returned 0 staff');
if ((itemData?.length || 0) === 0) issues.push('aggregate_item_mentions returned 0 items');

if (issues.length === 0) {
  console.log('  ✅ NO ISSUES FOUND');
} else {
  console.log(`  ⚠️  ${issues.length} ISSUES FOUND:`);
  for (const i of issues) console.log(`    - ${i}`);
}

process.exit(0);
