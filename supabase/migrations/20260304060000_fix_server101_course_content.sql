-- =============================================================================
-- Migration: Fix Server 101 course content gaps
-- Date: 2026-03-04
-- Description: Insert missing product records (foh_plate_specs, wines, cocktails,
--              beer_liquor_list) and update course_sections content_ids/content_source
--              to match actual DB UUIDs for all Server 101 courses.
-- =============================================================================

-- Admin user: dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4

-- =============================================================================
-- SECTION A: INSERT 6 missing foh_plate_specs rows
-- =============================================================================

-- 1. 12 oz New York Strip
INSERT INTO foh_plate_specs (
  id, slug, menu_name, plate_type, status, version,
  short_description, detailed_description,
  ingredients, key_ingredients, flavor_profile,
  allergens, allergy_notes, upsell_notes,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100001-0000-4000-8000-000000000001',
  '12-oz-new-york-strip',
  '12 oz New York Strip',
  'entree',
  'published',
  1,
  'A bold, beefy 12oz New York Strip with a satisfying chew and deep character from edge-to-edge marbling.',
  'The New York Strip is the choice for guests who want maximum beefy flavor with a satisfying chew. Cut from the short loin, our 12oz Strip offers rich marbling without excess fat — tight-grained on one side, well-marbled on the other. Seared at high heat to build a caramelized crust, then rested to lock in the juices. Finished with house compound butter and served with the guest''s choice of two sides.',
  ARRAY['12oz USDA Choice New York Strip', 'Kosher salt', 'Cracked black pepper', 'Clarified butter', 'Compound butter'],
  ARRAY['New York Strip', 'Compound butter'],
  ARRAY['Beefy', 'Bold', 'Rich', 'Mineral'],
  ARRAY['Dairy'],
  'Contains dairy (compound butter). Can be served without butter upon request.',
  'Best for guests who want deep steak flavor over pure tenderness. Pair with Caymus or Josh Cellars Cab. Recommend Truffle Mashed Potatoes or Creamed Spinach as sides.',
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 2. 20 oz Bone-In Cowboy Cut
INSERT INTO foh_plate_specs (
  id, slug, menu_name, plate_type, status, version,
  short_description, detailed_description,
  ingredients, key_ingredients, flavor_profile,
  allergens, allergy_notes, upsell_notes,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100002-0000-4000-8000-000000000001',
  '20-oz-bone-in-cowboy-cut',
  '20 oz Bone-In Cowboy Cut',
  'entree',
  'published',
  1,
  'Our showpiece steak — a massive bone-in ribeye with extraordinary marbling and a bold, buttery finish.',
  'The Cowboy Cut is the most dramatic steak on the menu. This 20oz bone-in ribeye carries all the bold flavor and intense marbling of our signature ribeye, with the added theater of bone-in presentation. The bone conducts heat during the cook, basting the meat from within for unmatched juiciness. Aged 28 days, hand-trimmed, and finished with clarified butter and fresh herbs. Reserved for guests who want to make a statement at the table.',
  ARRAY['20oz Bone-In USDA Prime Ribeye', 'Clarified butter', 'Fresh thyme', 'Fresh rosemary', 'Garlic', 'Kosher salt', 'Cracked black pepper'],
  ARRAY['Bone-In Ribeye', 'Herb butter'],
  ARRAY['Bold', 'Buttery', 'Rich', 'Smoky', 'Intense'],
  ARRAY['Dairy'],
  'Contains dairy (butter). Can be served without butter upon request.',
  'The ultimate celebration steak. Pair with Caymus Cab or Silver Oak Alexander Valley. Add Truffle Mashed Potatoes and Creamed Spinach. Table-side presentation makes a strong impression.',
  false,
  true,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 3. 6 oz Petite Filet
INSERT INTO foh_plate_specs (
  id, slug, menu_name, plate_type, status, version,
  short_description, detailed_description,
  ingredients, key_ingredients, flavor_profile,
  allergens, allergy_notes, upsell_notes,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100003-0000-4000-8000-000000000001',
  '6-oz-petite-filet',
  '6 oz Petite Filet',
  'entree',
  'published',
  1,
  'A fork-tender 6oz filet for guests who prefer a lighter portion without sacrificing tenderness.',
  'The Petite Filet delivers all the melt-in-your-mouth tenderness of our signature 8oz Filet Mignon in a lighter 6oz portion. Cut from the heart of the beef tenderloin — the most tender muscle on the animal — it has minimal connective tissue, producing a silky, custard-like texture at proper temperature. Finished with herb butter and served with the guest''s choice of two sides. Ideal for lighter appetites or guests who want to save room for dessert.',
  ARRAY['6oz USDA Prime Filet Mignon', 'Herb butter', 'Kosher salt', 'Cracked black pepper'],
  ARRAY['Filet Mignon', 'Herb butter'],
  ARRAY['Delicate', 'Buttery', 'Mild', 'Silky', 'Tender'],
  ARRAY['Dairy'],
  'Contains dairy (herb butter). Can be served without butter upon request.',
  'Great for lighter eaters. Suggest Classic Shrimp Cocktail as a starter. Light wines like Cloudy Bay or Miraval Rosé pair beautifully. Mention sharing a Chocolate Lava Cake.',
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 4. Creamed Spinach (FOH)
INSERT INTO foh_plate_specs (
  id, slug, menu_name, plate_type, status, version,
  short_description, detailed_description,
  ingredients, key_ingredients, flavor_profile,
  allergens, allergy_notes, upsell_notes,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100004-0000-4000-8000-000000000001',
  'creamed-spinach-foh',
  'Creamed Spinach',
  'side',
  'published',
  1,
  'Classic steakhouse creamed spinach — rich and velvety with roasted garlic, Parmesan, and fresh nutmeg.',
  'A steakhouse essential done properly. Fresh baby spinach wilted in a rich béchamel base, fortified with roasted garlic, aged Parmesan, and finished with freshly grated nutmeg. Made in-house daily, the sauce is thick enough to stand up alongside a Cowboy Cut but smooth enough to complement the softest Filet. Served piping hot in a ramekin. Vegetarian.',
  ARRAY['Baby spinach', 'Béchamel sauce', 'Roasted garlic', 'Parmesan', 'Nutmeg', 'Butter', 'Heavy cream'],
  ARRAY['Baby spinach', 'Béchamel', 'Parmesan', 'Roasted garlic'],
  ARRAY['Savory', 'Rich', 'Creamy', 'Herby', 'Umami'],
  ARRAY['Dairy', 'Gluten'],
  'Contains dairy and gluten (béchamel). Not vegan. Vegetarian-friendly.',
  'Highest-attachment side on the menu. Goes with every steak, especially the Cowboy Cut and Filet. Mention it''s made in-house daily.',
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 5. Chocolate Lava Cake
INSERT INTO foh_plate_specs (
  id, slug, menu_name, plate_type, status, version,
  short_description, detailed_description,
  ingredients, key_ingredients, flavor_profile,
  allergens, allergy_notes, upsell_notes,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  'e595c67b-d3ac-4514-b21a-dc2769ce8a40',
  'chocolate-lava-cake',
  'Chocolate Lava Cake',
  'dessert',
  'published',
  1,
  'A warm dark chocolate cake with a molten center, served with house-made vanilla bean ice cream.',
  'Our signature dessert and the table''s last impression. A rich dark chocolate cake baked fresh to order with a liquid molten center that flows when you break through the crust. Made with 72% Valrhona dark chocolate and finished with powdered sugar, raspberry coulis, and a scoop of house-made vanilla bean ice cream. The interplay of warm bittersweet chocolate and cold sweet vanilla is the perfect close to any steak dinner. Allow 10–12 minutes — mention it early.',
  ARRAY['72% Valrhona dark chocolate', 'Butter', 'Eggs', 'Sugar', 'All-purpose flour', 'Vanilla bean ice cream', 'Raspberry coulis'],
  ARRAY['Valrhona dark chocolate', 'Vanilla bean ice cream'],
  ARRAY['Decadent', 'Rich', 'Bittersweet', 'Warm', 'Indulgent'],
  ARRAY['Dairy', 'Gluten', 'Eggs'],
  'Contains dairy, gluten, and eggs. Not suitable for guests with egg, gluten, or dairy allergies.',
  'Sell it early — mention it when presenting the menu, not at the end. ''We make it fresh to order, takes about 12 minutes — worth every second.'' Pairs with espresso, Hennessy VSOP, or Kahlúa.',
  true,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 6. Pecan Pie
INSERT INTO foh_plate_specs (
  id, slug, menu_name, plate_type, status, version,
  short_description, detailed_description,
  ingredients, key_ingredients, flavor_profile,
  allergens, allergy_notes, upsell_notes,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  'de01aa31-89e1-4c60-82c5-30ef623b6f5c',
  'pecan-pie',
  'Pecan Pie',
  'dessert',
  'published',
  1,
  'A classic Texas pecan pie — buttery flaky crust, caramel-sweet filling, and roasted Texas pecans.',
  'A Texas staple executed with care. Our pecan pie uses a hand-crimped, all-butter shortcrust pastry filled with a deeply caramelized mixture of dark brown sugar, cane syrup, and roasted Texas pecans. Served warm with your choice of whipped cream or vanilla ice cream. Rich, sweet, and unmistakably Southern — the kind of finish that rounds out the table and invites one last round of drinks.',
  ARRAY['Texas pecans', 'Dark brown sugar', 'Cane syrup', 'Butter', 'Eggs', 'All-butter pastry crust', 'Vanilla extract'],
  ARRAY['Texas pecans', 'Brown sugar', 'Butter pastry'],
  ARRAY['Sweet', 'Caramel', 'Buttery', 'Nutty', 'Warm'],
  ARRAY['Dairy', 'Gluten', 'Eggs', 'Tree Nuts'],
  'Contains dairy, gluten, eggs, and tree nuts (pecans). Not suitable for guests with nut allergies.',
  'Lead with ''Texas pecans, made in-house.'' Guests from Texas respond strongly. Great with Woodford Reserve on the rocks. Suggest warm with ice cream (+$2).',
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- =============================================================================
-- SECTION B: INSERT 2 missing wines
-- =============================================================================

-- 1. Erath Pinot Noir
INSERT INTO wines (
  id, slug, name, producer, region, country,
  vintage, varietal, blend, style, body,
  tasting_notes, producer_notes,
  status, version,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '9149cc7b-2f81-47a8-8d79-4344ad294f32',
  'erath-pinot-noir',
  'Erath Pinot Noir',
  'Erath Winery',
  'Willamette Valley',
  'USA',
  '2022',
  'Pinot Noir',
  false,
  'red',
  'medium-light',
  'Bright cherry and strawberry on the nose with earthy undertones of dried herbs and forest floor. On the palate: medium acidity, silky tannins, and a clean, lingering finish. An approachable, food-friendly Oregon Pinot Noir — a great gateway bottle for guests exploring reds.',
  'Erath is one of Oregon''s pioneering wineries, established in the Willamette Valley in 1967. Their Pinot Noir is an accessible introduction to the elegance of Oregon red wine.',
  'published',
  1,
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 2. Château Margaux 2018
INSERT INTO wines (
  id, slug, name, producer, region, country,
  vintage, varietal, blend, style, body,
  tasting_notes, producer_notes,
  status, version,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '76caab11-af5a-4694-8045-e27fce4792b7',
  'chateau-margaux-2018',
  'Château Margaux 2018',
  'Château Margaux',
  'Margaux, Bordeaux',
  'France',
  '2018',
  'Cabernet Sauvignon',
  true,
  'red',
  'full',
  'One of Bordeaux''s most celebrated estates. Deep blackcurrant, plum, and cassis layered with cedar, violets, and graphite minerality. Exceptionally structured tannins — dense but approachable — with a finish that persists for minutes. The 2018 vintage is widely regarded as one of the finest in recent Margaux memory.',
  'First Growth (Premier Grand Cru Classé), Margaux AOC. One of only five First Growths in Bordeaux. The estate dates to the 12th century. The 2018 vintage benefited from an ideal growing season — considered exceptional for the appellation.',
  'published',
  1,
  false,
  true,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- =============================================================================
-- SECTION C: INSERT 2 missing cocktails
-- =============================================================================

-- 1. Paloma
INSERT INTO cocktails (
  id, slug, name, style, glass, status, version,
  key_ingredients, procedure, tasting_notes, description,
  ingredients,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  '218a3ccc-d7ac-4be5-8a77-320bf41e2bec',
  'paloma',
  'Paloma',
  'refreshing',
  'Highball',
  'published',
  1,
  'Blanco tequila, fresh grapefruit juice, lime juice, agave nectar, Topo Chico, salted rim',
  '[{"step":1,"action":"Salt-rim a highball glass"},{"step":2,"action":"Fill glass with fresh ice"},{"step":3,"action":"Add 2oz Casamigos Blanco, 1oz fresh grapefruit juice, 0.5oz fresh lime juice, 0.5oz agave nectar"},{"step":4,"action":"Top with Topo Chico sparkling water"},{"step":5,"action":"Stir gently once to combine"},{"step":6,"action":"Garnish with a grapefruit wedge"}]'::jsonb,
  'Bright and citrusy with a grapefruit-forward flavor, tart lime backbone, and a clean tequila finish. The salted rim adds a savory contrast. Light, refreshing, and dangerously easy to drink.',
  'Mexico''s most-loved cocktail and one of the best aperitifs on the menu. The Paloma pairs blanco tequila with fresh grapefruit and Topo Chico — crispier and less sweet than a Margarita. Perfect for guests who find most cocktails too sweet.',
  '[{"name":"Casamigos Blanco","amount":"2 oz"},{"name":"Fresh grapefruit juice","amount":"1 oz"},{"name":"Fresh lime juice","amount":"0.5 oz"},{"name":"Agave nectar","amount":"0.5 oz"},{"name":"Topo Chico","amount":"Top"},{"name":"Kosher salt (rim)","amount":""}]'::jsonb,
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 2. Mai Tai
INSERT INTO cocktails (
  id, slug, name, style, glass, status, version,
  key_ingredients, procedure, tasting_notes, description,
  ingredients,
  is_top_seller, is_featured,
  created_by, created_at, updated_at
) VALUES (
  'e8e60426-a5b9-4e52-aacc-578f984a57a6',
  'mai-tai',
  'Mai Tai',
  'tropical',
  'Rocks',
  'published',
  1,
  'Light rum, Appleton Estate float, orange curaçao, orgeat, fresh lime juice',
  '[{"step":1,"action":"Combine Bacardi Light, Cointreau, orgeat, and lime juice in a shaker with ice"},{"step":2,"action":"Shake vigorously 12-15 seconds"},{"step":3,"action":"Strain over fresh ice in a rocks glass"},{"step":4,"action":"Float Appleton Estate rum on top"},{"step":5,"action":"Garnish with a mint sprig and lime wheel"}]'::jsonb,
  'Tropical, balanced, and layered. Bright lime and orange citrus up front, sweet almond from the orgeat in the middle, and a warm, complex rum finish from the Appleton Estate float. More sophisticated than it looks.',
  'A Trader Vic original from 1944. Two rums, fresh lime, and orgeat — a tropical cocktail that''s become a modern classic. The Appleton Estate float creates a layered visual and a more complex sip as you work through the glass. A conversation starter and a strong upsell for guests celebrating.',
  '[{"name":"Bacardi Light","amount":"1.5 oz"},{"name":"Appleton Estate (float)","amount":"0.5 oz"},{"name":"Cointreau","amount":"0.5 oz"},{"name":"Orgeat syrup","amount":"0.5 oz"},{"name":"Fresh lime juice","amount":"0.75 oz"}]'::jsonb,
  false,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- =============================================================================
-- SECTION D: INSERT 3 Texas & Regional Beers
-- =============================================================================

-- 1. Shiner Bock
INSERT INTO beer_liquor_list (
  id, slug, name, category, subcategory, producer, country,
  description, style, status, version,
  is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100005-0000-4000-8000-000000000001',
  'shiner-bock',
  'Shiner Bock',
  'Beer',
  'Bock',
  'Spoetzl Brewery',
  'USA',
  'Texas''s most iconic craft beer. A dark amber bock with roasted malt sweetness, smooth medium body, and a clean, dry finish. Brewed in Shiner, Texas since 1909 — the original Texas craft beer and a point of local pride for guests from the state.',
  'Bock',
  'published',
  1,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 2. Lone Star Beer
INSERT INTO beer_liquor_list (
  id, slug, name, category, subcategory, producer, country,
  description, style, status, version,
  is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100006-0000-4000-8000-000000000001',
  'lone-star-beer',
  'Lone Star Beer',
  'Beer',
  'Lager',
  'Lone Star Brewing Company',
  'USA',
  'The National Beer of Texas. A crisp, light-bodied American lager with clean malt flavor and a dry finish. Brewed in Texas since 1884 — an institution at backyard BBQs and steakhouse bars across the state.',
  'American Lager',
  'published',
  1,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- 3. Saint Arnold Fancy Lawnmower
INSERT INTO beer_liquor_list (
  id, slug, name, category, subcategory, producer, country,
  description, style, status, version,
  is_featured,
  created_by, created_at, updated_at
) VALUES (
  '11100007-0000-4000-8000-000000000001',
  'saint-arnold-fancy-lawnmower',
  'Saint Arnold Fancy Lawnmower',
  'Beer',
  'Kölsch',
  'Saint Arnold Brewing Company',
  'USA',
  'Houston''s flagship craft beer from Texas''s oldest craft brewery (est. 1994). A German-style Kölsch — crisp, dry, and effervescent with a subtle hop character and a clean malt backbone. Light enough for a long dinner, interesting enough for the craft beer enthusiast.',
  'Kölsch',
  'published',
  1,
  false,
  'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4',
  now(),
  now()
);

-- =============================================================================
-- SECTION E: UPDATE course_sections — fix all content_ids and content_source
-- =============================================================================

-- Helper subquery for server-101 course IDs
-- course_id IN (SELECT c.id FROM courses c JOIN training_programs p ON c.program_id = p.id WHERE p.slug = 'server-101')

-- --- Entrees & Steaks ---

-- Fix [null] content_ids on 14oz Bone-In Ribeye
UPDATE course_sections
SET content_ids = ARRAY['bdafcf2a-68b6-439c-8195-7bcf4883ada4']::uuid[]
WHERE title_en = '14oz Bone-In Ribeye'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Fix [null] content_ids on 8oz Filet Mignon
UPDATE course_sections
SET content_ids = ARRAY['77e35304-9a88-4c8f-a72e-972565c610e9']::uuid[]
WHERE title_en = '8oz Filet Mignon'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Switch 12oz New York Strip to foh_plate_specs
UPDATE course_sections
SET content_source = 'foh_plate_specs',
    content_ids = ARRAY['11100001-0000-4000-8000-000000000001']::uuid[]
WHERE title_en = '12oz New York Strip'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Switch 20oz Bone-In Cowboy Cut to foh_plate_specs
UPDATE course_sections
SET content_source = 'foh_plate_specs',
    content_ids = ARRAY['11100002-0000-4000-8000-000000000001']::uuid[]
WHERE title_en = '20oz Bone-In Cowboy Cut'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Switch 6oz Petite Filet to foh_plate_specs
UPDATE course_sections
SET content_source = 'foh_plate_specs',
    content_ids = ARRAY['11100003-0000-4000-8000-000000000001']::uuid[]
WHERE title_en = '6oz Petite Filet'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- --- Appetizers & Sides ---

-- Fix [null] content_ids for Classic Shrimp Cocktail
UPDATE course_sections
SET content_ids = ARRAY['037bc67b-8e5d-46e8-bde1-86dadb307923']::uuid[]
WHERE title_en = 'Classic Shrimp Cocktail'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Switch Iceberg Wedge Salad to foh_plate_specs
UPDATE course_sections
SET content_source = 'foh_plate_specs',
    content_ids = ARRAY['5589a035-727b-4b15-bbdf-9d97728e82a1']::uuid[]
WHERE title_en = 'Iceberg Wedge Salad'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Switch Seared Steak Bites to foh_plate_specs
UPDATE course_sections
SET content_source = 'foh_plate_specs',
    content_ids = ARRAY['b233e4ca-30aa-4982-a3d1-1ddeb93290a5']::uuid[]
WHERE title_en = 'Seared Steak Bites'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Switch Truffle Mashed Potatoes to foh_plate_specs
UPDATE course_sections
SET content_source = 'foh_plate_specs',
    content_ids = ARRAY['6641dcfc-15f0-46e6-9def-9221e85fd3cc']::uuid[]
WHERE title_en = 'Truffle Mashed Potatoes'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Fix [null] Creamed Spinach with new UUID
UPDATE course_sections
SET content_ids = ARRAY['11100004-0000-4000-8000-000000000001']::uuid[]
WHERE title_en = 'Creamed Spinach'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- --- Wine Program ---

-- Update Veuve Clicquot to actual DB UUID
UPDATE course_sections
SET content_ids = ARRAY['ad8bd3bb-2d16-4551-9a18-01a4a8b7acc3']::uuid[]
WHERE title_en = 'Veuve Clicquot Yellow Label Brut'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Update Cloudy Bay to actual DB UUID
UPDATE course_sections
SET content_ids = ARRAY['55e3a1aa-9a84-4fcb-aeec-eb9e6950a112']::uuid[]
WHERE title_en = 'Cloudy Bay Sauvignon Blanc'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Update Whispering Angel to actual DB UUID
UPDATE course_sections
SET content_ids = ARRAY['a669c1e2-660e-4f40-92bc-071fda00352a']::uuid[]
WHERE title_en = 'Whispering Angel Rosé'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Erath Pinot Noir UUID already correct in course_sections (set earlier by seed)
-- but ensure it matches the newly inserted record
UPDATE course_sections
SET content_ids = ARRAY['9149cc7b-2f81-47a8-8d79-4344ad294f32']::uuid[]
WHERE title_en = 'Erath Pinot Noir'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Château Margaux UUID already correct in course_sections (set earlier by seed)
-- but ensure it matches the newly inserted record
UPDATE course_sections
SET content_ids = ARRAY['76caab11-af5a-4694-8045-e27fce4792b7']::uuid[]
WHERE title_en = 'Château Margaux 2018'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- --- Cocktails & Bar ---

-- Update Old Fashioned to actual DB UUID
UPDATE course_sections
SET content_ids = ARRAY['8077d585-7253-4261-b450-de64917e9fc1']::uuid[]
WHERE title_en = 'Old Fashioned'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Update Espresso Martini to actual DB UUID
UPDATE course_sections
SET content_ids = ARRAY['9835659f-4a28-43dd-9654-0cbd4e3ffe0d']::uuid[]
WHERE title_en = 'Espresso Martini'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Paloma UUID already correct (matches newly inserted record)
UPDATE course_sections
SET content_ids = ARRAY['218a3ccc-d7ac-4be5-8a77-320bf41e2bec']::uuid[]
WHERE title_en = 'Paloma'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Update Penicillin to actual DB UUID
UPDATE course_sections
SET content_ids = ARRAY['7916744e-a569-498a-bddf-f9276bda09dd']::uuid[]
WHERE title_en = 'Penicillin'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Mai Tai UUID already correct (matches newly inserted record)
UPDATE course_sections
SET content_ids = ARRAY['e8e60426-a5b9-4e52-aacc-578f984a57a6']::uuid[]
WHERE title_en = 'Mai Tai'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- --- Beer & Liquor ---

-- Texas & Regional Beers — link to 3 new Texas beer UUIDs
UPDATE course_sections
SET content_ids = ARRAY[
  '11100005-0000-4000-8000-000000000001',
  '11100006-0000-4000-8000-000000000001',
  '11100007-0000-4000-8000-000000000001'
]::uuid[]
WHERE title_en = 'Texas & Regional Beers'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Craft & Specialty Beers — link to 4 existing craft beer records
-- Dogfish Head 60 Minute IPA: 87dc8fcc-4bda-4c94-ae32-62b04d942684
-- Blue Moon: 336b8f92-050b-4f11-b0a1-9220d12a0104
-- Guinness Draught: 5569a929-97e2-43a8-9ac5-2c96ff110b4c
-- Sierra Nevada Pale Ale: 69dec3e4-a62e-4e12-80a3-ead2f9baf1ba
UPDATE course_sections
SET content_ids = ARRAY[
  '87dc8fcc-4bda-4c94-ae32-62b04d942684',
  '336b8f92-050b-4f11-b0a1-9220d12a0104',
  '5569a929-97e2-43a8-9ac5-2c96ff110b4c',
  '69dec3e4-a62e-4e12-80a3-ead2f9baf1ba'
]::uuid[]
WHERE title_en = 'Craft & Specialty Beers'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );

-- Premium Spirits Collection — link to 6 existing spirit records
-- Grey Goose: b8ee7037-438d-4337-b2e2-7d6e92c8e38c
-- Don Julio Reposado: 86dd8a87-2266-4a99-8306-4eeedffa86b1
-- The Macallan 12 Year Old: 91190452-176e-42e3-ba7a-4316863c80fa
-- Hennessy VS: 1ff017b0-e77a-4d2a-97f8-8891f6d8d15a
-- Woodford Reserve: 34a058a2-5b7f-41f9-94a5-f24f220caa70
-- WhistlePig 10 Year: 43b97186-2f66-4a2e-a4f1-8a17d29c32e0
UPDATE course_sections
SET content_ids = ARRAY[
  'b8ee7037-438d-4337-b2e2-7d6e92c8e38c',
  '86dd8a87-2266-4a99-8306-4eeedffa86b1',
  '91190452-176e-42e3-ba7a-4316863c80fa',
  '1ff017b0-e77a-4d2a-97f8-8891f6d8d15a',
  '34a058a2-5b7f-41f9-94a5-f24f220caa70',
  '43b97186-2f66-4a2e-a4f1-8a17d29c32e0'
]::uuid[]
WHERE title_en = 'Premium Spirits Collection'
  AND course_id IN (
    SELECT c.id FROM courses c
    JOIN training_programs p ON c.program_id = p.id
    WHERE p.slug = 'server-101'
  );
