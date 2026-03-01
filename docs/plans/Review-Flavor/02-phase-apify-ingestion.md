# Phase 2 — Apify Integration + Review Ingestion

> **Status:** DRAFT — Awaiting audit
> **Estimated effort:** ~2 sessions
> **Dependencies:** Phase 1 complete (9 migrations applied, all verified)
> **Produces:** `ingest-reviews` edge function + Apify actor configurations + webhook pipeline

---

## Table of Contents

1. [Goal](#1-goal)
2. [Architecture](#2-architecture)
3. [Decision: Marketplace Actors vs Custom Actors](#3-decision-marketplace-actors-vs-custom-actors)
4. [Apify Actor Selection & Configuration](#4-apify-actor-selection--configuration)
5. [Platform Normalization Mapping](#5-platform-normalization-mapping)
6. [Edge Function: `ingest-reviews`](#6-edge-function-ingest-reviews)
7. [Webhook Setup](#7-webhook-setup)
8. [Scheduling (Daily Cron)](#8-scheduling-daily-cron)
9. [Historical Backfill Strategy](#9-historical-backfill-strategy)
10. [Supabase Secrets](#10-supabase-secrets)
11. [Files Created](#11-files-created)
12. [Verification Checklist](#12-verification-checklist)
13. [Risk Assessment](#13-risk-assessment)
14. [Cost Estimates](#14-cost-estimates)

---

## 1. Goal

Reviews are automatically scraped from 3 platforms (Google Maps, OpenTable, TripAdvisor) on a **daily** schedule and stored normalized in `restaurant_reviews`. Historical reviews are backfilled for a meaningful Flavor Index baseline from day one.

**What this phase delivers:**
- Apify account configured with 3 actors (one per platform)
- Daily scrape schedules (incremental: last 3 days of reviews per run)
- `ingest-reviews` Supabase Edge Function — webhook receiver that fetches Apify datasets, normalizes reviews, and upserts into the DB
- Idempotent processing with resumable pagination
- Historical backfill of all available reviews
- Audit trail via `scrape_runs` table

**What this phase does NOT deliver:**
- AI extraction (Phase 4b)
- Rollup computation (Phase 3)
- Dashboard UI (Phase 4a)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  APIFY PLATFORM                      │
│                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Google Maps  │ │  OpenTable   │ │ TripAdvisor  │ │
│  │ Reviews      │ │  Reviews     │ │ Reviews      │ │
│  │  (compass/)  │ │ (scraped/)   │ │ (maxcopell/) │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ │
│         │                │                │          │
│         └────────┬───────┘────────┬───────┘          │
│                  │  ACTOR.RUN.SUCCEEDED               │
│                  │  (webhook POST)                    │
└──────────────────┼───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS                  │
│                                                       │
│  ┌─────────────────────────────────┐                 │
│  │  ingest-reviews                 │                 │
│  │  ┌───────────────────────────┐  │                 │
│  │  │ 1. Validate webhook secret│  │                 │
│  │  │ 2. Record scrape_run      │  │                 │
│  │  │ 3. Map actorId→restaurant │  │                 │
│  │  │ 4. Fetch dataset (paged)  │  │                 │
│  │  │ 5. Normalize per platform │  │                 │
│  │  │ 6. Upsert reviews         │  │                 │
│  │  │ 7. Update scrape_run stats│  │                 │
│  │  │ 8. Audit log              │  │                 │
│  │  └───────────────────────────┘  │                 │
│  └─────────────────────────────────┘                 │
└──────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│              SUPABASE POSTGRESQL                      │
│                                                       │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ scrape_runs      │  │ restaurant_reviews        │  │
│  │ (audit trail)    │  │ (normalized, deduplicated)│  │
│  └──────────────────┘  └──────────────────────────┘  │
│                                                       │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ tracked_         │  │ ai_usage_log              │  │
│  │ restaurants      │  │ (webhook audit)           │  │
│  │ (platform URLs)  │  └──────────────────────────┘  │
│  └──────────────────┘                                │
└──────────────────────────────────────────────────────┘
```

### Data Flow (per webhook call):

1. Apify actor completes → fires `ACTOR.RUN.SUCCEEDED` webhook
2. Webhook POST arrives at `ingest-reviews` edge function with `datasetId` + `runId`
3. Edge function validates `X-Apify-Webhook-Secret` header
4. Looks up restaurant by matching the actor's input URL against `tracked_restaurants` platform URLs
5. Creates `scrape_runs` record (status: `received` → `processing`)
6. Fetches reviews from Apify Dataset API in paginated batches (1000 items/page)
7. Normalizes each review to `restaurant_reviews` schema (platform-specific mapping)
8. Upserts via `INSERT ... ON CONFLICT (platform, platform_review_id) DO UPDATE`
9. Updates `scrape_runs` with counts and status `completed`
10. Logs to `ai_usage_log` for audit trail (0 credits, system-initiated)

---

## 3. Decision: Marketplace Actors vs Custom Actors

### Option A: Marketplace Actors (Recommended for MVP)

Use pre-built, maintained actors from the Apify Store:

| Platform | Actor ID | Pricing | Maturity |
|----------|----------|---------|----------|
| Google Maps | `compass/google-maps-reviews-scraper` | ~$0.35/1K reviews | 4.7/5, battle-tested |
| OpenTable | `scraped/opentable-review-scraper` | ~$0.30/1K reviews | Available |
| TripAdvisor | `maxcopell/tripadvisor-reviews` | ~$0.50/1K reviews | Established author |

**Pros:**
- Zero actor development time — focus entirely on the ingestion pipeline
- Maintained by third parties (proxy rotation, anti-bot updates)
- Pay-per-result pricing — predictable costs

**Cons:**
- Output schema is controlled by the actor author (may change)
- Less control over scraping behavior
- Dependent on third-party maintenance

### Option B: Custom Actors (Future Enhancement)

Build custom TypeScript actors in a monorepo structure:

```
apify/
  actors/
    google-reviews/
      .actor/actor.json
      src/main.ts
      package.json
    opentable-reviews/
    tripadvisor-reviews/
  packages/
    shared/
      src/normalize.ts
      src/types.ts
  package.json  (NPM workspaces root)
```

**Pros:**
- Full control over output schema (can normalize in the actor itself)
- Can embed restaurant metadata in actor input/output
- Can include webhook setup within the actor code
- Version-controlled alongside the rest of the codebase

**Cons:**
- Significant development effort (~2-3 additional sessions)
- Must maintain proxy rotation and anti-bot evasion
- Must handle platform DOM/API changes

### Recommendation

**Start with Option A (marketplace actors)** for Phase 2 MVP. The `ingest-reviews` edge function handles all normalization, so the actor output format doesn't matter much — we just need raw reviews. We can switch to custom actors later if marketplace actors become unreliable or too expensive.

**However**, we will scaffold the `apify/` directory structure now with configuration files that document the actor setup, making it easy to transition to custom actors in a future phase.

---

## 4. Apify Actor Selection & Configuration

### 4.1 Google Maps Reviews

**Actor:** `compass/google-maps-reviews-scraper`
**Store URL:** https://apify.com/compass/google-maps-reviews-scraper

**Input Configuration (per restaurant):**
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

**Key output fields (used by normalizer):**
| Apify Field | DB Column | Notes |
|-------------|-----------|-------|
| `reviewId` | `platform_review_id` | Unique review identifier |
| `stars` | `rating` | Integer 1-5 |
| `text` | `review_text` | May be null for rating-only reviews |
| `publishedAtDate` | `review_date` | ISO 8601 timestamp |
| `reviewerName` | `reviewer_name` | Display name |
| `language` | `language` | Detected language code |
| `responseFromOwnerText` | `owner_response_text` | Owner's reply |
| `responseFromOwnerDate` | `owner_response_date` | Reply date |
| `likesCount` | `helpful_votes` | Helpfulness indicator |
| `reviewUrl` | `review_url` | Link back to review |
| `reviewDetailedRating.Food` | `food_rating` | May exist for some reviews |
| `reviewDetailedRating.Service` | `service_rating` | May exist |
| `reviewDetailedRating.Atmosphere` | `ambience_rating` | May exist |

### 4.2 OpenTable Reviews

**Actor:** `scraped/opentable-review-scraper`
**Store URL:** https://apify.com/scraped/opentable-review-scraper

**Input Configuration (per restaurant):**
```json
{
  "startUrls": [
    { "url": "https://www.opentable.com/r/alamo-prime-steakhouse-austin" }
  ],
  "maxItems": 50,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

**Key output fields (used by normalizer):**
| Apify Field | DB Column | Notes |
|-------------|-----------|-------|
| `reviewId` or derived ID | `platform_review_id` | May need to derive from reviewer+date |
| `overallRating` | `rating` | Integer 1-5 |
| `text` | `review_text` | Review body |
| `dateSubmitted` | `review_date` | When review was posted |
| `dateDined` | `visit_date` | Unique to OpenTable |
| `reviewerName` | `reviewer_name` | Diner name |
| `foodRating` | `food_rating` | **Native sub-rating** (1-5) |
| `serviceRating` | `service_rating` | **Native sub-rating** (1-5) |
| `ambienceRating` | `ambience_rating` | **Native sub-rating** (1-5) |
| `valueRating` | `value_rating` | **Native sub-rating** (1-5) |

**OpenTable uniqueness:** Only platform that provides native sub-ratings (food, service, ambience, value). These are stored directly in `restaurant_reviews` — no AI extraction needed for these dimensions.

### 4.3 TripAdvisor Reviews

**Actor:** `maxcopell/tripadvisor-reviews`
**Store URL:** https://apify.com/maxcopell/tripadvisor-reviews

**Input Configuration (per restaurant):**
```json
{
  "startUrls": [
    { "url": "https://www.tripadvisor.com/Restaurant_Review-Alamo_Prime_Steakhouse" }
  ],
  "maxReviews": 50,
  "language": "ALL_REVIEW_LANGUAGES",
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

**Key output fields (used by normalizer):**
| Apify Field | DB Column | Notes |
|-------------|-----------|-------|
| `reviewId` or `id` | `platform_review_id` | Review identifier |
| `rating` | `rating` | Integer 1-5 |
| `text` | `review_text` | Review body |
| `title` | `review_title` | **Unique to TripAdvisor** |
| `publishedDate` | `review_date` | Publication date |
| `travelDate` | `visit_date` | When the diner visited |
| `reviewer.username` | `reviewer_name` | Username |
| `language` | `language` | Language code |
| `helpfulVotes` | `helpful_votes` | Helpfulness count |
| `ownerResponse.text` | `owner_response_text` | Owner reply |
| `ownerResponse.date` | `owner_response_date` | Reply date |
| `url` | `review_url` | Permalink |

---

## 5. Platform Normalization Mapping

Each Apify actor returns a different schema. The `ingest-reviews` edge function normalizes all three into the `restaurant_reviews` table schema.

### 5.1 Normalizer Interface

```typescript
interface NormalizedReview {
  platform: 'google' | 'opentable' | 'tripadvisor';
  platform_review_id: string;
  rating: number;          // 1-5 integer
  review_date: string;     // ISO 8601
  visit_date: string | null;
  reviewer_name: string | null;
  language: string;
  review_text: string | null;
  review_title: string | null;
  food_rating: number | null;
  service_rating: number | null;
  ambience_rating: number | null;
  value_rating: number | null;
  owner_response_text: string | null;
  owner_response_date: string | null;
  helpful_votes: number;
  review_url: string | null;
}
```

### 5.2 Google Maps Normalizer

```typescript
function normalizeGoogleReview(raw: GoogleReview): NormalizedReview | null {
  // Skip reviews without a reviewId (shouldn't happen but defensive)
  if (!raw.reviewId) return null;

  // Skip rating-only reviews with no text (optional: configurable)
  // Note: we still want these for Flavor Index — they have stars

  const rating = Math.round(raw.stars);
  if (rating < 1 || rating > 5) return null;

  return {
    platform: 'google',
    platform_review_id: raw.reviewId,
    rating,
    review_date: raw.publishedAtDate || new Date().toISOString(),
    visit_date: null,  // Google doesn't provide visit date
    reviewer_name: raw.reviewerName || null,
    language: raw.language || raw.originalLanguage || 'en',
    review_text: raw.text || null,
    review_title: null,  // Google doesn't have titles
    food_rating: raw.reviewDetailedRating?.Food
      ? Math.round(raw.reviewDetailedRating.Food) : null,
    service_rating: raw.reviewDetailedRating?.Service
      ? Math.round(raw.reviewDetailedRating.Service) : null,
    ambience_rating: raw.reviewDetailedRating?.Atmosphere
      ? Math.round(raw.reviewDetailedRating.Atmosphere) : null,
    value_rating: null,  // Google doesn't have value rating
    owner_response_text: raw.responseFromOwnerText || null,
    owner_response_date: raw.responseFromOwnerDate || null,
    helpful_votes: raw.likesCount || 0,
    review_url: raw.reviewUrl || null,
  };
}
```

### 5.3 OpenTable Normalizer

```typescript
function normalizeOpenTableReview(raw: OpenTableReview): NormalizedReview | null {
  // Derive platform_review_id — OpenTable may not provide a stable ID
  // Fallback: hash of reviewer + date + text
  const reviewId = raw.reviewId
    || `ot-${hashString(`${raw.reviewerName}-${raw.dateSubmitted}-${(raw.text || '').slice(0, 50)}`)}`;

  const rating = Math.round(raw.overallRating || raw.rating || 0);
  if (rating < 1 || rating > 5) return null;

  return {
    platform: 'opentable',
    platform_review_id: reviewId,
    rating,
    review_date: raw.dateSubmitted || raw.date || new Date().toISOString(),
    visit_date: raw.dateDined || null,
    reviewer_name: raw.reviewerName || raw.reviewer || null,
    language: 'en',  // OpenTable is primarily English
    review_text: raw.text || raw.review || null,
    review_title: null,  // OpenTable doesn't have titles
    food_rating: clampRating(raw.foodRating),
    service_rating: clampRating(raw.serviceRating),
    ambience_rating: clampRating(raw.ambienceRating),
    value_rating: clampRating(raw.valueRating),
    owner_response_text: null,  // OpenTable doesn't typically expose owner responses
    owner_response_date: null,
    helpful_votes: 0,
    review_url: raw.url || null,
  };
}

function clampRating(val: number | null | undefined): number | null {
  if (val == null) return null;
  const rounded = Math.round(val);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}
```

### 5.4 TripAdvisor Normalizer

```typescript
function normalizeTripAdvisorReview(raw: TripAdvisorReview): NormalizedReview | null {
  const reviewId = raw.reviewId || raw.id;
  if (!reviewId) return null;

  const rating = Math.round(raw.rating || 0);
  if (rating < 1 || rating > 5) return null;

  return {
    platform: 'tripadvisor',
    platform_review_id: String(reviewId),
    rating,
    review_date: raw.publishedDate || raw.date || new Date().toISOString(),
    visit_date: raw.travelDate || raw.dateOfTravel || null,
    reviewer_name: raw.reviewer?.username || raw.reviewerName || null,
    language: raw.language || 'en',
    review_text: raw.text || null,
    review_title: raw.title || null,
    food_rating: null,      // TripAdvisor doesn't provide sub-ratings
    service_rating: null,
    ambience_rating: null,
    value_rating: null,
    owner_response_text: raw.ownerResponse?.text || raw.responseFromOwner || null,
    owner_response_date: raw.ownerResponse?.date || null,
    helpful_votes: raw.helpfulVotes || 0,
    review_url: raw.url || raw.reviewUrl || null,
  };
}
```

---

## 6. Edge Function: `ingest-reviews`

### 6.1 Overview

**File:** `supabase/functions/ingest-reviews/index.ts`

**Auth pattern:** Webhook secret (NOT JWT). The function validates `X-Apify-Webhook-Secret` header against `APIFY_WEBHOOK_SECRET` env var.

**DB access:** Service role client (bypasses RLS) — no user context for webhooks.

**Credit pipeline:** Logs to `ai_usage_log` with `user_id = NULL`, `credits = 0` (system-initiated).

### 6.2 Request Flow

```
POST /functions/v1/ingest-reviews
Headers:
  X-Apify-Webhook-Secret: <shared_secret>
  Content-Type: application/json

Body (Apify webhook payload):
{
  "eventType": "ACTOR.RUN.SUCCEEDED",
  "eventData": {
    "actorId": "compass~google-maps-reviews-scraper",
    "actorRunId": "uPBN9qaKd2iLs5naZ"
  },
  "resource": {
    "id": "uPBN9qaKd2iLs5naZ",
    "status": "SUCCEEDED",
    "defaultDatasetId": "wmKPijuyDnPZAPRMk",
    "stats": {
      "computeUnits": 0.138
    }
  }
}
```

### 6.3 Processing Steps

```
1. Validate webhook secret
2. Parse webhook payload → extract runId, datasetId, actorId
3. Determine platform from actorId (google/opentable/tripadvisor)
4. Check idempotency: if scrape_runs already has this (apify_run_id, platform) → return 200 (skip)
5. Determine restaurant_id:
   a. Fetch Apify run input to get the startUrl
   b. Match startUrl against tracked_restaurants platform URLs
   c. If no match → log error, skip
6. Look up group_id from tracked_restaurants
7. Insert scrape_runs record (status: 'received')
8. Update scrape_runs to 'processing'
9. Fetch Apify dataset items in pages of 1000:
   a. GET https://api.apify.com/v2/datasets/{datasetId}/items?offset={offset}&limit=1000
   b. Normalize each item via platform-specific normalizer
   c. Skip invalid items (no rating, no review ID)
   d. Batch upsert into restaurant_reviews (see Section 6.4)
   e. Track counts: fetched, inserted, duplicate, updated
   f. Update scrape_runs.last_offset for resumability
   g. Continue until items.length < 1000
10. Update scrape_runs: status='completed', counts, completed_at
11. Update tracked_restaurants.last_scraped_at
12. Log to ai_usage_log via credit-pipeline
13. Return 200
```

### 6.4 Upsert Pattern

```sql
INSERT INTO restaurant_reviews (
  group_id, restaurant_id, platform, platform_review_id,
  rating, review_date, visit_date, reviewer_name, language,
  review_text, review_title,
  food_rating, service_rating, ambience_rating, value_rating,
  owner_response_text, owner_response_date,
  helpful_votes, review_url,
  analysis_status, scraped_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending', now())
ON CONFLICT (platform, platform_review_id) DO UPDATE SET
  -- Always update metadata (may have changed)
  reviewer_name = EXCLUDED.reviewer_name,
  helpful_votes = EXCLUDED.helpful_votes,
  owner_response_text = EXCLUDED.owner_response_text,
  owner_response_date = EXCLUDED.owner_response_date,
  review_url = EXCLUDED.review_url,
  scraped_at = EXCLUDED.scraped_at,
  updated_at = now(),
  -- Reset analysis if rating changed (edited review)
  analysis_status = CASE
    WHEN restaurant_reviews.rating != EXCLUDED.rating THEN 'pending'
    ELSE restaurant_reviews.analysis_status
  END,
  -- Update text if it was previously NULL (re-scrape after text was cleared)
  review_text = CASE
    WHEN restaurant_reviews.review_text IS NULL AND EXCLUDED.review_text IS NOT NULL
    THEN EXCLUDED.review_text
    ELSE restaurant_reviews.review_text
  END,
  -- Update rating if changed
  rating = EXCLUDED.rating
```

**Why this pattern:**
- New reviews: inserted with `analysis_status = 'pending'`
- Duplicate reviews: metadata updated, text/rating preserved
- Edited reviews (rating changed): `analysis_status` reset to `pending` for re-extraction
- Re-scraped after text was NULLed: text restored for re-extraction

### 6.5 Restaurant Matching Strategy

The webhook payload contains `actorId` and `runId` but NOT the restaurant ID. We need to match the run back to a `tracked_restaurants` row.

**Strategy: Actor Task approach**

Instead of raw actor runs, we'll use **Apify Actor Tasks** — named configurations that pre-bind an actor to specific input (restaurant URL). Each task corresponds to one restaurant + one platform.

When the webhook fires, it includes `eventData.actorTaskId` which we can map to a restaurant.

**Mapping table approach (in the webhook payload):**

We configure each Apify webhook with a **custom payload template** that includes the restaurant metadata:

```json
{
  "event": "{{eventType}}",
  "runId": "{{resource.id}}",
  "datasetId": "{{resource.defaultDatasetId}}",
  "actorId": "{{eventData.actorId}}",
  "actorTaskId": "{{eventData.actorTaskId}}",
  "status": "{{resource.status}}",
  "meta": {
    "restaurant_id": "11111111-1111-1111-1111-111111111111",
    "platform": "google",
    "group_id": "<group-uuid>"
  }
}
```

This eliminates the need to reverse-lookup the restaurant from the URL — the webhook payload carries the metadata directly.

### 6.6 Error Handling

| Error | Action |
|-------|--------|
| Invalid webhook secret | Return 401, log warning |
| Missing datasetId | Return 200 (ACK but skip), log error |
| Duplicate apify_run_id | Return 200 (idempotent skip) |
| Restaurant not found | Return 200, log error to scrape_runs (status: 'failed') |
| Apify dataset fetch fails | Update scrape_runs with last_offset, status: 'failed' |
| Individual review normalization fails | Skip review, increment error count, continue batch |
| DB upsert fails | Retry once, then mark scrape_run as 'failed' |

**Key principle:** Always return HTTP 200 to Apify (prevents retries for business logic errors). Only return non-200 for genuine server errors.

### 6.7 Edge Function Code Structure

```typescript
// supabase/functions/ingest-reviews/index.ts

import { createServiceClient } from "../_shared/supabase.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { trackAndIncrement } from "../_shared/credit-pipeline.ts";

// --- Types ---
interface ApifyWebhookPayload { ... }
interface NormalizedReview { ... }

// --- Platform normalizers ---
function normalizeGoogleReview(raw: any): NormalizedReview | null { ... }
function normalizeOpenTableReview(raw: any): NormalizedReview | null { ... }
function normalizeTripAdvisorReview(raw: any): NormalizedReview | null { ... }

// --- Helpers ---
function hashString(str: string): string { ... }
function clampRating(val: number | null): number | null { ... }

// --- Core processing ---
async function processDataset(
  supabase: SupabaseClient,
  apifyToken: string,
  datasetId: string,
  platform: string,
  restaurantId: string,
  groupId: string,
  scrapeRunId: string,
  startOffset: number
): Promise<{ fetched: number; inserted: number; duplicate: number; updated: number }> { ... }

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1. Validate webhook secret
  // 2. Parse payload
  // 3. Idempotency check
  // 4. Create scrape_run
  // 5. Process dataset
  // 6. Update scrape_run
  // 7. Audit log
  // 8. Return 200
});
```

---

## 7. Webhook Setup

### 7.1 Per-Task Webhooks (Recommended)

For each Apify Actor Task, configure a webhook in the Apify Console:

**Event types:** `ACTOR.RUN.SUCCEEDED`, `ACTOR.RUN.FAILED`

**Request URL:**
```
https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews
```

**Headers:**
```
X-Apify-Webhook-Secret: <your_webhook_secret>
```

**Custom payload template:**
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
    "restaurant_id": "11111111-1111-1111-1111-111111111111",
    "platform": "google",
    "group_id": "<alamo-prime-group-uuid>"
  }
}
```

### 7.2 Webhook Security

1. **Shared secret validation:** Edge function checks `X-Apify-Webhook-Secret` header
2. **HTTPS only:** Supabase Edge Functions are HTTPS by default
3. **Idempotency:** `UNIQUE(apify_run_id, platform)` prevents duplicate processing
4. **IP allowlisting (optional):** Apify webhooks come from 10 static IPs — can be used for defense-in-depth

### 7.3 Webhook Reliability

- Apify retries failed webhooks with exponential backoff (up to 11 retries over ~32 hours)
- Edge function must respond within **30 seconds**
- For large datasets: return 200 immediately, process asynchronously via background task or queue

**Important:** Supabase Edge Functions have a **60-second timeout** for non-streaming responses. For datasets with >5000 reviews, we need to process in the foreground within this window or adopt a two-phase approach:

**Two-phase approach (if needed for large backfills):**
1. Phase A (webhook handler): Record scrape_run, return 200 immediately
2. Phase B (scheduled processor): Pick up `received` scrape_runs, fetch datasets, process reviews

For daily incremental runs (~50 reviews), single-phase processing within 60 seconds is fine.

---

## 8. Scheduling (Daily Cron)

### 8.1 Apify Schedules

Create 3 schedules in Apify Console (one per platform), each running at staggered times:

| Schedule | Time (UTC) | Actor Task | Config |
|----------|-----------|------------|--------|
| Google Maps Daily | 08:00 (2 AM CT) | google-alamo-prime | `maxReviewsPerPlace: 50, reviewsSort: "newest"` |
| OpenTable Daily | 08:15 (2:15 AM CT) | opentable-alamo-prime | `maxItems: 50` |
| TripAdvisor Daily | 08:30 (2:30 AM CT) | tripadvisor-alamo-prime | `maxReviews: 50` |

**Staggering:** 15-minute gaps prevent all webhooks from hitting `ingest-reviews` simultaneously.

**Incremental strategy:** By sorting by "newest" and limiting to 50 reviews, we capture all new reviews from the past few days. The `ON CONFLICT` dedup ensures no duplicates even with overlapping windows.

### 8.2 Per-Restaurant Tasks

For each tracked restaurant with `scrape_enabled = true`, create separate Apify Actor Tasks:

| Restaurant | Google Task | OpenTable Task | TripAdvisor Task |
|------------|-------------|----------------|------------------|
| Alamo Prime Steakhouse | `google-alamo-prime` | `opentable-alamo-prime` | `tripadvisor-alamo-prime` |
| Longhorn & Ember | `google-longhorn-ember` | `opentable-longhorn-ember` | `tripadvisor-longhorn-ember` |
| Salt & Sear Chophouse | `google-salt-sear` | `opentable-salt-sear` | `tripadvisor-salt-sear` |
| Mesquite Flame Grill | `google-mesquite-flame` | *(no OpenTable)* | `tripadvisor-mesquite-flame` |
| Alamo Prime - Westside | *(no URLs configured)* | *(no URLs)* | *(no URLs)* |

**Total tasks:** 4 restaurants × 3 platforms = 12 tasks (minus 1 OpenTable, minus 3 Westside = **8 active tasks**)

Each task gets its own webhook with the restaurant metadata embedded in the payload template.

---

## 9. Historical Backfill Strategy

### 9.1 Approach

Run a one-time manual backfill for each restaurant to populate historical reviews:

1. Create separate "backfill" tasks in Apify with high `maxReviews` limits:
   - Google Maps: `maxReviewsPerPlace: 5000` (all available)
   - OpenTable: `maxItems: 5000`
   - TripAdvisor: `maxReviews: 5000`

2. Run each task manually (not on schedule)

3. Same webhooks fire → same `ingest-reviews` processes them → same dedup

4. After backfill completes, switch to daily incremental runs

### 9.2 Backfill Order

1. **Own restaurants first** (Alamo Prime Austin) — validates pipeline end-to-end
2. **One competitor** — validates multi-restaurant handling
3. **Remaining competitors** — parallel runs

### 9.3 Backfill Considerations

- **Cost:** Historical backfill may fetch 500-2000 reviews per restaurant. At ~$0.40/1K reviews average, one restaurant across 3 platforms costs ~$0.60-$2.40
- **Time:** Large datasets take 5-15 minutes per actor run
- **Edge function timeout:** For >5000 reviews, the 60-second edge function timeout may be exceeded. Use the two-phase approach (Section 7.3) if needed.

### 9.4 Dealing with Synthetic Seed Data

Phase 1 seeded 390 synthetic reviews with fake `platform_review_id` values (e.g., `google-rev-alamo-001`). When real Apify reviews arrive:

- **No conflict:** Real reviews have real platform IDs (e.g., `ChdDSUhN...` for Google), which won't collide with the synthetic `google-rev-*` pattern
- **Cleanup (optional):** After backfill, we can delete synthetic reviews via:
  ```sql
  DELETE FROM restaurant_reviews
  WHERE platform_review_id LIKE '%-rev-%';
  ```
  This would also cascade-delete their `review_analyses` rows and require re-running rollups.
- **Recommendation:** Keep synthetic data during development, clean up before production launch

---

## 10. Supabase Secrets

The following secrets must be set in Supabase:

```bash
# Apify API token (for fetching datasets)
npx supabase secrets set APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxx

# Webhook shared secret (for validating incoming webhooks)
npx supabase secrets set APIFY_WEBHOOK_SECRET=<generate-a-random-32-char-string>
```

**Generate a webhook secret:**
```bash
openssl rand -hex 32
```

---

## 11. Files Created

### Edge Function

```
supabase/functions/ingest-reviews/index.ts    # Webhook handler + dataset processor
```

### Configuration Reference (tracked in repo)

```
apify/README.md                               # Setup instructions for Apify account
apify/tasks/                                  # Actor task configurations (JSON reference)
  google-alamo-prime.json
  opentable-alamo-prime.json
  tripadvisor-alamo-prime.json
  google-longhorn-ember.json
  ... (one per restaurant × platform)
apify/webhooks/                               # Webhook configuration reference
  webhook-template.json
```

### No Migrations Needed

Phase 1 already created all required tables (`tracked_restaurants`, `scrape_runs`, `restaurant_reviews`). Phase 2 only writes data into them.

---

## 12. Verification Checklist

### V01: Edge Function Deployment
- [ ] `ingest-reviews` deployed to Supabase
- [ ] Function accessible at `https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews`

### V02: Webhook Authentication
- [ ] Request without `X-Apify-Webhook-Secret` → 401
- [ ] Request with wrong secret → 401
- [ ] Request with correct secret → 200

### V03: Idempotency
- [ ] Send same webhook payload twice → second returns 200 with `{ "skipped": true }`
- [ ] `scrape_runs` has only 1 row for the run

### V04: Google Maps Ingestion
- [ ] Trigger Google Maps actor task for Alamo Prime
- [ ] Webhook fires → reviews appear in `restaurant_reviews` with `platform = 'google'`
- [ ] `platform_review_id` matches Apify `reviewId`
- [ ] Ratings are correct integers 1-5
- [ ] Owner responses captured
- [ ] `analysis_status = 'pending'` for all new reviews

### V05: OpenTable Ingestion
- [ ] Trigger OpenTable actor task
- [ ] Reviews appear with `platform = 'opentable'`
- [ ] **Sub-ratings populated:** `food_rating`, `service_rating`, `ambience_rating`, `value_rating`
- [ ] `visit_date` populated from OpenTable's dining date

### V06: TripAdvisor Ingestion
- [ ] Trigger TripAdvisor actor task
- [ ] Reviews appear with `platform = 'tripadvisor'`
- [ ] `review_title` populated (unique to TripAdvisor)

### V07: Deduplication
- [ ] Run same actor task again → `scrape_runs.reviews_duplicate` incremented
- [ ] No duplicate rows in `restaurant_reviews`
- [ ] `reviews_inserted` = 0 for duplicate run

### V08: Edited Review Detection
- [ ] Manually update a review's rating in Apify dataset
- [ ] Re-run → `analysis_status` reset to `pending` for the changed review
- [ ] `scrape_runs.reviews_updated` incremented

### V09: Scrape Runs Audit Trail
- [ ] Each successful run creates a `scrape_runs` row with status `completed`
- [ ] `reviews_fetched`, `reviews_inserted`, `reviews_duplicate` counts are accurate
- [ ] `completed_at` is populated

### V10: Failed Run Handling
- [ ] Webhook with `eventType = 'ACTOR.RUN.FAILED'` → logged, no processing attempted
- [ ] `scrape_runs` row created with status `failed`

### V11: Historical Backfill
- [ ] Backfill run for Alamo Prime Google Maps completes
- [ ] All historical reviews populated
- [ ] `tracked_restaurants.last_scraped_at` updated

### V12: Credit Pipeline Audit
- [ ] Each webhook creates an `ai_usage_log` entry
- [ ] `user_id = NULL`, `credits_consumed = 0`, `domain = 'reviews'`, `action = 'ingestion'`

### V13: Multi-Platform Counts
- [ ] After all 3 platforms scraped for Alamo Prime:
  ```sql
  SELECT platform, COUNT(*)
  FROM restaurant_reviews
  WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
  GROUP BY platform;
  ```
  Returns rows for google, opentable, tripadvisor

---

## 13. Risk Assessment

### HIGH RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Edge function timeout (60s)** for large backfills | Backfill fails mid-processing | Two-phase approach: record run immediately, process via scheduled picker. Or: reduce batch size per run. |
| **Apify actor output schema changes** | Normalizer breaks, reviews lost | Pin actor versions, add defensive null checks, log normalization failures without crashing |
| **Webhook delivery failure** | Reviews not ingested | Apify retries up to 11 times over 32 hours. Idempotency guard prevents duplicates on retry. |

### MEDIUM RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OpenTable actor instability** | No OpenTable reviews | Multiple OpenTable actors available as fallbacks (`scraped/`, `shahidirfan/`, `memo23/`) |
| **Rate limiting by review platforms** | Actor runs fail or return partial data | Apify handles proxy rotation; use residential proxies for TripAdvisor |
| **Apify free plan limits** | Can't run all tasks daily | Monitor compute unit usage; upgrade to Starter ($49/mo) if needed |

### LOW RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Synthetic seed data collision** | Real reviews conflict with fake IDs | Different ID patterns — no actual conflict possible |
| **Timezone issues in review dates** | Dates off by hours | All dates stored as TIMESTAMPTZ; normalize to UTC in the normalizer |

---

## 14. Cost Estimates

### Daily Incremental Scraping

| Component | Per Day | Per Month |
|-----------|---------|-----------|
| 4 restaurants × 3 platforms × 50 reviews | 600 reviews | 18,000 reviews |
| Google Maps (~$0.35/1K) | $0.07 | $2.10 |
| OpenTable (~$0.30/1K) | $0.045 | $1.35 |
| TripAdvisor (~$0.50/1K) | $0.075 | $2.25 |
| **Total actor costs** | **$0.19** | **$5.70** |
| Apify compute overhead | ~$0.05 | ~$1.50 |
| **Grand total** | **$0.24** | **~$7.20** |

This fits comfortably within Apify's **Free plan** ($5/month credits) for the first few weeks, then the **Starter plan** ($49/month) provides ample headroom for growth.

### Historical Backfill (One-Time)

| Component | Reviews | Cost |
|-----------|---------|------|
| 4 restaurants × 3 platforms × ~500 avg | ~6,000 reviews | ~$2.50 |

---

## Appendix A: Apify Account Setup Checklist

1. [ ] Create Apify account at https://apify.com
2. [ ] Note API token from Settings → Integrations
3. [ ] Set Supabase secrets: `APIFY_API_TOKEN`, `APIFY_WEBHOOK_SECRET`
4. [ ] Create Actor Tasks for each restaurant × platform
5. [ ] Configure webhooks on each task
6. [ ] Test with a single small run before enabling schedules
7. [ ] Create daily schedules (staggered 15 min apart)
8. [ ] Run historical backfill

## Appendix B: Actor Task JSON Reference

Example task configuration for Google Maps (stored in `apify/tasks/` for reference):

```json
{
  "name": "google-alamo-prime",
  "actorId": "compass/google-maps-reviews-scraper",
  "input": {
    "startUrls": [
      { "url": "https://www.google.com/maps/place/Alamo+Prime+Steakhouse" }
    ],
    "maxReviewsPerPlace": 50,
    "reviewsSort": "newest",
    "language": "en",
    "proxyConfiguration": {
      "useApifyProxy": true
    }
  },
  "webhook": {
    "eventTypes": ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
    "requestUrl": "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-reviews",
    "headers": {
      "X-Apify-Webhook-Secret": "<APIFY_WEBHOOK_SECRET>"
    },
    "payloadTemplate": {
      "event": "{{eventType}}",
      "runId": "{{resource.id}}",
      "datasetId": "{{resource.defaultDatasetId}}",
      "actorId": "{{eventData.actorId}}",
      "actorTaskId": "{{eventData.actorTaskId}}",
      "status": "{{resource.status}}",
      "meta": {
        "restaurant_id": "11111111-1111-1111-1111-111111111111",
        "platform": "google",
        "group_id": "<alamo-prime-group-uuid>"
      }
    }
  }
}
```
