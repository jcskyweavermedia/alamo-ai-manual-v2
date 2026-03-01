/**
 * Ingest Reviews Edge Function
 *
 * Webhook receiver for Apify scraping results. Processes review datasets
 * from Google Maps, OpenTable, and TripAdvisor, normalizes them, and
 * upserts into restaurant_reviews.
 *
 * Auth: Webhook secret (NOT JWT). Validates X-Apify-Webhook-Secret header
 * against APIFY_WEBHOOK_SECRET env var.
 *
 * DB access: Service role client (bypasses RLS) — no user context for webhooks.
 */

import { createServiceClient, type SupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { trackAndIncrement } from "../_shared/credit-pipeline.ts";

// =============================================================================
// TYPES
// =============================================================================

type Platform = "google" | "opentable" | "tripadvisor";

interface ApifyWebhookPayload {
  event: string;
  runId: string;
  datasetId: string;
  actorId: string;
  actorTaskId?: string;
  status: string;
  computeUnits?: number;
  finishedAt?: string;
  meta: {
    restaurant_id: string;
    platform: Platform;
    group_id: string;
  };
}

interface NormalizedReview {
  platform: Platform;
  platform_review_id: string;
  rating: number;
  review_date: string;
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

interface ProcessingCounts {
  fetched: number;
  inserted: number;
  duplicate: number;
  updated: number;
  errors: number;
}

const VALID_PLATFORMS: Platform[] = ["google", "opentable", "tripadvisor"];

const PAGE_SIZE = 1000;

// =============================================================================
// HELPERS
// =============================================================================

const LOG_PREFIX = "[ingest-reviews]";

/**
 * Constant-time string comparison to prevent timing attacks on webhook secret.
 * Iterates all characters regardless of match (no early exit).
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * SHA-256 hash for deriving OpenTable platform_review_id when no native ID exists.
 * Returns a 32-character hex string.
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/**
 * Clamp a rating value to integer 1-5, or return null.
 */
function clampRating(val: number | null | undefined): number | null {
  if (val == null) return null;
  const rounded = Math.round(val);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

/**
 * Safely parse a date string. Returns ISO string or null.
 */
function safeDate(val: string | null | undefined): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Safely parse a date string for DATE columns (YYYY-MM-DD). Returns date string or null.
 */
function safeDateOnly(val: string | null | undefined): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// =============================================================================
// PLATFORM NORMALIZERS
// =============================================================================

/**
 * Google Maps normalizer (compass/google-maps-reviews-scraper output).
 */
// deno-lint-ignore no-explicit-any
function normalizeGoogleReview(raw: any): NormalizedReview | null {
  if (!raw.reviewId) return null;

  const rating = clampRating(raw.stars);
  if (rating == null) return null;

  return {
    platform: "google",
    platform_review_id: String(raw.reviewId),
    rating,
    review_date: safeDate(raw.publishedAtDate) || new Date().toISOString(),
    visit_date: null,
    reviewer_name: raw.name || raw.reviewerName || null,
    language: raw.language || raw.originalLanguage || "en",
    review_text: raw.text || null,
    review_title: null,
    food_rating: raw.reviewDetailedRating?.Food
      ? clampRating(raw.reviewDetailedRating.Food)
      : null,
    service_rating: raw.reviewDetailedRating?.Service
      ? clampRating(raw.reviewDetailedRating.Service)
      : null,
    ambience_rating: raw.reviewDetailedRating?.Atmosphere
      ? clampRating(raw.reviewDetailedRating.Atmosphere)
      : null,
    value_rating: null,
    owner_response_text: raw.responseFromOwnerText || null,
    owner_response_date: safeDate(raw.responseFromOwnerDate),
    helpful_votes: raw.likesCount || 0,
    review_url: raw.reviewUrl || null,
  };
}

/**
 * OpenTable normalizer (scraped/opentable-review-scraper output).
 * OpenTable may not provide a stable review ID, so we derive one from content hash.
 */
// deno-lint-ignore no-explicit-any
async function normalizeOpenTableReview(raw: any): Promise<NormalizedReview | null> {
  let reviewId = raw.reviewId;
  if (!reviewId) {
    const hashInput = `${raw.reviewerName || ""}-${raw.dateSubmitted || ""}-${raw.overallRating || ""}-${(raw.text || "").slice(0, 100)}`;
    reviewId = `ot-${await hashString(hashInput)}`;
  }

  const rating = clampRating(raw.overallRating || raw.rating);
  if (rating == null) return null;

  return {
    platform: "opentable",
    platform_review_id: String(reviewId),
    rating,
    review_date: safeDate(raw.dateSubmitted || raw.date) || new Date().toISOString(),
    visit_date: safeDateOnly(raw.dateDined),
    reviewer_name: raw.reviewerName || raw.reviewer || null,
    language: "en",
    review_text: raw.text || raw.review || null,
    review_title: null,
    food_rating: clampRating(raw.foodRating),
    service_rating: clampRating(raw.serviceRating),
    ambience_rating: clampRating(raw.ambienceRating),
    value_rating: clampRating(raw.valueRating),
    owner_response_text: null,
    owner_response_date: null,
    helpful_votes: 0,
    review_url: raw.url || null,
  };
}

/**
 * TripAdvisor normalizer (maxcopell/tripadvisor-reviews output).
 */
// deno-lint-ignore no-explicit-any
function normalizeTripAdvisorReview(raw: any): NormalizedReview | null {
  const reviewId = raw.reviewId || raw.id;
  if (!reviewId) return null;

  const rating = clampRating(raw.rating);
  if (rating == null) return null;

  return {
    platform: "tripadvisor",
    platform_review_id: String(reviewId),
    rating,
    review_date: safeDate(raw.publishedDate || raw.date) || new Date().toISOString(),
    visit_date: safeDateOnly(raw.travelDate || raw.dateOfTravel),
    reviewer_name: raw.reviewer?.username || raw.reviewerName || null,
    language: raw.language || "en",
    review_text: raw.text || null,
    review_title: raw.title || null,
    food_rating: null,
    service_rating: null,
    ambience_rating: null,
    value_rating: null,
    owner_response_text: raw.ownerResponse?.text || raw.responseFromOwner || null,
    owner_response_date: safeDate(raw.ownerResponse?.date),
    helpful_votes: raw.helpfulVotes || 0,
    review_url: raw.url || raw.reviewUrl || null,
  };
}

/**
 * Route raw item to the correct platform normalizer.
 */
// deno-lint-ignore no-explicit-any
async function normalizeReview(platform: Platform, raw: any): Promise<NormalizedReview | null> {
  try {
    switch (platform) {
      case "google":
        return normalizeGoogleReview(raw);
      case "opentable":
        return await normalizeOpenTableReview(raw);
      case "tripadvisor":
        return normalizeTripAdvisorReview(raw);
      default:
        return null;
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Normalization error for ${platform}:`, err);
    return null;
  }
}

// =============================================================================
// BATCH UPSERT
// =============================================================================

/**
 * Upsert a batch of normalized reviews into restaurant_reviews.
 * Uses raw SQL via supabase.rpc to execute the ON CONFLICT pattern.
 *
 * Returns counts of inserted, duplicate, and updated rows.
 */
async function upsertReviewBatch(
  supabase: SupabaseClient,
  reviews: NormalizedReview[],
  restaurantId: string,
  groupId: string,
): Promise<{ inserted: number; duplicate: number; updated: number; errors: number }> {
  let inserted = 0;
  let duplicate = 0;
  let updated = 0;
  let errors = 0;

  for (const review of reviews) {
    try {
      // Use the Supabase client upsert with onConflict.
      // However, we need the complex ON CONFLICT logic with CASE expressions,
      // which the JS client can't express. Use a raw RPC call instead.
      //
      // Since we can't use raw SQL directly, we use .from().upsert() for the
      // initial insert and handle the conflict logic via a custom approach:
      // First try to select existing, then decide insert vs update.

      // Check if this review already exists
      const { data: existing } = await supabase
        .from("restaurant_reviews")
        .select("id, rating, review_text, analysis_status")
        .eq("platform", review.platform)
        .eq("platform_review_id", review.platform_review_id)
        .maybeSingle();

      if (existing) {
        // Review exists — apply the update logic from the upsert pattern.
        // NOTE: Text-only edits (same rating, different text) do NOT trigger re-analysis.
        // This is intentional: avoids re-analyzing unchanged-quality reviews. Only rating
        // changes signal a meaningful edit worth re-extracting.
        const shouldResetAnalysis = existing.rating !== review.rating;
        const shouldUpdateText =
          existing.review_text === null && review.review_text !== null;

        const { error: updateError } = await supabase
          .from("restaurant_reviews")
          .update({
            reviewer_name: review.reviewer_name,
            helpful_votes: review.helpful_votes,
            owner_response_text: review.owner_response_text,
            owner_response_date: review.owner_response_date,
            review_url: review.review_url,
            scraped_at: new Date().toISOString(),
            // Reset analysis if rating changed
            analysis_status: shouldResetAnalysis ? "pending" : existing.analysis_status,
            // Update text only if previously NULL
            review_text: shouldUpdateText ? review.review_text : existing.review_text,
            // Update rating
            rating: review.rating,
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error(`${LOG_PREFIX} Update error for ${review.platform_review_id}:`, updateError.message);
          errors++;
        } else if (shouldResetAnalysis || shouldUpdateText) {
          updated++;
        } else {
          duplicate++;
        }
      } else {
        // New review — insert
        const { error: insertError } = await supabase
          .from("restaurant_reviews")
          .insert({
            group_id: groupId,
            restaurant_id: restaurantId,
            platform: review.platform,
            platform_review_id: review.platform_review_id,
            rating: review.rating,
            review_date: review.review_date,
            visit_date: review.visit_date,
            reviewer_name: review.reviewer_name,
            language: review.language,
            review_text: review.review_text,
            review_title: review.review_title,
            food_rating: review.food_rating,
            service_rating: review.service_rating,
            ambience_rating: review.ambience_rating,
            value_rating: review.value_rating,
            owner_response_text: review.owner_response_text,
            owner_response_date: review.owner_response_date,
            helpful_votes: review.helpful_votes,
            review_url: review.review_url,
            analysis_status: "pending",
            scraped_at: new Date().toISOString(),
          });

        if (insertError) {
          // Could be a race condition duplicate — treat as duplicate
          if (insertError.code === "23505") {
            duplicate++;
          } else {
            console.error(`${LOG_PREFIX} Insert error for ${review.platform_review_id}:`, insertError.message);
            errors++;
          }
        } else {
          inserted++;
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Upsert exception for ${review.platform_review_id}:`, err);
      errors++;
    }
  }

  return { inserted, duplicate, updated, errors };
}

// =============================================================================
// SCRAPE RUN HELPERS
// =============================================================================

async function createScrapeRun(
  supabase: SupabaseClient,
  groupId: string,
  restaurantId: string,
  platform: Platform,
  apifyRunId: string,
  datasetId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("scrape_runs")
    .insert({
      group_id: groupId,
      restaurant_id: restaurantId,
      platform,
      apify_run_id: apifyRunId,
      apify_dataset_id: datasetId,
      status: "received",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`${LOG_PREFIX} Failed to create scrape_run:`, error.message);
    return null;
  }

  return data.id;
}

async function updateScrapeRun(
  supabase: SupabaseClient,
  scrapeRunId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("scrape_runs")
    .update(updates)
    .eq("id", scrapeRunId);

  if (error) {
    console.error(`${LOG_PREFIX} Failed to update scrape_run ${scrapeRunId}:`, error.message);
  }
}

// =============================================================================
// CORE PROCESSING
// =============================================================================

/**
 * Process the full dataset: fetch pages, normalize, upsert.
 * Updates scrape_runs with progress as it goes.
 */
async function processDataset(
  supabase: SupabaseClient,
  apifyToken: string,
  datasetId: string,
  platform: Platform,
  restaurantId: string,
  groupId: string,
  scrapeRunId: string,
  startOffset: number,
): Promise<ProcessingCounts> {
  const counts: ProcessingCounts = {
    fetched: 0,
    inserted: 0,
    duplicate: 0,
    updated: 0,
    errors: 0,
  };

  let offset = startOffset;

  while (true) {
    // Fetch one page from Apify
    const url = `https://api.apify.com/v2/datasets/${datasetId}/items?offset=${offset}&limit=${PAGE_SIZE}`;
    console.log(`${LOG_PREFIX} Fetching dataset page: offset=${offset}, limit=${PAGE_SIZE}`);

    let items: unknown[];
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apifyToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify dataset fetch failed (${response.status}): ${errorText}`);
      }

      items = await response.json();

      if (!Array.isArray(items)) {
        console.warn(`${LOG_PREFIX} Unexpected dataset response format, stopping`);
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${LOG_PREFIX} Dataset fetch error at offset ${offset}:`, msg);
      // Update scrape_run with progress so a retry can pick up
      await updateScrapeRun(supabase, scrapeRunId, {
        status: "failed",
        error_message: `Dataset fetch failed at offset ${offset}: ${msg}`,
        last_offset: offset,
        reviews_fetched: counts.fetched,
        reviews_inserted: counts.inserted,
        reviews_duplicate: counts.duplicate,
        reviews_updated: counts.updated,
      });
      throw err;
    }

    counts.fetched += items.length;
    console.log(`${LOG_PREFIX} Fetched ${items.length} items (total: ${counts.fetched})`);

    // Normalize all items in this page
    const normalized: NormalizedReview[] = [];
    for (const raw of items) {
      const review = await normalizeReview(platform, raw);
      if (review) {
        normalized.push(review);
      } else {
        counts.errors++;
      }
    }

    console.log(`${LOG_PREFIX} Normalized ${normalized.length}/${items.length} items`);

    // Batch upsert this page
    if (normalized.length > 0) {
      const batchResult = await upsertReviewBatch(supabase, normalized, restaurantId, groupId);
      counts.inserted += batchResult.inserted;
      counts.duplicate += batchResult.duplicate;
      counts.updated += batchResult.updated;
      counts.errors += batchResult.errors;
    }

    // Update scrape_run with progress after each page
    await updateScrapeRun(supabase, scrapeRunId, {
      last_offset: offset + items.length,
      reviews_fetched: counts.fetched,
      reviews_inserted: counts.inserted,
      reviews_duplicate: counts.duplicate,
      reviews_updated: counts.updated,
    });

    // If we got fewer items than PAGE_SIZE, we've reached the end
    if (items.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return counts;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`${LOG_PREFIX} Webhook received: ${req.method}`);

  // ---------------------------------------------------------------------------
  // 1. ENFORCE POST METHOD (before any secret logic to avoid info leaks)
  // ---------------------------------------------------------------------------
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "Only POST is accepted", 405);
  }

  // ---------------------------------------------------------------------------
  // 2. VALIDATE WEBHOOK SECRET
  // ---------------------------------------------------------------------------
  const webhookSecret = Deno.env.get("APIFY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error(`${LOG_PREFIX} APIFY_WEBHOOK_SECRET not configured`);
    return errorResponse("server_error", "Webhook secret not configured", 500);
  }

  const incomingSecret = req.headers.get("X-Apify-Webhook-Secret") || "";
  // Constant-time comparison to prevent timing attacks on the secret
  if (!constantTimeEqual(incomingSecret, webhookSecret)) {
    console.warn(`${LOG_PREFIX} Invalid webhook secret`);
    return errorResponse("unauthorized", "Invalid webhook secret", 401);
  }

  // From here on, always return 200 to Apify (prevents retries for business logic errors)
  try {
    // -------------------------------------------------------------------------
    // 3. PARSE PAYLOAD
    // -------------------------------------------------------------------------
    let payload: ApifyWebhookPayload;
    try {
      payload = await req.json() as ApifyWebhookPayload;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to parse webhook body:`, err);
      return jsonResponse({ ok: true, skipped: true, reason: "invalid_payload" });
    }

    const {
      event,
      runId,
      datasetId,
      actorId,
      status,
      meta,
    } = payload;

    console.log(`${LOG_PREFIX} Payload: event=${event}, runId=${runId}, actorId=${actorId}, status=${status}`);

    // Validate meta fields
    const restaurantId = meta?.restaurant_id;
    const platform = meta?.platform as Platform;
    const groupId = meta?.group_id;

    if (!restaurantId || !platform || !groupId) {
      console.error(`${LOG_PREFIX} Missing meta fields: restaurant_id=${restaurantId}, platform=${platform}, group_id=${groupId}`);
      return jsonResponse({ ok: true, skipped: true, reason: "missing_meta" });
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      console.error(`${LOG_PREFIX} Invalid platform: ${platform}`);
      return jsonResponse({ ok: true, skipped: true, reason: "invalid_platform" });
    }

    // -------------------------------------------------------------------------
    // 4. CREATE SERVICE CLIENT
    // -------------------------------------------------------------------------
    const supabase = createServiceClient();

    // -------------------------------------------------------------------------
    // 5. HANDLE NON-SUCCESS EVENTS
    // -------------------------------------------------------------------------
    if (event !== "ACTOR.RUN.SUCCEEDED") {
      console.warn(`${LOG_PREFIX} Non-success event: ${event} (status: ${status})`);

      // Log as failed scrape_run (with idempotency — skip if already recorded)
      try {
        if (runId) {
          const { data: existingFailed } = await supabase
            .from("scrape_runs")
            .select("id")
            .eq("apify_run_id", runId)
            .eq("platform", platform)
            .maybeSingle();

          if (existingFailed) {
            console.log(`${LOG_PREFIX} Failed run ${runId} already recorded, skipping`);
            return jsonResponse({ ok: true, skipped: true, reason: "duplicate_failed_run" });
          }
        }

        await supabase
          .from("scrape_runs")
          .insert({
            group_id: groupId,
            restaurant_id: restaurantId,
            platform,
            apify_run_id: runId || null,
            apify_dataset_id: datasetId || null,
            status: "failed",
            error_message: `Apify event: ${event}, status: ${status}`,
            completed_at: new Date().toISOString(),
          });
      } catch (err) {
        console.error(`${LOG_PREFIX} Failed to log failed run:`, err);
      }

      return jsonResponse({ ok: true, skipped: true, reason: "non_success_event", event });
    }

    // -------------------------------------------------------------------------
    // 6. VALIDATE REQUIRED FIELDS FOR PROCESSING
    // -------------------------------------------------------------------------
    if (!runId) {
      console.error(`${LOG_PREFIX} Missing runId in payload`);
      return jsonResponse({ ok: true, skipped: true, reason: "missing_run_id" });
    }

    if (!datasetId) {
      console.error(`${LOG_PREFIX} Missing datasetId in payload`);
      return jsonResponse({ ok: true, skipped: true, reason: "missing_dataset_id" });
    }

    // -------------------------------------------------------------------------
    // 7. IDEMPOTENCY CHECK
    // -------------------------------------------------------------------------
    const { data: existingRun } = await supabase
      .from("scrape_runs")
      .select("id, status")
      .eq("apify_run_id", runId)
      .eq("platform", platform)
      .maybeSingle();

    if (existingRun) {
      console.log(`${LOG_PREFIX} Idempotency: run ${runId}/${platform} already exists (status: ${existingRun.status})`);
      return jsonResponse({ ok: true, skipped: true, reason: "duplicate_run", existingStatus: existingRun.status });
    }

    // -------------------------------------------------------------------------
    // 8. VALIDATE APIFY TOKEN
    // -------------------------------------------------------------------------
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apifyToken) {
      console.error(`${LOG_PREFIX} APIFY_API_TOKEN not configured`);
      return jsonResponse({ ok: false, error: "apify_token_not_configured" });
    }

    // -------------------------------------------------------------------------
    // 9. CREATE SCRAPE RUN (status: received)
    // -------------------------------------------------------------------------
    const scrapeRunId = await createScrapeRun(
      supabase, groupId, restaurantId, platform, runId, datasetId,
    );

    if (!scrapeRunId) {
      console.error(`${LOG_PREFIX} Failed to create scrape_run record`);
      return jsonResponse({ ok: false, error: "scrape_run_creation_failed" });
    }

    console.log(`${LOG_PREFIX} Created scrape_run: ${scrapeRunId}`);

    // -------------------------------------------------------------------------
    // 10. UPDATE TO PROCESSING
    // -------------------------------------------------------------------------
    await updateScrapeRun(supabase, scrapeRunId, { status: "processing" });

    // -------------------------------------------------------------------------
    // 11. PROCESS DATASET
    // -------------------------------------------------------------------------
    let counts: ProcessingCounts;
    try {
      counts = await processDataset(
        supabase,
        apifyToken,
        datasetId,
        platform,
        restaurantId,
        groupId,
        scrapeRunId,
        0, // startOffset
      );
    } catch (err) {
      // processDataset already updated scrape_run to 'failed' with progress
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${LOG_PREFIX} Processing failed:`, msg);

      // Still return 200 to Apify to prevent retries
      return jsonResponse({
        ok: false,
        error: "processing_failed",
        message: msg,
        scrapeRunId,
      });
    }

    console.log(
      `${LOG_PREFIX} Processing complete: fetched=${counts.fetched}, ` +
      `inserted=${counts.inserted}, duplicate=${counts.duplicate}, ` +
      `updated=${counts.updated}, errors=${counts.errors}`
    );

    // -------------------------------------------------------------------------
    // 12. UPDATE SCRAPE RUN TO COMPLETED
    // -------------------------------------------------------------------------
    await updateScrapeRun(supabase, scrapeRunId, {
      status: "completed",
      reviews_fetched: counts.fetched,
      reviews_inserted: counts.inserted,
      reviews_duplicate: counts.duplicate,
      reviews_updated: counts.updated,
      error_message: counts.errors > 0 ? `${counts.errors} normalization/upsert errors` : null,
      completed_at: new Date().toISOString(),
    });

    // -------------------------------------------------------------------------
    // 13. UPDATE tracked_restaurants.last_scraped_at
    // -------------------------------------------------------------------------
    try {
      const { error: updateRestaurantError } = await supabase
        .from("tracked_restaurants")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", restaurantId);

      if (updateRestaurantError) {
        console.error(
          `${LOG_PREFIX} Failed to update tracked_restaurants.last_scraped_at:`,
          updateRestaurantError.message,
        );
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} tracked_restaurants update exception:`, err);
    }

    // -------------------------------------------------------------------------
    // 14. AUDIT LOG via credit pipeline
    // -------------------------------------------------------------------------
    try {
      await trackAndIncrement(
        supabase,
        null, // user_id = null (system-initiated)
        groupId,
        0, // credits = 0
        {
          domain: "reviews",
          action: "ingestion",
          edge_function: "ingest-reviews",
          metadata: {
            platform,
            restaurant_id: restaurantId,
            apify_run_id: runId,
            scrape_run_id: scrapeRunId,
            reviews_fetched: counts.fetched,
            reviews_inserted: counts.inserted,
            reviews_duplicate: counts.duplicate,
            reviews_updated: counts.updated,
          },
        },
      );
    } catch (err) {
      // Audit logging should never block the response
      console.error(`${LOG_PREFIX} Audit log failed:`, err);
    }

    // -------------------------------------------------------------------------
    // 15. RETURN SUCCESS
    // -------------------------------------------------------------------------
    return jsonResponse({
      ok: true,
      scrapeRunId,
      platform,
      restaurantId,
      counts: {
        fetched: counts.fetched,
        inserted: counts.inserted,
        duplicate: counts.duplicate,
        updated: counts.updated,
        errors: counts.errors,
      },
    });
  } catch (err) {
    // Catch-all: never let an unhandled error return non-200 to Apify
    console.error(`${LOG_PREFIX} Unhandled error:`, err);
    return jsonResponse({
      ok: false,
      error: "unhandled_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
