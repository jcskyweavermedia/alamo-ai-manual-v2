# Apify Setup Guide -- Review Scraping Pipeline

> **Purpose:** Step-by-step instructions to configure Apify Actor Tasks, Webhooks, and Schedules that feed restaurant reviews into the `ingest-reviews` Supabase Edge Function.
>
> **Audience:** Developers setting up or maintaining the scraping pipeline.
>
> **Last updated:** 2026-02-24

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Actor Selection](#2-actor-selection)
3. [Creating Actor Tasks](#3-creating-actor-tasks)
4. [Configuring Webhooks](#4-configuring-webhooks)
5. [Setting Up Schedules](#5-setting-up-schedules)
6. [Historical Backfill](#6-historical-backfill)
7. [Monitoring and Troubleshooting](#7-monitoring-and-troubleshooting)
8. [Cost Management](#8-cost-management)

---

## 1. Prerequisites

Before starting, make sure you have the following:

### Apify Account

1. Create a free account at https://apify.com (free tier provides $5/month in credits).
2. After logging in, navigate to **Settings > Integrations** and copy your **API Token**. You will need this token both as a Supabase secret and when creating webhooks.

### Supabase Secrets

Two secrets must be stored in Supabase before the pipeline can work:

```bash
# Generate a random 32-character webhook secret
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...

# Set both secrets in Supabase
npx supabase secrets set APIFY_API_TOKEN=apify_api_XXXXXXXXXXXXXXXXXXXXXXXX
npx supabase secrets set APIFY_WEBHOOK_SECRET=<the-hex-string-you-generated>
```

| Secret | Purpose |
|--------|---------|
| `APIFY_API_TOKEN` | Used by `ingest-reviews` to fetch review datasets from the Apify API |
| `APIFY_WEBHOOK_SECRET` | Shared secret validated by `ingest-reviews` to authenticate incoming webhook requests |

### Edge Function Deployed

The `ingest-reviews` edge function must be deployed before webhooks can deliver data:

```bash
npx supabase functions deploy ingest-reviews
```

Confirm it is accessible:
```
https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews
```

### Group ID

You will need the UUID of your `alamo-prime` group from the `groups` table. Query it:

```sql
SELECT id FROM groups WHERE slug = 'alamo-prime';
```

Keep this value handy -- you will substitute it for `<GROUP_ID>` in task configurations.

---

## 2. Actor Selection

We use three marketplace actors from the Apify Store, one per review platform:

| Platform | Actor ID | Apify Store Link | Approx. Cost |
|----------|----------|------------------|-------------|
| Google Maps | `compass/google-maps-reviews-scraper` | https://apify.com/compass/google-maps-reviews-scraper | ~$0.35 / 1K reviews |
| OpenTable | `scraped/opentable-review-scraper` | https://apify.com/scraped/opentable-review-scraper | ~$0.30 / 1K reviews |
| TripAdvisor | `maxcopell/tripadvisor-reviews` | https://apify.com/maxcopell/tripadvisor-reviews | ~$0.50 / 1K reviews |

**Why marketplace actors?**

- Zero development effort -- focus on the ingestion pipeline instead of scraping logic.
- Maintained by third parties (proxy rotation, anti-bot updates, DOM changes).
- Pay-per-result pricing with predictable costs.
- Can be replaced with custom actors later if needed.

---

## 3. Creating Actor Tasks

An **Actor Task** is a saved configuration that binds an actor to specific input (i.e., a restaurant URL with scraping parameters). You create one task per restaurant per platform.

### Task Naming Convention

```
{platform}-{restaurant-slug}
```

Examples: `google-alamo-prime`, `opentable-longhorn-ember`, `tripadvisor-salt-sear`

### Complete Task Matrix

| Restaurant | Google | OpenTable | TripAdvisor |
|------------|--------|-----------|-------------|
| Alamo Prime Steakhouse | `google-alamo-prime` | `opentable-alamo-prime` | `tripadvisor-alamo-prime` |
| Longhorn & Ember | `google-longhorn-ember` | `opentable-longhorn-ember` | `tripadvisor-longhorn-ember` |
| Salt & Sear Chophouse | `google-salt-sear` | `opentable-salt-sear` | `tripadvisor-salt-sear` |
| Mesquite Flame Grill | `google-mesquite-flame` | *(no OpenTable URL)* | `tripadvisor-mesquite-flame` |
| Alamo Prime - Westside | *(no URLs)* | *(no URLs)* | *(no URLs)* |

**Total: 11 active tasks** (4 Google + 3 OpenTable + 4 TripAdvisor). Mesquite Flame has no OpenTable listing. Westside has no platform URLs configured yet.

### Step-by-Step: Creating a Task

Repeat this for each of the 11 restaurant/platform combinations. The JSON input for each is provided in the `apify/tasks/` directory.

#### Step 1: Open the Actor Page

Go to the actor's Apify Store page:
- Google Maps: https://apify.com/compass/google-maps-reviews-scraper
- OpenTable: https://apify.com/scraped/opentable-review-scraper
- TripAdvisor: https://apify.com/maxcopell/tripadvisor-reviews

#### Step 2: Create a New Task

Click **"Create Task"** (or **"Try for free"** if this is your first time using the actor).

#### Step 3: Name the Task

In the task settings, set the name using the convention above. For example: `google-alamo-prime`.

#### Step 4: Configure Input

Switch to the **JSON input editor** (click the `<>` icon) and paste the `input` block from the corresponding JSON file in `apify/tasks/`. For example, for `google-alamo-prime`:

```json
{
  "startUrls": [
    { "url": "https://www.google.com/maps/place/Alamo+Prime+Steakhouse" }
  ],
  "maxReviewsPerPlace": 50,
  "reviewsSort": "newest",
  "language": "en",
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

#### Step 5: Save the Task

Click **"Save"**. The task is now ready to run manually or on a schedule.

#### Step 6: Test Run

Click **"Start"** to run the task once. Wait for it to complete and verify:
- Status shows `SUCCEEDED`
- The dataset contains review items
- Output fields match what the normalizer expects (see plan document)

---

## 4. Configuring Webhooks

Each Actor Task needs a webhook so that when it finishes scraping, it automatically POSTs the results metadata to the `ingest-reviews` edge function.

### Step-by-Step: Adding a Webhook to a Task

#### Step 1: Open Task Integrations

1. Go to https://console.apify.com/actors/tasks
2. Click on the task (e.g., `google-alamo-prime`)
3. Click the **"Integrations"** tab
4. Click **"+ Add webhook"**

#### Step 2: Configure Event Types

Select both:
- `ACTOR.RUN.SUCCEEDED` -- triggers review ingestion
- `ACTOR.RUN.FAILED` -- triggers failure logging

#### Step 3: Set Request URL

```
https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews
```

#### Step 4: Add Headers

Add the following header:

| Header Name | Value |
|-------------|-------|
| `X-Apify-Webhook-Secret` | Your webhook secret (the value you set in `APIFY_WEBHOOK_SECRET`) |

#### Step 5: Set Payload Template

Enable **"Custom payload template"** and paste the payload template. You must customize the `meta` block for each restaurant/platform combination.

**Generic template:**

```json
{
  "event": "{{eventType}}",
  "runId": "{{resource.id}}",
  "datasetId": "{{resource.defaultDatasetId}}",
  "actorId": "{{eventData.actorId}}",
  "actorTaskId": "{{eventData.actorTaskId}}",
  "status": "{{resource.status}}",
  "computeUnits": {{resource.stats.computeUnits}},
  "finishedAt": "{{resource.finishedAt}}",
  "meta": {
    "restaurant_id": "<RESTAURANT_UUID>",
    "platform": "<PLATFORM>",
    "group_id": "<GROUP_ID>"
  }
}
```

**Per-task `meta` values:**

| Task Name | `restaurant_id` | `platform` |
|-----------|-----------------|-----------|
| `google-alamo-prime` | `11111111-1111-1111-1111-111111111111` | `google` |
| `opentable-alamo-prime` | `11111111-1111-1111-1111-111111111111` | `opentable` |
| `tripadvisor-alamo-prime` | `11111111-1111-1111-1111-111111111111` | `tripadvisor` |
| `google-longhorn-ember` | `22222222-2222-2222-2222-222222222222` | `google` |
| `opentable-longhorn-ember` | `22222222-2222-2222-2222-222222222222` | `opentable` |
| `tripadvisor-longhorn-ember` | `22222222-2222-2222-2222-222222222222` | `tripadvisor` |
| `google-salt-sear` | `33333333-3333-3333-3333-333333333333` | `google` |
| `opentable-salt-sear` | `33333333-3333-3333-3333-333333333333` | `opentable` |
| `tripadvisor-salt-sear` | `33333333-3333-3333-3333-333333333333` | `tripadvisor` |
| `google-mesquite-flame` | `44444444-4444-4444-4444-444444444444` | `google` |
| `tripadvisor-mesquite-flame` | `44444444-4444-4444-4444-444444444444` | `tripadvisor` |

The `group_id` is the same for all tasks -- it is the UUID of the `alamo-prime` group from your database.

A generic webhook template file is also provided at `apify/webhooks/webhook-template.json`.

#### Step 6: Save the Webhook

Click **"Save"**. The webhook is now active for this task.

#### Step 7: Repeat for All Tasks

Repeat steps 1-6 for each of the 11 actor tasks, changing the `meta` block each time per the table above.

---

## 5. Setting Up Schedules

Daily schedules ensure reviews are scraped automatically. Stagger them 15 minutes apart to avoid hitting the `ingest-reviews` function simultaneously.

### Schedule Matrix

| Platform | Cron (UTC) | Local Time (CT) | Tasks Included |
|----------|-----------|-----------------|----------------|
| Google Maps | `0 8 * * *` | 2:00 AM CT | `google-alamo-prime`, `google-longhorn-ember`, `google-salt-sear`, `google-mesquite-flame` |
| OpenTable | `15 8 * * *` | 2:15 AM CT | `opentable-alamo-prime`, `opentable-longhorn-ember`, `opentable-salt-sear` |
| TripAdvisor | `30 8 * * *` | 2:30 AM CT | `tripadvisor-alamo-prime`, `tripadvisor-longhorn-ember`, `tripadvisor-salt-sear`, `tripadvisor-mesquite-flame` |

### Step-by-Step: Creating a Schedule

1. Go to https://console.apify.com/schedules
2. Click **"+ Create new"**
3. Fill in:
   - **Name:** `daily-google-reviews` (or `daily-opentable-reviews`, `daily-tripadvisor-reviews`)
   - **Cron expression:** Use the value from the table above (e.g., `0 8 * * *`)
   - **Timezone:** `UTC`
4. Under **"Actions"**, click **"+ Add action"** for each task in that platform group
   - Action type: **Run task**
   - Select the task (e.g., `google-alamo-prime`)
5. Repeat the "Add action" step for every task in that platform
6. Click **"Save"**

### Why Stagger?

- Prevents all webhooks from hitting `ingest-reviews` at the same time.
- Each edge function invocation has up to 60 seconds to process reviews.
- With 15-minute gaps, all Google tasks finish before OpenTable tasks start firing webhooks.

### Incremental vs Full

Daily schedules use `maxReviewsPerPlace: 50` (or equivalent). This captures the newest reviews since the last run. The `ON CONFLICT` upsert in the database ensures duplicates are handled cleanly.

---

## 6. Historical Backfill

Before switching to daily incremental scraping, run a one-time historical backfill to populate all available past reviews.

### Step 1: Create Backfill Tasks (or Modify Existing)

For each restaurant/platform task:
1. Open the task in Apify Console
2. Change the max reviews setting to a high number:
   - Google Maps: `maxReviewsPerPlace` -> `5000`
   - OpenTable: `maxItems` -> `5000`
   - TripAdvisor: `maxReviews` -> `5000`
3. Save the task

Alternatively, create separate backfill tasks (e.g., `google-alamo-prime-backfill`) to keep the daily config untouched.

### Step 2: Run Manually

1. Open the task
2. Click **"Start"** (do NOT run from a schedule)
3. Wait for it to complete (backfills can take 5-15 minutes per run)

### Step 3: Verify Ingestion

Check that reviews landed in the database:

```sql
SELECT platform, COUNT(*)
FROM restaurant_reviews
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY platform;
```

Check the `scrape_runs` table for status and counts:

```sql
SELECT *
FROM scrape_runs
ORDER BY created_at DESC
LIMIT 10;
```

### Step 4: Restore Daily Settings

After backfill completes, reset the max reviews back to 50:
- Google Maps: `maxReviewsPerPlace` -> `50`
- OpenTable: `maxItems` -> `50`
- TripAdvisor: `maxReviews` -> `50`

### Recommended Backfill Order

1. **Alamo Prime Steakhouse** (own restaurant) -- validates the full pipeline end-to-end
2. **One competitor** (e.g., Longhorn & Ember) -- validates multi-restaurant handling
3. **Remaining competitors** -- can run in parallel

### Handling Synthetic Seed Data

Phase 1 seeded 390 synthetic reviews with IDs like `google-rev-alamo-001`. Real Apify reviews use real platform IDs (e.g., `ChdDSUhN...` for Google) so there will be no conflicts.

After backfill, you can optionally clean up synthetic data:

```sql
DELETE FROM restaurant_reviews
WHERE platform_review_id LIKE '%-rev-%';
```

**Recommendation:** Keep synthetic data during development. Clean up before production launch.

### Edge Function Timeout Warning

The Supabase Edge Function has a 60-second timeout. For very large backfills (>5000 reviews), the function may time out. If this happens:
- Reduce `maxReviews` to 2000 and run multiple backfill passes
- Or use the two-phase processing approach described in the plan document (Section 7.3)

---

## 7. Monitoring and Troubleshooting

### Checking Apify Run Status

1. Go to https://console.apify.com/actors/runs
2. Filter by task name or status
3. Verify each run shows `SUCCEEDED`
4. Click a run to see its dataset, logs, and compute unit usage

### Checking Supabase Logs

The `ingest-reviews` function logs processing details. Check logs via:

**Supabase Dashboard:**
1. Go to https://supabase.com/dashboard/project/nxeorbwqsovybfttemrw
2. Navigate to **Edge Functions > ingest-reviews > Logs**
3. Look for HTTP status codes and error messages

**Supabase CLI:**
```bash
npx supabase functions logs ingest-reviews --project-ref nxeorbwqsovybfttemrw
```

### Checking the Database

**Scrape runs audit trail:**
```sql
SELECT id, platform, restaurant_id, status,
       reviews_fetched, reviews_inserted, reviews_duplicate, reviews_updated,
       started_at, completed_at
FROM scrape_runs
ORDER BY started_at DESC
LIMIT 20;
```

**Review counts by restaurant and platform:**
```sql
SELECT
  tr.name AS restaurant,
  rr.platform,
  COUNT(*) AS review_count,
  MIN(rr.review_date) AS earliest,
  MAX(rr.review_date) AS latest
FROM restaurant_reviews rr
JOIN tracked_restaurants tr ON tr.id = rr.restaurant_id
GROUP BY tr.name, rr.platform
ORDER BY tr.name, rr.platform;
```

**Reviews pending AI analysis:**
```sql
SELECT COUNT(*) FROM restaurant_reviews WHERE analysis_status = 'pending';
```

### Common Errors and Solutions

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Webhook returns 401 | Wrong or missing `X-Apify-Webhook-Secret` header | Verify the secret matches the `APIFY_WEBHOOK_SECRET` in Supabase secrets |
| Webhook returns 200 but no reviews in DB | `meta` block in payload template is misconfigured | Check that `restaurant_id`, `platform`, and `group_id` are correct UUIDs |
| Apify run SUCCEEDED but webhook never fires | Webhook not configured on the task | Go to task > Integrations and verify the webhook exists |
| `scrape_runs` shows status `failed` | Dataset fetch failed or DB upsert error | Check edge function logs for the specific error message |
| Duplicate `scrape_runs` rows | Apify retried the webhook | This is normal -- idempotency guard prevents duplicate review processing |
| Edge function timeout | Backfill dataset too large (>5000 reviews) | Reduce `maxReviews` and run in smaller batches |
| Reviews appear but `analysis_status` is stuck on `pending` | AI extraction (Phase 4b) not yet deployed | This is expected until the extraction pipeline is built |
| Actor run FAILED | Platform blocked the scraper or input URL is invalid | Check Apify run logs for details; verify the restaurant URL is correct |

---

## 8. Cost Management

### Apify Pricing Tiers

| Plan | Monthly Credits | Best For |
|------|----------------|----------|
| **Free** | $5/month | Initial testing, 1-2 restaurants |
| **Starter** | $49/month | Production with 4+ restaurants |
| **Scale** | $499/month | Not needed unless scraping 50+ restaurants |

### Estimated Monthly Costs

**Daily incremental scraping (4 restaurants):**

| Component | Per Day | Per Month |
|-----------|---------|-----------|
| 4 restaurants x Google (50 reviews each) | $0.07 | $2.10 |
| 3 restaurants x OpenTable (50 reviews each) | $0.045 | $1.35 |
| 4 restaurants x TripAdvisor (50 reviews each) | $0.075 | $2.25 |
| Compute overhead | ~$0.05 | ~$1.50 |
| **Total** | **~$0.24** | **~$7.20** |

This fits within the Free plan for initial testing. Move to Starter when adding more restaurants or if free credits are exhausted.

**Historical backfill (one-time):**

| Component | Reviews | Cost |
|-----------|---------|------|
| 4 restaurants x 3 platforms x ~500 avg | ~6,000 reviews | ~$2.50 |

### Monitoring Usage

1. Go to https://console.apify.com/billing
2. Check **"Usage"** to see compute units and actor costs
3. Set up **billing alerts** in Settings > Billing > Alerts to get notified before exceeding your plan

### Cost Optimization Tips

- **Reduce `maxReviews` for competitors:** If you only need sentiment trends (not every review), reduce from 50 to 20 for competitor restaurants.
- **Skip platforms with few reviews:** If a restaurant gets very few TripAdvisor reviews, consider disabling that task.
- **Use schedules wisely:** Not every restaurant needs daily scraping. Weekly scraping for slow-moving competitors saves credits.

---

## Quick Reference: File Inventory

```
apify/
  README.md                              # This file
  tasks/
    google-alamo-prime.json              # Google Maps task config
    opentable-alamo-prime.json           # OpenTable task config
    tripadvisor-alamo-prime.json         # TripAdvisor task config
    google-longhorn-ember.json
    opentable-longhorn-ember.json
    tripadvisor-longhorn-ember.json
    google-salt-sear.json
    opentable-salt-sear.json
    tripadvisor-salt-sear.json
    google-mesquite-flame.json           # No OpenTable for Mesquite
    tripadvisor-mesquite-flame.json
  webhooks/
    webhook-template.json                # Generic webhook payload template
```

---

## Appendix: Placeholder Reference

The JSON files in this directory use the following placeholders that must be replaced with real values:

| Placeholder | Where to Find It |
|-------------|-----------------|
| `<APIFY_WEBHOOK_SECRET>` | The value you generated with `openssl rand -hex 32` and stored in Supabase secrets |
| `<GROUP_ID>` | `SELECT id FROM groups WHERE slug = 'alamo-prime';` |
