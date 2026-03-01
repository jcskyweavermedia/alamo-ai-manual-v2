const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const RUN_ID = process.argv[2] || 'dBlEznMOwKvhShpEH';

async function main() {
  const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${RUN_ID}/log?token=${TOKEN}`);
  const log = await logRes.text();

  // Find diagnostic section and nearby lines
  const lines = log.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('DIAGNOSTIC') || line.includes('Panel loaded') || line.includes('panel not') ||
        line.includes('Reviews tab') || line.includes('networkidle') || line.includes('consent') ||
        line.includes('btn[') || line.includes('tab[') || line.includes('Page title') ||
        line.includes('body text') || line.includes('RESIDENTIAL') || line.includes('proxy') ||
        line.includes('screenshot') || line.includes('role=') || line.includes('Scrollable') ||
        line.includes('Processing') || line.includes('Navigating') || line.includes('review card')) {
      console.log(lines[i]);
    }
  }
}
main().catch(console.error);
