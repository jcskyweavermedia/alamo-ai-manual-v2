# Plan: Fix Large Batch Extraction (100+ Items)

## Context

The user sent 100 beer/liquor items for batch extraction and it failed. The edge function (`supabase/functions/ingest/index.ts`) chunks text into groups of 50 lines and calls GPT-4o-mini for each chunk with `max_completion_tokens: 16000`. Each item generates ~200-250 tokens of structured JSON output (10 required fields including description, notes, style). A 50-item chunk produces ~11,000-12,500 output tokens — dangerously close to the 16K limit. With verbose AI descriptions, it can exceed the limit, causing truncated/invalid JSON or a timeout.

**Additional issues:**
- Chunks are processed sequentially (slow for 100+ items)
- A single chunk failure kills the entire batch (no retry, no partial results)
- No progress feedback to the user during multi-chunk extraction
- Publishing is sequential (1 DB insert per item, 5 slug checks each = up to 500 queries for 100 items)

---

## Changes

### 1. Reduce chunk size from 50 → 25 items

**File**: `supabase/functions/ingest/index.ts` (line 1929)

```ts
const BATCH_CHUNK_SIZE = 25;  // was 50
```

**Why**: 25 items × ~225 tokens = ~5,625 tokens — well within the 16K limit with generous margin for descriptions and JSON structure. For 100 items, this creates 4 chunks instead of 2.

### 2. Process chunks in parallel with `Promise.allSettled`

**File**: `supabase/functions/ingest/index.ts` (lines 2028-2096)

Replace the sequential `for` loop with parallel processing:

```ts
const chunkResults = await Promise.allSettled(
  chunks.map(async (chunk, i) => {
    console.log(`[ingest] Processing chunk ${i + 1}/${chunks.length}`);
    // ... existing OpenAI call logic per chunk ...
    return parsed.items;
  })
);

// Collect successful chunks + log failed ones
for (const [i, result] of chunkResults.entries()) {
  if (result.status === 'fulfilled') {
    allItems.push(...result.value);
  } else {
    console.error(`[ingest] Chunk ${i + 1} failed:`, result.reason);
    failedChunks.push(i + 1);
  }
}
```

**Why**: 4 chunks of 25 items each finish in the time of 1 chunk instead of 4x the time. `Promise.allSettled` ensures one failed chunk doesn't kill the others.

### 3. Add retry logic per chunk (1 retry with backoff)

**File**: `supabase/functions/ingest/index.ts`

Wrap each chunk's OpenAI call in a retry helper:

```ts
async function callWithRetry(fn: () => Promise<T>, retries = 1, delayMs = 2000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[ingest] Retry ${attempt + 1} after ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unreachable');
}
```

**Why**: Transient OpenAI errors (rate limits, 500s) are common. One retry catches most.

### 4. Return partial results instead of failing entirely

**File**: `supabase/functions/ingest/index.ts` (response section, lines 2132-2144)

If some chunks succeeded and some failed, still return the successful items with a warning:

```ts
return new Response(JSON.stringify({
  sessionId,
  items: enrichedItems,
  totalExtracted: enrichedItems.length,
  duplicates: duplicateCount,
  message: failedChunks.length > 0
    ? `Extracted ${enrichedItems.length} items. Chunks ${failedChunks.join(', ')} failed - try re-extracting the remaining items.`
    : lastAiMessage,
  failedChunks,  // new field
}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

**Why**: Getting 75 out of 100 items is far better than getting 0.

### 5. Frontend: show chunk progress during extraction

**File**: `src/hooks/use-batch-ingest.ts`

Currently `extractBatch` is a single fire-and-forget call. We can't show chunk progress without changing the protocol. Two options:

**Option A (simple)**: Add a toast/message after extraction completes that says "Extracted X items in Y chunks" - this is already partially done via `data.message`.

**Option B (advanced, skip for now)**: Stream chunk results via Server-Sent Events. This would require significant edge function refactoring.

**Recommendation**: Option A - just improve the completion message. The reduced chunk size + parallel processing means extraction will be faster, so progress isn't as critical.

### 6. Optimize publishing for large batches

**File**: `src/hooks/use-batch-ingest.ts` (lines 257-332)

Current: 1 insert + up to 5 slug checks per item = potentially 600 DB queries for 100 items.

**Optimization**: Pre-generate all slugs with a single bulk uniqueness check:

```ts
// 1. Generate candidate slugs for all items
const candidateSlugs = drafts.map(d => generateSlug(d.name));

// 2. Single query to find which slugs already exist
const { data: existingSlugs } = await supabase
  .from('beer_liquor_list')
  .select('slug')
  .in('slug', candidateSlugs);

const takenSlugs = new Set(existingSlugs?.map(r => r.slug) || []);

// 3. Deduplicate within the batch + against existing
const slugMap = new Map<string, string>(); // tempId -> unique slug
for (const draft of drafts) {
  let slug = generateSlug(draft.name);
  let attempt = 0;
  while (takenSlugs.has(slug) || [...slugMap.values()].includes(slug)) {
    attempt++;
    slug = `${generateSlug(draft.name)}-${attempt + 1}`;
  }
  slugMap.set(draft._tempId, slug);
}

// 4. Insert items (still sequential for per-item error handling + progress)
```

**Why**: Reduces slug checks from 500 queries to 1 query. Inserts remain sequential for reliable per-item progress callbacks.

---

## Files Summary

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/ingest/index.ts` | Reduce BATCH_CHUNK_SIZE to 25, parallel chunks with Promise.allSettled, retry logic, partial results |
| 2 | `src/hooks/use-batch-ingest.ts` | Bulk slug pre-check optimization, handle `failedChunks` in response |

**0 new files, 2 modified files**

---

## Execution Order

1. Edge function: reduce chunk size + parallel + retry + partial results
2. Deploy: `npx supabase functions deploy ingest --no-verify-jwt`
3. Frontend hook: bulk slug optimization + handle failedChunks
4. `npx tsc --noEmit` - zero errors

---

## Verification

1. `npx tsc --noEmit` - zero errors
2. **Small batch (10 items)**: Paste 10 items -> Extract -> all 10 appear in review table
3. **Large batch (100 items)**: Paste 100 items -> Extract -> all 100 appear (4 chunks x 25, processed in parallel)
4. **Edge function logs**: Check Supabase dashboard -> Edge Functions -> ingest -> Logs - should see "4 chunk(s) to process" and all completing successfully
5. **Partial failure**: Temporarily break one chunk to verify remaining chunks still return items + warning message appears
6. **Publish 100 items**: Click "Publish All" -> all items published with progress bar, no slug conflicts
