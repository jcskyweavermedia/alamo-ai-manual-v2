/**
 * Spot-check AI extraction quality: staff mentions, item mentions, themes, etc.
 */
const SUPABASE_URL = 'https://nxeorbwqsovybfttemrw.supabase.co';
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SK) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

async function q(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SK, 'Authorization': `Bearer ${SK}` }
  });
  const data = await r.json();
  if (!Array.isArray(data)) {
    console.error('Query error:', JSON.stringify(data).slice(0, 200));
    return [];
  }
  return data;
}

async function main() {
  // Get 8 sample analyses from different restaurants
  const analyses = await q('review_analyses?select=id,review_id,overall_sentiment,emotion,strengths,opportunities,items_mentioned,staff_mentioned,return_intent,high_severity_flag,rating&order=created_at.desc&limit=8');

  console.log(`=== Sample AI Extractions (${analyses.length} most recent) ===\n`);
  for (const a of analyses) {
    console.log(`Review: ${a.review_id.slice(0, 8)}...`);
    console.log(`  Sentiment: ${a.overall_sentiment} | Emotion: ${a.emotion} | Rating: ${a.rating} | Return: ${a.return_intent}`);
    console.log(`  Strengths: ${JSON.stringify(a.strengths)}`);
    console.log(`  Opportunities: ${JSON.stringify(a.opportunities)}`);
    console.log(`  Staff: ${JSON.stringify(a.staff_mentioned)}`);
    console.log(`  Items: ${JSON.stringify(a.items_mentioned)}`);
    if (a.high_severity_flag) console.log(`  *** HIGH SEVERITY: ${a.high_severity_details}`);
    console.log('');
  }

  // Aggregate coverage stats (up to 1000)
  const all = await q('review_analyses?select=staff_mentioned,items_mentioned,strengths,opportunities&limit=1000');

  let withStaff = 0, withItems = 0, withStrengths = 0, withWeaknesses = 0, withThemes = 0;
  for (const a of all) {
    if (a.staff_mentioned && a.staff_mentioned.length > 0) withStaff++;
    if (a.items_mentioned && a.items_mentioned.length > 0) withItems++;
    if (a.strengths && a.strengths.length > 0) withStrengths++;
    if (a.opportunities && a.opportunities.length > 0) withWeaknesses++;
  }

  const total = all.length;
  console.log(`=== Extraction Coverage (${total} analyses) ===\n`);
  console.log(`  With strengths:     ${withStrengths}/${total} (${Math.round(withStrengths/total*100)}%)`);
  console.log(`  With opportunities: ${withWeaknesses}/${total} (${Math.round(withWeaknesses/total*100)}%)`);
  console.log(`  With staff:         ${withStaff}/${total} (${Math.round(withStaff/total*100)}%)`);
  console.log(`  With items:         ${withItems}/${total} (${Math.round(withItems/total*100)}%)`);

  // Show unique staff names and items across all analyses
  const staffNames = new Set();
  const itemNames = new Set();
  for (const a of all) {
    if (a.staff_mentioned) for (const s of a.staff_mentioned) staffNames.add(s.name || s);
    if (a.items_mentioned) for (const i of a.items_mentioned) itemNames.add(i.name || i);
  }
  console.log(`\n  Unique staff names: ${staffNames.size}`);
  if (staffNames.size > 0) console.log(`    Examples: ${[...staffNames].slice(0, 15).join(', ')}`);
  console.log(`  Unique menu items: ${itemNames.size}`);
  if (itemNames.size > 0) console.log(`    Examples: ${[...itemNames].slice(0, 15).join(', ')}`);
}

main().catch(console.error);
