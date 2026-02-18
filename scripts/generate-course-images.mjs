#!/usr/bin/env node

/**
 * One-time script to generate 6 SOS course card images via DALL-E 3.
 *
 * Usage:
 *   set OPENAI_API_KEY=sk-...
 *   node scripts/generate-course-images.mjs
 *
 * Output: public/images/courses/<slug>.webp
 *
 * After running, commit the generated images to git.
 * This script has no runtime dependency — images are static assets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'courses');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: Set OPENAI_API_KEY environment variable first.');
  console.error('  set OPENAI_API_KEY=sk-...');
  process.exit(1);
}

const BASE_STYLE =
  'Professional photorealistic image inside an upscale modern steakhouse with warm ambient lighting and shallow depth of field. No text overlays, no logos, no watermarks.';

const COURSES = [
  {
    slug: 'server-101',
    prompt: `${BASE_STYLE} A server wearing a black button-down shirt and black apron, confidently carrying two beautifully plated dishes through an elegant dining room with dark wood accents and soft candlelight.`,
  },
  {
    slug: 'bartender-101',
    prompt: `${BASE_STYLE} A bartender wearing a black button-down shirt and black apron behind a polished dark wood bar, skillfully crafting a cocktail with premium spirits and fresh garnishes. Bar shelves with bottles softly lit in the background.`,
  },
  {
    slug: 'busser-101',
    prompt: `${BASE_STYLE} A busser wearing a black button-down shirt and black apron clearing and resetting a table in the dining room. Neatly stacking plates and replacing linens. Dining room with leather booths in the background.`,
  },
  {
    slug: 'barback-101',
    prompt: `${BASE_STYLE} A barback wearing a black button-down shirt and black apron carrying a bus tub behind the bar area, restocking glassware and bottles. Bar counter and shelves visible in the background.`,
  },
  {
    slug: 'wine-201',
    prompt: `${BASE_STYLE} A sommelier wearing a black button-down shirt and black apron, elegantly presenting a bottle of red wine at a guest's table. Wine glass on white tablecloth, intimate fine-dining atmosphere.`,
  },
  {
    slug: 'food-201',
    prompt: `${BASE_STYLE} A server wearing a black button-down shirt and black apron at the kitchen pass window, inspecting beautifully plated dishes under warm heat lamps. Kitchen staff visible in the background through the pass.`,
  },
];

async function generateImage(course) {
  console.log(`\n[${course.slug}] Generating image...`);

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: course.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E API error for ${course.slug}: ${res.status} ${err}`);
  }

  const json = await res.json();
  const imageUrl = json.data[0].url;
  console.log(`[${course.slug}] Image URL received. Downloading...`);

  // Download the image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download image for ${course.slug}: ${imgRes.status}`);
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${course.slug}.webp`);

  // DALL-E returns PNG; we save as .webp extension for the component,
  // but the actual bytes are PNG. For true webp conversion you can
  // pipe through sharp. For now the browser handles PNG-in-webp fine,
  // or you can convert with: npx sharp-cli -i file.webp -o file.webp --webp
  fs.writeFileSync(outPath, buffer);
  console.log(`[${course.slug}] Saved to ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${COURSES.length} course images...`);
  console.log(`Output directory: ${OUT_DIR}\n`);

  // Run sequentially to avoid rate limits
  for (const course of COURSES) {
    try {
      await generateImage(course);
    } catch (err) {
      console.error(`[${course.slug}] FAILED: ${err.message}`);
      console.error('  Continuing with next image...\n');
    }
  }

  console.log('\nDone! Review images in public/images/courses/');
  console.log('Tip: For optimal size, convert to real webp:');
  console.log('  npx sharp-cli -i public/images/courses/*.webp -o public/images/courses/ --webp -q 80');
}

main();
