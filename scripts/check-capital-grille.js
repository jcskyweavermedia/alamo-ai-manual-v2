const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const RUN_ID = 'cZ9WqhAmVfzdS9kd5';

async function main() {
  const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${RUN_ID}/log?token=${TOKEN}`);
  const log = await logRes.text();
  const lines = log.split('\n');
  for (const line of lines) {
    if (line.includes('DIAGNOSTIC') || line.includes('Panel') || line.includes('Reviews tab') ||
        line.includes('networkidle') || line.includes('Clicking') || line.includes('Extracted') ||
        line.includes('collected') || line.includes('Page title') || line.includes('Processing') ||
        line.includes('Navigating') || line.includes('Sort') || line.includes('ERROR') ||
        line.includes('body text') || line.includes('btn[') || line.includes('tab[') ||
        line.includes('Scrolling') || line.includes('role=') || line.includes('search result') ||
        line.includes('review card') || line.includes('No new') || line.includes('consent') ||
        line.includes('proxy')) {
      console.log(line.trim());
    }
  }
}
main().catch(console.error);
