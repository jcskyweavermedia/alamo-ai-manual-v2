const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54ZW9yYndxc292eWJmdHRlbXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY3MDExNywiZXhwIjoyMDg2MjQ2MTE3fQ.Agc1tfz8lMQ6Uk_G1hcNMNJ3xY160kKGkFibEoUGhJs';

async function rpc(fn, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function query(table, select, filters = '', limit = 5) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}${filters}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const data = await res.json();
  const range = res.headers.get('content-range');
  return { data, count: range ? range.split('/')[1] : '?', status: res.status };
}

async function main() {
  const OWN_ID = '11111111-1111-1111-1111-111111111111'; // Fleming's (primary own)

  console.log('=== DASHBOARD DATA VERIFICATION ===\n');

  // 1. tracked_restaurants
  const tr = await query('tracked_restaurants', 'id,name,restaurant_type', '&status=eq.active');
  console.log('1. Tracked restaurants:', tr.count, 'active');
  for (const r of tr.data) console.log(`   ${r.restaurant_type === 'own' ? '*' : ' '} ${r.name}`);

  // 2. flavor_index_daily (recent)
  const fid = await query('flavor_index_daily', 'restaurant_id,date,total_reviews,avg_rating,flavor_index,food_sentiment,service_sentiment', '&order=date.desc', 10);
  console.log('\n2. flavor_index_daily:', fid.count, 'total rows');
  console.log('   Recent samples:');
  for (const r of fid.data.slice(0, 5)) {
    console.log(`   ${r.date} | reviews:${r.total_reviews} | rating:${r.avg_rating} | FI:${r.flavor_index} | food:${r.food_sentiment} | svc:${r.service_sentiment}`);
  }

  // 3. review_intelligence (monthly)
  const riMonth = await query('review_intelligence', 'restaurant_id,period_type,period_start,period_end,total_reviews,flavor_index,flavor_index_change', '&period_type=eq.month&order=period_start.desc', 10);
  console.log('\n3. review_intelligence (monthly):', riMonth.count, 'rows');
  for (const r of riMonth.data.slice(0, 5)) {
    console.log(`   ${r.period_start} to ${r.period_end} | reviews:${r.total_reviews} | FI:${r.flavor_index} | delta:${r.flavor_index_change}`);
  }

  // 4. review_intelligence (weekly)
  const riWeek = await query('review_intelligence', 'restaurant_id,period_type,period_start,total_reviews,flavor_index', '&period_type=eq.week&order=period_start.desc', 5);
  console.log('\n4. review_intelligence (weekly):', riWeek.count, 'rows');

  // 5. Test RPC: compute_flavor_index_range
  const fi = await rpc('compute_flavor_index_range', {
    p_restaurant_id: OWN_ID,
    p_start_date: '2025-12-01',
    p_end_date: '2026-03-01',
  });
  console.log('\n5. compute_flavor_index_range (Fleming\'s, last 90 days):');
  console.log('   ', JSON.stringify(fi.data));
  if (fi.status !== 200) console.log('   ERROR status:', fi.status);

  // 6. Test RPC: get_dashboard_competitors
  const comp = await rpc('get_dashboard_competitors', {
    p_unit_id: OWN_ID,
    p_start_date: '2025-12-01',
    p_end_date: '2026-03-01',
  });
  console.log('\n6. get_dashboard_competitors:');
  if (Array.isArray(comp.data)) {
    for (const c of comp.data) {
      console.log(`   ${c.is_own ? '*' : ' '} ${(c.name || '?').padEnd(30)} FI:${c.flavor_index} | rating:${c.avg_rating} | reviews:${c.total_reviews}`);
    }
  } else {
    console.log('   ERROR:', JSON.stringify(comp.data));
  }

  // 7. Test RPC: aggregate_staff_mentions
  const staff = await rpc('aggregate_staff_mentions', {
    p_restaurant_id: OWN_ID,
    p_start_date: '2025-12-01',
    p_end_date: '2026-03-01',
    p_limit: 5,
  });
  console.log('\n7. aggregate_staff_mentions (Fleming\'s):');
  if (Array.isArray(staff.data)) {
    for (const s of staff.data) console.log(`   ${s.name} (${s.role}) — ${s.mentions} mentions, +${s.positive}/-${s.negative}`);
  } else {
    console.log('   Result:', JSON.stringify(staff.data).slice(0, 200));
  }

  // 8. Test RPC: get_severity_alerts
  const alerts = await rpc('get_severity_alerts', {
    p_restaurant_ids: tr.data.map(r => r.id),
    p_start_date: '2025-12-01',
    p_end_date: '2026-03-01',
    p_limit: 5,
  });
  console.log('\n8. get_severity_alerts:', Array.isArray(alerts.data) ? alerts.data.length : 'ERROR');

  // 9. Test RPC: get_subcategory_breakdown
  const subFood = await rpc('get_subcategory_breakdown', {
    p_restaurant_id: OWN_ID,
    p_start_date: '2025-12-01',
    p_end_date: '2026-03-01',
    p_bucket: 'food',
    p_limit: 5,
  });
  console.log('\n9. get_subcategory_breakdown (food):');
  if (Array.isArray(subFood.data)) {
    for (const s of subFood.data) console.log(`   ${s.category} — intensity:${s.avg_intensity} mentions:${s.mentions} trend:${s.trend_delta}`);
  } else {
    console.log('   Result:', JSON.stringify(subFood.data).slice(0, 200));
  }

  // 10. Test RPC: get_category_trend_weekly
  const catTrend = await rpc('get_category_trend_weekly', {
    p_restaurant_ids: tr.data.map(r => r.id),
    p_category: 'food',
    p_start_date: '2025-12-01',
    p_end_date: '2026-03-01',
  });
  console.log('\n10. get_category_trend_weekly (food):');
  console.log('    Rows:', Array.isArray(catTrend.data) ? catTrend.data.length : 'ERROR');
  if (Array.isArray(catTrend.data) && catTrend.data.length > 0) {
    console.log('    Sample:', JSON.stringify(catTrend.data.slice(0, 3)));
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}
main().catch(console.error);
