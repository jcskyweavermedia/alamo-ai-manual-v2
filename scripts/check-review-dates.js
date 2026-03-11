const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54ZW9yYndxc292eWJmdHRlbXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY3MDExNywiZXhwIjoyMDg2MjQ2MTE3fQ.Agc1tfz8lMQ6Uk_G1hcNMNJ3xY160kKGkFibEoUGhJs';

async function main() {
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer': 'count=exact',
  };

  const res1 = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_reviews?select=review_date&order=review_date.asc&limit=1`, { headers });
  const earliest = await res1.json();

  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_reviews?select=review_date&order=review_date.desc&limit=1`, { headers });
  const latest = await res2.json();

  const res3 = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_reviews?select=review_date&limit=2000`, { headers });
  const allReviews = await res3.json();
  const uniqueDates = [...new Set(allReviews.map(r => r.review_date ? r.review_date.split('T')[0] : null).filter(Boolean))].sort();

  const res4 = await fetch(`${SUPABASE_URL}/rest/v1/flavor_index_daily?select=id&limit=1`, { headers });
  const fiRange = res4.headers.get('content-range');

  const res5 = await fetch(`${SUPABASE_URL}/rest/v1/review_intelligence?select=id&limit=1`, { headers });
  const riRange = res5.headers.get('content-range');

  console.log('=== Review Date Analysis ===');
  console.log('Earliest review:', earliest[0]?.review_date || 'none');
  console.log('Latest review:', latest[0]?.review_date || 'none');
  console.log('Unique dates:', uniqueDates.length);
  console.log('First 10 dates:', uniqueDates.slice(0, 10).join(', '));
  console.log('Last 10 dates:', uniqueDates.slice(-10).join(', '));
  console.log('');
  console.log('=== Current Rollup State ===');
  console.log('flavor_index_daily rows:', fiRange);
  console.log('review_intelligence rows:', riRange);
}
main().catch(console.error);
