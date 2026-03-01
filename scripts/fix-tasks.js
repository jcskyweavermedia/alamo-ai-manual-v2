/**
 * Fix all Apify task configs:
 * 1. Update Google URLs from /maps/search/ to /maps/place/ format
 * 2. Fix Pisco y Nazca OpenTable URL
 * 3. Set all timeouts to 600s, Google memory to 2048MB
 * 4. Fix broken webhook payloadTemplates
 */

const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const WEBHOOK_SECRET = 'tastly_webhook_secret_2026';
const WEBHOOK_URL = 'https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews';
const GROUP_ID = '00000000-0000-0000-0000-000000000001';

// Updated Google URLs (place format with coordinates)
const GOOGLE_URL_FIXES = {
  'GAV1YQqASc0UUBwwV': { // google-flemings-cg
    url: "https://www.google.com/maps/place/Fleming's+Prime+Steakhouse+%26+Wine+Bar/@25.748469,-80.258359,17z/",
  },
  'uFEisZM3xiOgUOk8Y': { // google-ruths-chris-cg
    url: "https://www.google.com/maps/place/Ruth's+Chris+Steak+House/@25.7498,-80.2582,17z/",
  },
  'wgnWNXhEeE4tLIHAo': { // google-perrys-cg
    url: "https://www.google.com/maps/place/Perry's+Steakhouse+%26+Grille/@25.732657,-80.2599506,17z/",
  },
  'B5yAuve2dAJsiQvE0': { // google-pisco-y-nazca (fix coordinates)
    url: "https://www.google.com/maps/place/Pisco+y+Nazca+Ceviche+Gastrobar/@25.819958,-80.336205,17z/",
  },
};

// Pisco y Nazca OpenTable URL fix
const OPENTABLE_FIX = {
  'N6Fs92zJqXxwL1Kuf': { // opentable-pisco-y-nazca
    url: 'https://www.opentable.com/r/pisco-y-nazca-ceviche-gastrobar-doral',
  },
};

// All task IDs grouped by type
const TASKS = {
  google: ['GAV1YQqASc0UUBwwV', 'uFEisZM3xiOgUOk8Y', 't0ZVfs6HY6DjBwQZD', 'wgnWNXhEeE4tLIHAo', 'jXRbWFgfGVyDErnzR', 'B5yAuve2dAJsiQvE0'],
  opentable: ['mDQn4sNhyO71YI4dv', 'jdcPSfxMIagwrwbg3', 'zGr9fDYSnUKpKQHGG', 'uaEDAycWCVfombaYD', 'p0Mr2L9t3SdxDZQJQ', 'N6Fs92zJqXxwL1Kuf'],
  tripadvisor: ['s3T3baJIChcsPUabQ', 'ZctEZ3rBIwQ4pgYAv', 'wYthTbLK3Z6eh4Iba', 'Uzf7u7bjnePzliTC2', 'swz59wCVFSJeYAttN', 'F1jxoFhPJTh6120cz'],
};

const RESTAURANT_META = {
  'GAV1YQqASc0UUBwwV': { id: '11111111-1111-1111-1111-111111111111', platform: 'google' },
  'mDQn4sNhyO71YI4dv': { id: '11111111-1111-1111-1111-111111111111', platform: 'opentable' },
  's3T3baJIChcsPUabQ': { id: '11111111-1111-1111-1111-111111111111', platform: 'tripadvisor' },
  'uFEisZM3xiOgUOk8Y': { id: '22222222-2222-2222-2222-222222222222', platform: 'google' },
  'jdcPSfxMIagwrwbg3': { id: '22222222-2222-2222-2222-222222222222', platform: 'opentable' },
  'ZctEZ3rBIwQ4pgYAv': { id: '22222222-2222-2222-2222-222222222222', platform: 'tripadvisor' },
  't0ZVfs6HY6DjBwQZD': { id: '33333333-3333-3333-3333-333333333333', platform: 'google' },
  'zGr9fDYSnUKpKQHGG': { id: '33333333-3333-3333-3333-333333333333', platform: 'opentable' },
  'wYthTbLK3Z6eh4Iba': { id: '33333333-3333-3333-3333-333333333333', platform: 'tripadvisor' },
  'wgnWNXhEeE4tLIHAo': { id: '44444444-4444-4444-4444-444444444444', platform: 'google' },
  'uaEDAycWCVfombaYD': { id: '44444444-4444-4444-4444-444444444444', platform: 'opentable' },
  'Uzf7u7bjnePzliTC2': { id: '44444444-4444-4444-4444-444444444444', platform: 'tripadvisor' },
  'jXRbWFgfGVyDErnzR': { id: '55555555-5555-5555-5555-555555555555', platform: 'google' },
  'p0Mr2L9t3SdxDZQJQ': { id: '55555555-5555-5555-5555-555555555555', platform: 'opentable' },
  'swz59wCVFSJeYAttN': { id: '55555555-5555-5555-5555-555555555555', platform: 'tripadvisor' },
  'B5yAuve2dAJsiQvE0': { id: '66666666-6666-6666-6666-666666666666', platform: 'google' },
  'N6Fs92zJqXxwL1Kuf': { id: '66666666-6666-6666-6666-666666666666', platform: 'opentable' },
  'F1jxoFhPJTh6120cz': { id: '66666666-6666-6666-6666-666666666666', platform: 'tripadvisor' },
};

function buildPayloadTemplate(platform, restaurantId) {
  return JSON.stringify({
    event: 'ACTOR.RUN.SUCCEEDED',
    runId: '{{resource.id}}',
    datasetId: '{{resource.defaultDatasetId}}',
    actorId: '{{eventData.actorId}}',
    actorTaskId: '{{eventData.actorTaskId}}',
    status: '{{resource.status}}',
    meta: {
      restaurant_id: restaurantId,
      platform: platform,
      group_id: GROUP_ID,
    },
  });
}

async function getTask(taskId) {
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/${taskId}?token=${TOKEN}`);
  return (await res.json()).data;
}

async function updateTask(taskId, updates) {
  const res = await fetch(`https://api.apify.com/v2/actor-tasks/${taskId}?token=${TOKEN}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.ok;
}

async function fixWebhooks(taskId) {
  const meta = RESTAURANT_META[taskId];
  if (!meta) return;

  // List webhooks for this task
  const res = await fetch(`https://api.apify.com/v2/webhooks?token=${TOKEN}&limit=100`);
  const data = await res.json();
  const webhooks = data.data.items.filter(w => w.condition?.actorTaskId === taskId);

  for (const wh of webhooks) {
    // Update the webhook with proper payloadTemplate
    const payloadTemplate = buildPayloadTemplate(meta.platform, meta.id);
    const updateRes = await fetch(`https://api.apify.com/v2/webhooks/${wh.id}?token=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payloadTemplate,
        headersTemplate: JSON.stringify({ 'X-Apify-Webhook-Secret': WEBHOOK_SECRET }),
      }),
    });
    if (updateRes.ok) {
      return true;
    } else {
      const err = await updateRes.text();
      console.error(`    WARN: webhook update failed for ${taskId}: ${err}`);
      return false;
    }
  }
  return false;
}

async function main() {
  const allTaskIds = [...TASKS.google, ...TASKS.opentable, ...TASKS.tripadvisor];

  console.log('=== Fixing All 18 Apify Tasks ===\n');

  for (const taskId of allTaskIds) {
    const task = await getTask(taskId);
    const isGoogle = TASKS.google.includes(taskId);
    const changes = [];

    // 1. Timeout + memory
    const needsTimeout = !task.options?.timeoutSecs || task.options.timeoutSecs < 600;
    const needsMemory = isGoogle && (!task.options?.memoryMbytes || task.options.memoryMbytes < 2048);

    const options = {
      ...task.options,
      build: 'latest',
      timeoutSecs: 600,
      memoryMbytes: isGoogle ? 2048 : 1024,
    };

    // 2. URL fixes
    let input = task.input;
    if (GOOGLE_URL_FIXES[taskId]) {
      const newUrl = GOOGLE_URL_FIXES[taskId].url;
      const oldUrl = input?.startUrls?.[0]?.url;
      if (oldUrl !== newUrl) {
        input = { ...input, startUrls: [{ url: newUrl }] };
        changes.push(`URL: ${oldUrl?.slice(0, 40)}... → ${newUrl.slice(0, 50)}...`);
      }
    }
    if (OPENTABLE_FIX[taskId]) {
      const newUrl = OPENTABLE_FIX[taskId].url;
      const oldUrl = input?.startUrls?.[0]?.url;
      if (oldUrl !== newUrl) {
        input = { ...input, startUrls: [{ url: newUrl }] };
        changes.push(`URL: ${oldUrl} → ${newUrl}`);
      }
    }

    if (needsTimeout) changes.push(`timeout: ${task.options?.timeoutSecs ?? 300}→600s`);
    if (needsMemory) changes.push(`memory: ${task.options?.memoryMbytes ?? 1024}→2048MB`);

    // Apply updates
    const ok = await updateTask(taskId, { options, input });

    // 3. Fix webhook payloadTemplate
    const webhookFixed = await fixWebhooks(taskId);
    if (webhookFixed) changes.push('webhook payloadTemplate fixed');

    const status = ok ? 'OK' : 'FAIL';
    const changesStr = changes.length > 0 ? changes.join(', ') : 'no changes needed';
    console.log(`  ${status}  ${task.name.padEnd(35)} ${changesStr}`);

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
