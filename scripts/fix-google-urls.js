const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

// All 6 Google tasks — revert to /maps/search/ URLs which work on Apify
const GOOGLE_TASKS = [
  {
    taskId: 'GAV1YQqASc0UUBwwV',
    name: 'google-flemings-cg',
    url: "https://www.google.com/maps/search/Fleming's+Prime+Steakhouse+%26+Wine+Bar+Coral+Gables+FL"
  },
  {
    taskId: 'uFEisZM3xiOgUOk8Y',
    name: 'google-ruths-chris-cg',
    url: "https://www.google.com/maps/search/Ruth's+Chris+Steak+House+Coral+Gables+FL"
  },
  {
    taskId: 't0ZVfs6HY6DjBwQZD',
    name: 'google-mortons-cg',
    url: "https://www.google.com/maps/search/Morton's+The+Steakhouse+Coral+Gables+FL"
  },
  {
    taskId: 'wgnWNXhEeE4tLIHAo',
    name: 'google-perrys-cg',
    url: "https://www.google.com/maps/search/Perry's+Steakhouse+%26+Grille+Coral+Gables+FL"
  },
  {
    taskId: 'jXRbWFgfGVyDErnzR',
    name: 'google-capital-grille-miami',
    url: "https://www.google.com/maps/search/The+Capital+Grille+Miami+FL"
  },
  {
    taskId: 'B5yAuve2dAJsiQvE0',
    name: 'google-pisco-y-nazca',
    url: "https://www.google.com/maps/search/Pisco+y+Nazca+Ceviche+Gastrobar+Doral+FL"
  },
];

async function main() {
  console.log('Updating 6 Google tasks to /maps/search/ URLs...\n');

  for (const task of GOOGLE_TASKS) {
    const res = await fetch(`https://api.apify.com/v2/actor-tasks/${task.taskId}?token=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          startUrls: [{ url: task.url }],
          maxItems: 50
        }
      })
    });
    const data = await res.json();
    if (data.data) {
      console.log(`  OK  ${task.name} -> ${task.url.split('/search/')[1]}`);
    } else {
      console.log(`  FAIL  ${task.name}: ${JSON.stringify(data)}`);
    }
  }

  console.log('\nDone. All URLs reverted to /maps/search/ format.');
}
main().catch(console.error);
