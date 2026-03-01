const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }
const GROUP_ID = '00000000-0000-0000-0000-000000000001';
const WEBHOOK_URL = 'https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews';

const ALL_TASKS = [
  // Google
  { taskId: 'GAV1YQqASc0UUBwwV', restaurant_id: '11111111-1111-1111-1111-111111111111', platform: 'google' },
  { taskId: 'uFEisZM3xiOgUOk8Y', restaurant_id: '22222222-2222-2222-2222-222222222222', platform: 'google' },
  { taskId: 't0ZVfs6HY6DjBwQZD', restaurant_id: '33333333-3333-3333-3333-333333333333', platform: 'google' },
  { taskId: 'wgnWNXhEeE4tLIHAo', restaurant_id: '44444444-4444-4444-4444-444444444444', platform: 'google' },
  { taskId: 'jXRbWFgfGVyDErnzR', restaurant_id: '55555555-5555-5555-5555-555555555555', platform: 'google' },
  { taskId: 'B5yAuve2dAJsiQvE0', restaurant_id: '66666666-6666-6666-6666-666666666666', platform: 'google' },
  // OpenTable
  { taskId: 'mDQn4sNhyO71YI4dv', restaurant_id: '11111111-1111-1111-1111-111111111111', platform: 'opentable' },
  { taskId: 'jdcPSfxMIagwrwbg3', restaurant_id: '22222222-2222-2222-2222-222222222222', platform: 'opentable' },
  { taskId: 'zGr9fDYSnUKpKQHGG', restaurant_id: '33333333-3333-3333-3333-333333333333', platform: 'opentable' },
  { taskId: 'uaEDAycWCVfombaYD', restaurant_id: '44444444-4444-4444-4444-444444444444', platform: 'opentable' },
  { taskId: 'p0Mr2L9t3SdxDZQJQ', restaurant_id: '55555555-5555-5555-5555-555555555555', platform: 'opentable' },
  { taskId: 'N6Fs92zJqXxwL1Kuf', restaurant_id: '66666666-6666-6666-6666-666666666666', platform: 'opentable' },
  // TripAdvisor
  { taskId: 's3T3baJIChcsPUabQ', restaurant_id: '11111111-1111-1111-1111-111111111111', platform: 'tripadvisor' },
  { taskId: 'ZctEZ3rBIwQ4pgYAv', restaurant_id: '22222222-2222-2222-2222-222222222222', platform: 'tripadvisor' },
  { taskId: 'wYthTbLK3Z6eh4Iba', restaurant_id: '33333333-3333-3333-3333-333333333333', platform: 'tripadvisor' },
  { taskId: 'Uzf7u7bjnePzliTC2', restaurant_id: '44444444-4444-4444-4444-444444444444', platform: 'tripadvisor' },
  { taskId: 'swz59wCVFSJeYAttN', restaurant_id: '55555555-5555-5555-5555-555555555555', platform: 'tripadvisor' },
  { taskId: 'F1jxoFhPJTh6120cz', restaurant_id: '66666666-6666-6666-6666-666666666666', platform: 'tripadvisor' },
];

async function main() {
  console.log('Checking and fixing webhook payloadTemplates on all 18 tasks...\n');

  let fixed = 0;
  for (const task of ALL_TASKS) {
    await new Promise(r => setTimeout(r, 300));

    // Get existing task webhooks
    const taskRes = await fetch(`https://api.apify.com/v2/actor-tasks/${task.taskId}/webhooks?token=${TOKEN}`);
    const taskData = await taskRes.json();
    const webhooks = taskData.data?.items || [];

    const correctTemplate = JSON.stringify({
      event: "{{eventType}}",
      runId: "{{resource.id}}",
      datasetId: "{{resource.defaultDatasetId}}",
      actorId: "{{resource.actId}}",
      actorTaskId: "{{resource.actorTaskId}}",
      status: "{{resource.status}}",
      meta: {
        restaurant_id: task.restaurant_id,
        platform: task.platform,
        group_id: GROUP_ID,
      }
    });

    for (const wh of webhooks) {
      const currentTemplate = wh.payloadTemplate || '';
      const needsFix = !currentTemplate.includes(task.restaurant_id) || !currentTemplate.includes(GROUP_ID);

      if (needsFix) {
        const updateRes = await fetch(`https://api.apify.com/v2/webhooks/${wh.id}?token=${TOKEN}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payloadTemplate: correctTemplate,
            headersTemplate: JSON.stringify({ 'X-Apify-Webhook-Secret': 'tastly_webhook_secret_2026' }),
          })
        });
        const updateData = await updateRes.json();
        if (updateData.data) {
          console.log(`  FIXED  ${task.taskId} (${task.platform})`);
          fixed++;
        } else {
          console.log(`  ERROR  ${task.taskId}: ${JSON.stringify(updateData)}`);
        }
      } else {
        console.log(`  OK     ${task.taskId} (${task.platform})`);
      }
    }

    if (webhooks.length === 0) {
      console.log(`  NONE   ${task.taskId} (${task.platform}) - no webhooks`);
    }
  }

  console.log(`\nDone. Fixed ${fixed} webhooks.`);
}
main().catch(console.error);
