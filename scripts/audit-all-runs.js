/**
 * Full audit of all Apify runs — dataset item counts + webhook delivery status.
 */

const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN env var'); process.exit(1); }

const ALL_RUNS = [
  // First batch
  { id: 'dituf9GPSqgnfJkg1', name: 'google-flemings-cg [1st]' },
  { id: '4n82shcnyESQMW0W1', name: 'opentable-flemings-cg [1st]' },
  { id: 'dCgl2nBuUWcv4BRdW', name: 'tripadvisor-flemings-cg' },
  { id: '1H37dmi1ZZmn4GAd9', name: 'google-ruths-chris-cg [1st]' },
  { id: 'OGwq3bRRM4an9ED74', name: 'opentable-ruths-chris-cg' },
  { id: '9O1eMcbIuN1m8JLjB', name: 'tripadvisor-ruths-chris-cg' },
  { id: '8sRKRt0nm3NI4rxyk', name: 'google-mortons-cg' },
  { id: 'ub47jns3NdSYqtudw', name: 'opentable-mortons-cg [1st]' },
  { id: 'K0KsqRwbq3PxYWhp1', name: 'tripadvisor-mortons-cg' },
  { id: '7Bafbr7pLH2E016wx', name: 'google-perrys-cg' },
  { id: 'J2g8dP2bPSB8Hx2ZV', name: 'opentable-perrys-cg' },
  { id: 'ljmXFVZRpcgopnkFf', name: 'tripadvisor-perrys-cg' },
  { id: 'tSnVz8YXnJC1PGUM3', name: 'google-capital-grille-miami [1st]' },
  { id: 's5ThA90U0U7RhsRCz', name: 'opentable-capital-grille-miami' },
  { id: 'p65dud7zYIwia7CjA', name: 'tripadvisor-capital-grille-miami' },
  { id: '5Wo5Xr45CBjUI7aJN', name: 'google-pisco-y-nazca' },
  { id: 'Z6eJIiauPfDysLGdw', name: 'opentable-pisco-y-nazca' },
  { id: 'Td1BShXkHaatlMWuj', name: 'tripadvisor-pisco-y-nazca' },
  // Re-runs
  { id: 'L8mR1ZrUVLYESZLp3', name: 'google-flemings-cg [RE-RUN]' },
  { id: 'd1klND5UkkATZoaFx', name: 'opentable-flemings-cg [RE-RUN]' },
  { id: 'ZsR375cRU45SvT2in', name: 'google-ruths-chris-cg [RE-RUN]' },
  { id: 'Ye9UF9qpDxO977szB', name: 'opentable-mortons-cg [RE-RUN]' },
  { id: 'U59FDpcyPXG6p2vlv', name: 'google-capital-grille-miami [RE-RUN]' },
];

async function main() {
  console.log('=== Full Apify Run Audit ===\n');

  const results = [];
  for (const run of ALL_RUNS) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${TOKEN}`);
    const data = await res.json();
    const d = data.data;

    let items = 0;
    if (d.status === 'SUCCEEDED' && d.defaultDatasetId) {
      const dsRes = await fetch(`https://api.apify.com/v2/datasets/${d.defaultDatasetId}?token=${TOKEN}`);
      const dsData = await dsRes.json();
      items = dsData.data.itemCount;
    }

    results.push({
      name: run.name,
      status: d.status,
      items,
      duration: d.finishedAt ? Math.round((new Date(d.finishedAt) - new Date(d.startedAt)) / 1000) : null,
    });
  }

  // Print table
  const header = 'Status'.padEnd(12) + 'Run'.padEnd(44) + 'Items'.padStart(6) + '  Duration';
  console.log(header);
  console.log('-'.repeat(header.length + 6));

  let totalItems = 0;
  let succeededCount = 0;
  let timedOutCount = 0;

  for (const r of results) {
    const icon = r.status === 'SUCCEEDED' ? 'OK' : r.status === 'TIMED-OUT' ? 'TIMEOUT' : r.status;
    const dur = r.duration ? r.duration + 's' : '?';
    console.log(`${icon.padEnd(12)}${r.name.padEnd(44)}${String(r.items).padStart(6)}  ${dur}`);
    totalItems += r.items;
    if (r.status === 'SUCCEEDED') succeededCount++;
    if (r.status === 'TIMED-OUT') timedOutCount++;
  }

  console.log('-'.repeat(header.length + 6));
  console.log(`\nSucceeded: ${succeededCount}  |  Timed out: ${timedOutCount}  |  Total items scraped: ${totalItems}`);

  // Summary by restaurant (combining first + re-run)
  console.log('\n\n=== Items by Restaurant x Platform (best run) ===\n');

  const byKey = {};
  for (const r of results) {
    if (r.status !== 'SUCCEEDED') continue;
    // Extract clean name: remove [1st], [RE-RUN] suffix
    const clean = r.name.replace(/ \[.*\]$/, '');
    if (!byKey[clean] || r.items > byKey[clean]) {
      byKey[clean] = r.items;
    }
  }

  // Group by restaurant
  const byRestaurant = {};
  for (const [key, items] of Object.entries(byKey)) {
    const parts = key.split('-');
    const platform = parts[0];
    const restaurant = parts.slice(1).join('-');
    if (!byRestaurant[restaurant]) byRestaurant[restaurant] = { google: 0, opentable: 0, tripadvisor: 0 };
    byRestaurant[restaurant][platform] = items;
  }

  const h2 = 'Restaurant'.padEnd(28) + 'Google'.padStart(8) + 'OpenTbl'.padStart(9) + 'TripAdv'.padStart(9) + '  TOTAL'.padStart(8);
  console.log(h2);
  console.log('-'.repeat(h2.length));

  let grandTotal = 0;
  for (const [name, c] of Object.entries(byRestaurant).sort()) {
    const total = c.google + c.opentable + c.tripadvisor;
    console.log(
      name.padEnd(28) +
      String(c.google).padStart(8) +
      String(c.opentable).padStart(9) +
      String(c.tripadvisor).padStart(9) +
      String(total).padStart(8)
    );
    grandTotal += total;
  }
  console.log('-'.repeat(h2.length));
  console.log('GRAND TOTAL'.padEnd(28) + String(grandTotal).padStart(34));
}

main().catch(console.error);
