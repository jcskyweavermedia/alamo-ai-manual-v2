#!/usr/bin/env node

/**
 * One-time script to generate embeddings for SOS sections.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/embed-sos-sections.mjs
 *
 * Output: scripts/.sos-embeddings.json (id → embedding array)
 *
 * After generation, embeddings are applied to the database via SQL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: Set OPENAI_API_KEY environment variable first.');
  process.exit(1);
}

// All 29 SOS sections (from database query)
const SECTIONS = [
  { id: "3a9f2786-493f-4242-a662-ded7a96bb91d", section_key: "welcome", title_en: "Welcome & Mission", position: "server", content_en: "Welcome to our Serving Team!\n\nYour mission is to provide our guests with a memorable, personalized experience through exceptional team service, exercising all of Alamo Prime Steakhouse's standards and procedures.\n\nEvery guest is your guest. Every table is your table. If you anticipate that a guest or team member needs something, it is your responsibility to do anything and everything to fulfill their needs. We have built a reputation for exceeding our guests' expectations.\n\nAt Alamo Prime, our hospitality philosophy is to provide an outstanding, refined, and tailored experience to each and every one of our guests." },
  { id: "cc636367-0d58-4d48-813e-e043476780be", section_key: "primary-responsibilities", title_en: "Primary Responsibilities", position: "server", content_en: "Your primary responsibilities include: Arrive for your shift on time, in proper uniform, prepared with all your tools and knowledge, ready to work. Determine your station for the evening and detail it thoroughly. Teamwork is key in delivering the Alamo Prime experience. Adhere to all policies and procedures of Alamo Prime Steakhouse." },
  { id: "bcebd918-a312-4bcc-bbbe-bd97b0b57935", section_key: "prime-steakhouse", title_en: "What is a Prime Steakhouse?", position: "server", content_en: "A prime steakhouse is an establishment that dedicates itself to serving the highest-quality cuts of beef and accompaniments in an upscale, refined dining setting. A prime steakhouse takes classic American steakhouse traditions and elevates them to a superior level, creating an exceptional and memorable dining experience. A traditional restaurant focuses on variety. A prime steakhouse focuses on mastering the art of the perfect steak, complemented by an outstanding beverage program and impeccable side dishes. Alamo Prime Steakhouse strives for excellence in food, drinks, and service, while providing a warm, sophisticated, and comfortable setting. Our Dining Philosophy: Alamo Prime believes in a traditional coursed dining experience within a warm and elegant atmosphere." },
  { id: "8547632a-21a2-4258-9e59-c5f9b24212e0", section_key: "guest-service-standards", title_en: "Guest Service Standards", position: "server", content_en: "You are our guests' first contact with Alamo Prime. Greet every guest with a warm smile and a friendly hello. Maintain eye contact. Learn and use our guests' names. Recognize, greet, and seat guests personally and professionally. Personalize the experience by reading the chit. Anticipate needs. Remain available at all times. Guests always have the right of way. Lead guests to restrooms. Strive to do the right thing. Never take shortcuts." },
  { id: "87794f1d-86a6-4156-aa9f-d05f4d3e1fd1", section_key: "appearance-uniforms", title_en: "Appearance & Uniforms", position: "server", content_en: "Hair, facial hair, and nails must be clean and groomed. No extreme hair styles or color. Shower daily and use deodorant. Do not use overwhelming cologne or perfume. No earrings. Uniforms: Black polished non-slip shoes, black pants, black socks, black belt, clean and pressed apron, black undershirt, black Henley shirt." },
  { id: "bafbc3cd-a303-4fb7-aaff-4edd238b8dbf", section_key: "tools-knowledge", title_en: "Tools & Knowledge", position: "server", content_en: "Make sure you have these items before every shift: Pens, wine key, a bank (cash for making change), check presenters, steak temperature card. You must also know the menu, cocktails, wine list, bourbon selection, and daily specials." },
  { id: "5d548e8c-1f0b-4b5a-9e10-a85bb868c86c", section_key: "dining-room", title_en: "Dining Room Setup", position: "server", content_en: "Ensure your station is ready to go before service begins. All tables and table bases must be wiped down, clean, and free of chewing gum. Floors, chairs, and booths must be completely cleaned and spotless. Steak knives must be polished, spotless, and properly set at each place setting." },
  { id: "5660fada-9b7f-4841-9fa8-48153fe4a5f3", section_key: "job-responsibilities", title_en: "Job Responsibilities", position: "server", content_en: "Your job responsibilities include: Side work before, during, and at the end of your shift. Opening the door and helping seat our guests. Being at your station to greet guests as they are being seated. Helping fellow team members greet their tables. Having thorough knowledge of all products and menu items. Taking all orders accurately and efficiently. Serving all items according to our standards. Guiding our guests through the menu. Executing all steps of service. Anticipating guests' needs. Making eye contact while speaking to guests. Keeping guests informed. Always work as a team." },
  { id: "56e1b39d-455c-4df5-8bc9-262b497f8374", section_key: "professionalism", title_en: "Professionalism", position: "server", content_en: "Carry yourself in a professional manner at all times. Eye Contact: demonstrates confidence and interest. Smile: sets the tone and adds to a great guest experience. Body Language: stand straight and walk tall. Tone of Voice: keep it soft, smooth, and pleasant. Position at the Table: always position yourself across from the guest. Language: avoid unprofessional language, no slang or terms such as you guys." },
  { id: "a727e6a3-a486-4d1b-8e67-1fefcec644ca", section_key: "food-allergies", title_en: "Food Allergies & Intolerances", position: "server", content_en: "Food allergies occur when the immune system mistakenly attacks a food protein. A food allergy can be potentially fatal. Eight foods account for 90% of all food-allergic reactions: Milk, Eggs, Peanuts, Tree nuts, Fish, Shellfish, Wheat, Soy. Food intolerances differ from allergies. Lactose Intolerance: small intestine does not produce enough lactase enzyme. Celiac Disease: adverse reaction to gluten." },
  { id: "4a1f1d78-7083-4030-ba49-58d0a6415310", section_key: "warm-welcome", title_en: "Warm Welcome & Seating", position: "server", content_en: "When a guest arrives, always make eye contact, smile, greet, and welcome them. Greet guests by their name. The host will hand the seater a chit with the guest's name and notes. Offer to assist them to their table. Strike up a conversation while guiding them. Pull out their chair if possible (ladies first). Always place menus in the guest's hands. The Quick Intro (10-12 seconds): explain daily specials, beverage and bourbon selections, and happy hour." },
  { id: "9c9dec91-783a-43b5-8338-ac4e9bf2c4ac", section_key: "transferring-checks", title_en: "Transferring Checks", position: "server", content_en: "Guests may begin their dining experience at the bar and then move to the dining room. When this happens, they may want to transfer their check from the bar to their table. Our guests are allowed to transfer their checks. The bartender is responsible for initiating the transfer. It is your job to ensure the transfer is performed. When you become aware a check needs to be transferred, seek out any manager and have them transfer the check." },
  { id: "68cdfbcc-bdc3-45c1-ab5b-fcdc17a80077", section_key: "first-approach", title_en: "First Approach — The Greeting", position: "server", content_en: "The greeting has several parts that must be covered: Name & Introduction, Beverage Order, Water Type, Appetizer Mention." },
  { id: "ea76715f-7f6d-46e6-b770-3282956147c3", section_key: "first-approach-intro", title_en: "Name & Introduction", position: "server", content_en: "Your introduction sets the tone for the entire dining experience. Address the Guest: Use the guest's last name from the seating chit. Acknowledge special occasions. Ask if this is anyone's first time. First-Time Guests: inform about prime steakhouse, coursed menu, hand-selected aged steaks, outstanding bourbon and whiskey program. Returning Guests: welcome back and proceed to beverage order." },
  { id: "0b4f56d8-ab7b-44c2-b845-d596c96e8526", section_key: "first-approach-beverage", title_en: "Beverage Order", position: "server", content_en: "Ask the guests if they are interested in a cocktail, bourbon, or wine to start the evening. Direct guests to the beverage menu as you make a suggestion. Read the guest to determine their preferences. Off-Menu Requests: always ask if they have a liquor preference. Never use the word well liquors — always say our house liquors." },
  { id: "aa43ebe0-7d56-4746-926f-4a4d16186aff", section_key: "first-approach-water", title_en: "Water Type", position: "server", content_en: "Ask guests for their water preference: regular or bottled. If bottled, determine if they prefer still or sparkling. Our regular water is filtered at the restaurant." },
  { id: "16f283c8-c72e-4e1e-a6e2-06525363939a", section_key: "first-approach-appetizer", title_en: "Appetizer Mention", position: "server", content_en: "Read your guests and determine if you can proceed with the appetizer mention. Ask the guests if they would like to hear appetizer suggestions. Point out 2-3 selections from the menu. When making a recommendation, always ask if the guest would like to order one of your selections. Take the order!" },
  { id: "1bcfb785-f19d-4e87-a153-a78873793094", section_key: "second-approach", title_en: "Second Approach — Beverage Delivery & Entrée Presentation", position: "server", content_en: "Beverage Delivery: All beverages on a tray. Serve ladies first. Cocktail napkin underneath. Drinks within 3-5 minutes. Delivered by name. Labels face the guest. Entrée Presentation: Make 2-3 recommendations. At least one from daily specials. Ask if ready to order." },
  { id: "16fb5e6e-107d-4fd5-82d5-02e35edb0d2f", section_key: "taking-the-order", title_en: "Taking the Order", position: "server", content_en: "Once guests are ready to order, begin with ladies first. Repeat the order back to each guest individually. For steak orders, confirm the cut and size, desired temperature, any additions or toppings, choice of sides. Steak Temperatures: Rare (cool red center), Medium Rare (warm red center, most popular), Medium (warm pink center), Medium Well (slight hint of pink), Well Done (no pink, cooked through)." },
  { id: "0af5b978-43de-4f41-8c8e-a0a728639529", section_key: "coursing", title_en: "Coursing Explained", position: "server", content_en: "At Alamo Prime, all meals follow a traditional coursed dining format. Appetizer Course: cold appetizers fire immediately, hot appetizers follow. Explain the progression to guests. Never overwhelm the table. Entrée Course: fire after appetizers are cleared, all orders at the same time. Side Dishes: delivered alongside the entrée. Dessert Course: only after entrée course is fully cleared and table crumbed." },
  { id: "a6e8e382-6314-40d7-831f-1ff8ad25592c", section_key: "food-delivery-times", title_en: "Food Delivery Times", position: "server", content_en: "Standard delivery times: Appetizers 5-10 minutes, Entrées & Steaks 12-18 minutes depending on temperature and cut, Desserts 4-8 minutes. Keep guests informed if there are any delays." },
  { id: "26224cdf-617a-401b-b0c5-2529cad8b78d", section_key: "prebussing", title_en: "Pre-bussing & Table Maintenance", position: "server", content_en: "Clear plates and utensils between courses. Remove all crumbs. Refill beverages when below half the glass. Dessert prep: clean, crumb, pre-bus before desserts arrive. Bring appropriate dessert utensils. Fold napkins when a guest leaves the table." },
  { id: "f913a7b9-1b75-4f15-a783-e23e31136a68", section_key: "the-check", title_en: "The Check", position: "server", content_en: "Audit your check for accuracy. Place the check in a neutral position. Inform guests you will pick it up when ready. Return change or credit card receipt as soon as possible. Draw attention to the email subscription card. Thank guests by name and invite them to return." },
  { id: "7d96d1ac-477b-47f0-8ef5-65b4f3e970da", section_key: "service-dos-donts", title_en: "Service Do's and Don'ts", position: "server", content_en: "Serve food from the left, remove from the right. Serve beverages from a tray to the right. Never reach across a guest. Serve ladies first. Bottled products label facing the guest. Replacement silverware on linen. Always ask May I remove before clearing." },
  { id: "ef2e2e0a-ce78-475e-b6e8-f0674bda653a", section_key: "situations", title_en: "Situations & Guest Issues", position: "server", content_en: "Wrong Temperature: apologize, remove item, inform kitchen, Chef sends complimentary item within 1-2 minutes, replace cutlery, check back after 2 bites. Late Food: inform FOH and HOH manager, manager sends complimentary appetizer or cocktails. Spills: apologize, assist in cleaning, inform manager. Guest Didn't Like Food: apologize, remove item, offer replacement. Handling Complaints: acknowledge, apologize, act quickly, be positive, communicate with managers, take ownership." },
  { id: "6c48b7f1-df44-4eac-aa27-570f05f91e8a", section_key: "teamwork", title_en: "Being Part of a Team", position: "server", content_en: "Greet all guests, not just those at your tables. Help clear any and all tables. Run food whenever possible. Fulfill all guests' needs. Ask and offer help to all fellow team members. Team service means anyone and everyone helps in all aspects of the restaurant." },
  { id: "80348ec4-a3a7-417e-8456-62f0f5e61295", section_key: "study-guide", title_en: "Study Guide", position: "server", content_en: "Review questions covering prime steakhouse concepts, shift tools, job responsibilities, food allergies, seating procedures, first approach, second approach, service standards, steak temperatures, coursing, delivery times, professional behavior, team service, daily specials, and signature menu items." },
  { id: "0aacac7b-0839-4c0a-8aa8-8d25ef65978f", section_key: "phrases", title_en: "Phrases to Avoid & Use", position: "server", content_en: "Avoid: No we don't do that / I don't know it's my first day / Hi folks y'all guys / You should have / Hold on a second / Can you wait / I don't like wine/bourbon / Really busy having a bad day / The kitchen is backed up. Use Instead: Let me find out for you / My pleasure / Good evening / I highly recommend / Right this way / One moment please / May I place you on hold / I prefer the filet but all selections are wonderful / Fabulous wonderful excellent / May I assist you / I'm just great thank you / I apologize let me get a manager." },
  { id: "9a40dbbf-e053-43d6-9d7e-cc0bd0ed111f", section_key: "glossary", title_en: "Glossary", position: "server", content_en: "Prime: highest USDA beef grade, superior marbling. Marbling: intramuscular fat flecks. Dry-Aged: stored in controlled open-air environment 21-45 days. Wet-Aged: vacuum-sealed in own juices. Filet Mignon: most tender cut from tenderloin. Ribeye: richly marbled from rib section. New York Strip: from short loin, firm texture. Tomahawk: bone-in ribeye with full rib bone. Porterhouse: includes strip and tenderloin. Au Poivre: peppercorn crust with cognac cream. Oscar Style: topped with crab, asparagus, béarnaise. Béarnaise: butter, egg yolks, tarragon sauce. Bourbon: American whiskey from corn, charred oak barrels. Neat: spirit at room temperature, no ice. On the Rocks: spirit over ice." },
];

async function generateEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  console.log(`Generating embeddings for ${SECTIONS.length} SOS sections...`);

  const results = {};
  let count = 0;

  for (const section of SECTIONS) {
    const text = `Title: ${section.title_en}\nPosition: ${section.position}\n\n${section.content_en}`;

    try {
      const embedding = await generateEmbedding(text);
      results[section.id] = embedding;
      count++;
      console.log(`[${count}/${SECTIONS.length}] ${section.section_key} (${embedding.length}d)`);

      // Small delay between calls
      if (count < SECTIONS.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error(`FAILED: ${section.section_key} — ${err.message}`);
    }
  }

  // Save to JSON file
  const outPath = path.join(__dirname, '.sos-embeddings.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 0));
  console.log(`\nSaved ${count} embeddings to ${outPath}`);
  console.log('File size:', (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
}

main();
