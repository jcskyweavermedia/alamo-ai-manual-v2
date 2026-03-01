/**
 * Create 18 Apify tasks (6 restaurants × 3 platforms) and optionally start them.
 * Uses our custom Tastly actors, NOT marketplace actors.
 *
 * Usage:
 *   node scripts/create-apify-tasks.js          # Create tasks only
 *   node scripts/create-apify-tasks.js --run     # Create tasks AND start runs
 */

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const WEBHOOK_SECRET = 'tastly_webhook_secret_2026';
const WEBHOOK_URL = 'https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews';
const GROUP_ID = '00000000-0000-0000-0000-000000000001';

// Our custom actor IDs
const ACTORS = {
  google: '08Y1eaayqJpq3lDO3',       // tastly-google-scraper
  opentable: 'tCCIqeuE63V1t17Yi',     // tastly-opentable-scraper
  tripadvisor: '8CD4NGusm0iTYNtT2',   // tastly-tripadvisor-scraper
};

const MAX_REVIEWS = 50; // per platform per restaurant

const RESTAURANTS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'flemings-cg',
    name: "Fleming's CG",
    google_url: "https://www.google.com/maps/search/Fleming's+Prime+Steakhouse+%26+Wine+Bar+Coral+Gables",
    opentable_url: 'https://www.opentable.com/flemings-steakhouse-coral-gables',
    tripadvisor_url: 'https://www.tripadvisor.com/Restaurant_Review-g34152-d630151-Reviews-Fleming_s_Prime_Steakhouse_Wine_Bar-Coral_Gables_Florida.html',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'ruths-chris-cg',
    name: "Ruth's Chris CG",
    google_url: "https://www.google.com/maps/search/Ruth's+Chris+Steak+House+Coral+Gables",
    opentable_url: 'https://www.opentable.com/ruths-chris-steak-house-coral-gables',
    tripadvisor_url: 'https://www.tripadvisor.com/Restaurant_Review-g34152-d465672-Reviews-Ruth_s_Chris_Steak_House-Coral_Gables_Florida.html',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'mortons-cg',
    name: "Morton's CG",
    google_url: 'https://www.google.com/maps?cid=16619843955183395755',
    opentable_url: 'https://www.opentable.com/r/mortons-the-steakhouse-coral-gables',
    tripadvisor_url: 'https://www.tripadvisor.com/Restaurant_Review-g34152-d1367643-Reviews-Morton_s_The_Steakhouse-Coral_Gables_Florida.html',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    slug: 'perrys-cg',
    name: "Perry's CG",
    google_url: "https://www.google.com/maps/search/Perry's+Steakhouse+%26+Grille+Coral+Gables",
    opentable_url: 'https://www.opentable.com/r/perrys-steakhouse-and-grille-coral-gables',
    tripadvisor_url: 'https://www.tripadvisor.com/Restaurant_Review-g34152-d18926656-Reviews-Perry_s_Steakhouse_Grille_Coral_Gables-Coral_Gables_Florida.html',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    slug: 'capital-grille-miami',
    name: 'Capital Grille Miami',
    google_url: 'https://www.google.com/maps?cid=4555286816474833606',
    opentable_url: 'https://www.opentable.com/the-capital-grille-miami',
    tripadvisor_url: 'https://www.tripadvisor.com/Restaurant_Review-g34438-d431875-Reviews-The_Capital_Grille-Miami_Florida.html',
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    slug: 'pisco-y-nazca',
    name: 'Pisco y Nazca',
    google_url: 'https://www.google.com/maps/place/Pisco+y+Nazca+Ceviche+Gastrobar/@25.7946028,-80.3574889',
    opentable_url: 'https://www.opentable.com/r/pisco-y-nazca-doral',
    tripadvisor_url: 'https://www.tripadvisor.com/Restaurant_Review-g34227-d23714527-Reviews-Pisco_y_Nazca_Doral-Doral_Florida.html',
  },
];

function buildInput(platform, restaurant) {
  const urlKey = platform + '_url';
  const url = restaurant[urlKey];
  if (!url) return null;

  switch (platform) {
    case 'google':
      return {
        startUrls: [{ url }],
        maxItems: MAX_REVIEWS,
      };
    case 'opentable':
      return {
        startUrls: [{ url }],
        maxItems: MAX_REVIEWS,
        sort: 'newest',
      };
    case 'tripadvisor':
      return {
        startUrls: [{ url }],
        maxItems: MAX_REVIEWS,
        language: 'en',
      };
  }
}

function buildWebhookPayload(platform, restaurant) {
  return JSON.stringify({
    event: '{{eventType}}',
    runId: '{{resource.id}}',
    datasetId: '{{resource.defaultDatasetId}}',
    actorId: '{{eventData.actorId}}',
    actorTaskId: '{{eventData.actorTaskId}}',
    status: '{{resource.status}}',
    computeUnits: '{{resource.stats.computeUnits}}',
    finishedAt: '{{resource.finishedAt}}',
    meta: {
      restaurant_id: restaurant.id,
      platform: platform,
      group_id: GROUP_ID,
    },
  });
}

async function createTask(platform, restaurant) {
  const taskName = `${platform}-${restaurant.slug}`;
  const input = buildInput(platform, restaurant);
  if (!input) {
    console.log(`  SKIP ${taskName} — no URL`);
    return null;
  }

  const body = {
    actId: ACTORS[platform],
    name: taskName,
    options: { build: 'latest', memoryMbytes: 1024 },
    input,
  };

  const res = await fetch(`https://api.apify.com/v2/actor-tasks?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAIL ${taskName}: ${res.status} ${err}`);
    return null;
  }

  const data = await res.json();
  const taskId = data.data.id;
  console.log(`  OK   ${taskName} → task ID: ${taskId}`);

  // Add webhook
  const webhookRes = await fetch(`https://api.apify.com/v2/webhooks?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventTypes: ['ACTOR.RUN.SUCCEEDED'],
      condition: { actorTaskId: taskId },
      requestUrl: WEBHOOK_URL,
      headersTemplate: JSON.stringify({ 'X-Apify-Webhook-Secret': WEBHOOK_SECRET }),
      payloadTemplate: buildWebhookPayload(platform, restaurant),
    }),
  });

  if (!webhookRes.ok) {
    const err = await webhookRes.text();
    console.error(`  WARN webhook for ${taskName}: ${webhookRes.status} ${err}`);
  } else {
    console.log(`       webhook attached`);
  }

  return taskId;
}

async function startTask(taskId, taskName) {
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/${taskId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAIL run ${taskName}: ${res.status} ${err}`);
    return;
  }

  const data = await res.json();
  console.log(`  RUN  ${taskName} → run ID: ${data.data.id}`);
}

async function main() {
  const shouldRun = process.argv.includes('--run');
  const platforms = ['google', 'opentable', 'tripadvisor'];
  const createdTasks = [];

  console.log('=== Creating Apify Tasks ===');
  console.log(`Restaurants: ${RESTAURANTS.length}`);
  console.log(`Platforms: ${platforms.length}`);
  console.log(`Max reviews per task: ${MAX_REVIEWS}`);
  console.log('');

  for (const restaurant of RESTAURANTS) {
    console.log(`\n${restaurant.name} (${restaurant.id.slice(0,8)}...):`);
    for (const platform of platforms) {
      const taskId = await createTask(platform, restaurant);
      if (taskId) {
        createdTasks.push({ taskId, name: `${platform}-${restaurant.slug}` });
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n=== Created ${createdTasks.length} tasks ===`);

  if (shouldRun) {
    console.log('\n=== Starting runs ===');
    for (const { taskId, name } of createdTasks) {
      await startTask(taskId, name);
      await new Promise(r => setTimeout(r, 1000)); // 1s between runs
    }
    console.log(`\n=== Started ${createdTasks.length} runs ===`);
    console.log('Webhooks will automatically trigger ingest-reviews when runs complete.');
    console.log('Monitor at: https://console.apify.com/actors/runs');
  } else {
    console.log('\nRun with --run flag to start scraping:');
    console.log('  node scripts/create-apify-tasks.js --run');
  }
}

main().catch(console.error);
