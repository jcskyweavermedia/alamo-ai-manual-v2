const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function query(table, select, opts = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
  if (opts.limit) url += `&limit=${opts.limit}`;
  if (opts.order) url += `&order=${opts.order}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    }
  });
  return res.json();
}

async function main() {
  // Check tracked_restaurants
  const restaurants = await query('tracked_restaurants', 'id,name,group_id');
  console.log('=== tracked_restaurants ===');
  for (const r of restaurants) {
    console.log(`  ${r.id} | ${r.name} | group_id: ${r.group_id}`);
  }

  // Check existing scrape_runs (last 5)
  const runs = await query('scrape_runs', 'id,group_id,restaurant_id,platform,apify_run_id,status', { limit: 5, order: 'created_at.desc' });
  console.log('\n=== Recent scrape_runs ===');
  for (const r of runs) {
    console.log(`  ${r.id?.slice(0,8)} | group: ${r.group_id} | rest: ${r.restaurant_id?.slice(0,8)} | ${r.platform} | ${r.status}`);
  }

  // Check review counts
  const reviews = await query('restaurant_reviews', 'restaurant_id,platform', { limit: 1000 });
  const counts = {};
  for (const r of reviews) {
    const key = `${r.restaurant_id?.slice(0,8)}_${r.platform}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  console.log('\n=== Review counts ===');
  for (const [key, count] of Object.entries(counts).sort()) {
    console.log(`  ${key}: ${count}`);
  }
}
main().catch(console.error);
