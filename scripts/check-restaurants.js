const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54ZW9yYndxc292eWJmdHRlbXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY3MDExNywiZXhwIjoyMDg2MjQ2MTE3fQ.Agc1tfz8lMQ6Uk_G1hcNMNJ3xY160kKGkFibEoUGhJs';

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tracked_restaurants?select=id,name,restaurant_type,parent_unit_id,group_id,status,city,state&order=restaurant_type.asc,name.asc`, {
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  });
  const data = await res.json();
  console.log('All tracked restaurants:');
  for (const r of data) {
    console.log(`  ${r.restaurant_type.padEnd(12)} ${r.name.padEnd(55)} group:${r.group_id} parent:${r.parent_unit_id || 'null'}`);
  }

  // Check group membership
  const groupRes = await fetch(`${SUPABASE_URL}/rest/v1/groups?select=id,name,slug`, {
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  });
  const groups = await groupRes.json();
  console.log('\nGroups:', JSON.stringify(groups));
}
main().catch(console.error);
