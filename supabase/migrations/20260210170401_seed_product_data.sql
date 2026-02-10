-- =============================================================================
-- MIGRATION: seed_product_data
-- Inserts all mock data into 6 product tables (44 rows total)
-- Phase 2 of Product AI System
-- =============================================================================

DO $$
DECLARE
  admin_uid UUID := 'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4';
BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: prep_recipes (4 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO prep_recipes (slug, name, prep_type, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, tags, images, ingredients, procedure, batch_scaling, training_notes, created_by)
VALUES
(
  'red-wine-demi-glace',
  'Red Wine Demi-Glace',
  'sauce',
  1.5, 'qt',
  7, 'days',
  ARRAY['signature', 'mother sauce', 'slow cook'],
  '["https://picsum.photos/seed/demi-glace/400/300"]'::jsonb,
  '[{"group_name":"Base","order":1,"items":[{"name":"Veal Stock","quantity":2,"unit":"qt","prep_note":null,"allergens":[]},{"name":"Dry red wine (Cabernet)","quantity":750,"unit":"ml","prep_note":null,"allergens":[]},{"name":"Mirepoix, fine dice","quantity":1,"unit":"cup","prep_note":null,"allergens":[]},{"name":"Tomato paste","quantity":2,"unit":"tbsp","prep_note":null,"allergens":[]}]},{"group_name":"Finish","order":2,"items":[{"name":"Unsalted butter, cold","quantity":2,"unit":"tbsp","prep_note":null,"allergens":["dairy"]},{"name":"Fresh thyme leaves","quantity":1,"unit":"tsp","prep_note":null,"allergens":[]},{"name":"Kosher salt & black pepper","quantity":null,"unit":"to taste","prep_note":null,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Reduction","order":1,"steps":[{"step_number":1,"instruction":"Sweat mirepoix in heavy-bottom saucepan over medium heat until translucent (5-6 min).","critical":false},{"step_number":2,"instruction":"Add tomato paste, cook stirring 2 min until darkened slightly.","critical":false},{"step_number":3,"instruction":"Deglaze with red wine. Reduce by half over medium-high (15-20 min).","critical":false},{"step_number":4,"instruction":"Add veal stock. Simmer and reduce by half (45-60 min), skimming impurities.","critical":false}]},{"group_name":"Finish & Store","order":2,"steps":[{"step_number":1,"instruction":"Strain through fine-mesh sieve, pressing solids. Discard solids.","critical":false},{"step_number":2,"instruction":"Return to clean pan — sauce should coat a spoon (nappe consistency).","critical":true},{"step_number":3,"instruction":"Off heat: monte au beurre — whisk in cold butter one piece at a time.","critical":false},{"step_number":4,"instruction":"Season with salt, pepper, thyme. Cool rapidly in ice bath.","critical":true},{"step_number":5,"instruction":"Transfer to labeled deli containers. Date and refrigerate.","critical":false}]}]'::jsonb,
  '{"scalable":true,"base_yield":{"quantity":1.5,"unit":"qt"},"scaling_method":"linear","exceptions":[],"notes":"Scales linearly. Double batch: use wider pot to maintain reduction speed. +20 min total."}'::jsonb,
  '{"common_mistakes":[],"quality_checks":["Nappe = sauce coats and clings to a spoon without dripping immediately."],"notes":"Too thin -> reduce further. Too thick -> thin with stock."}'::jsonb,
  admin_uid
),
(
  'chimichurri',
  'Chimichurri',
  'sauce',
  3, 'cups',
  5, 'days',
  ARRAY['signature', 'raw', 'Argentine'],
  '["https://picsum.photos/seed/chimichurri/400/300"]'::jsonb,
  '[{"group_name":"Herbs & Aromatics","order":1,"items":[{"name":"Flat-leaf parsley, packed, fine chop","quantity":2,"unit":"cups","prep_note":null,"allergens":[]},{"name":"Fresh oregano leaves, fine chop","quantity":0.5,"unit":"cup","prep_note":null,"allergens":[]},{"name":"Garlic, minced","quantity":6,"unit":"cloves","prep_note":null,"allergens":[]},{"name":"Shallot, minced fine","quantity":1,"unit":"pc","prep_note":null,"allergens":[]},{"name":"Red pepper flakes","quantity":1,"unit":"tsp","prep_note":null,"allergens":[]}]},{"group_name":"Liquid","order":2,"items":[{"name":"Extra virgin olive oil","quantity":0.75,"unit":"cup","prep_note":null,"allergens":[]},{"name":"Red wine vinegar","quantity":0.25,"unit":"cup","prep_note":null,"allergens":[]},{"name":"Fresh lemon juice","quantity":2,"unit":"tbsp","prep_note":null,"allergens":[]},{"name":"Kosher salt & black pepper","quantity":null,"unit":"to taste","prep_note":null,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Preparation","order":1,"steps":[{"step_number":1,"instruction":"Combine chopped herbs, garlic, shallot, and red pepper flakes in mixing bowl.","critical":false},{"step_number":2,"instruction":"Add olive oil, vinegar, and lemon juice. Stir to combine.","critical":false},{"step_number":3,"instruction":"Season with salt and pepper. Adjust acid/oil balance.","critical":false},{"step_number":4,"instruction":"Rest at room temp 30 min for flavors to meld.","critical":false},{"step_number":5,"instruction":"Transfer to labeled squeeze bottles or deli containers. Date and refrigerate.","critical":true}]}]'::jsonb,
  '{"scalable":true,"base_yield":{"quantity":3,"unit":"cups"},"scaling_method":"linear","exceptions":[],"notes":"No special scaling considerations."}'::jsonb,
  '{"common_mistakes":["Using food processor — destroys texture"],"quality_checks":["Bright green with visible herb texture","Loose and pourable, not paste-like"],"notes":"Hand-chop only."}'::jsonb,
  admin_uid
),
(
  'herb-compound-butter',
  'Herb Compound Butter',
  'compound-butter',
  2, 'lbs',
  10, 'days',
  ARRAY['finishing', 'grill station'],
  '["https://picsum.photos/seed/herb-butter/400/300"]'::jsonb,
  '[{"group_name":"Ingredients","order":1,"items":[{"name":"Unsalted butter, room temp","quantity":2,"unit":"lbs","prep_note":null,"allergens":["dairy"]},{"name":"Flat-leaf parsley, fine chop","quantity":3,"unit":"tbsp","prep_note":null,"allergens":[]},{"name":"Fresh chives, minced","quantity":2,"unit":"tbsp","prep_note":null,"allergens":[]},{"name":"Fresh thyme leaves","quantity":1,"unit":"tbsp","prep_note":null,"allergens":[]},{"name":"Roasted garlic paste","quantity":2,"unit":"tsp","prep_note":null,"allergens":[]},{"name":"Flaky sea salt","quantity":1,"unit":"tsp","prep_note":null,"allergens":[]},{"name":"Black pepper, freshly cracked","quantity":0.5,"unit":"tsp","prep_note":null,"allergens":[]},{"name":"Lemon zest","quantity":1,"unit":"tsp","prep_note":null,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Mixing","order":1,"steps":[{"step_number":1,"instruction":"Butter must be room temp — soft but not melted.","critical":true},{"step_number":2,"instruction":"Combine all herbs, garlic paste, salt, pepper, lemon zest in a bowl.","critical":false},{"step_number":3,"instruction":"Fold herb mixture into butter with rubber spatula until evenly distributed.","critical":false}]},{"group_name":"Forming & Storage","order":2,"steps":[{"step_number":1,"instruction":"Spoon butter onto plastic wrap in a rough log shape.","critical":false},{"step_number":2,"instruction":"Roll tightly into ~2\" diameter cylinder. Twist ends to seal.","critical":false},{"step_number":3,"instruction":"Refrigerate until firm (2+ hrs). Slice into 1/2 oz medallions for service.","critical":false},{"step_number":4,"instruction":"Label with date. Store wrapped logs in walk-in.","critical":false}]}]'::jsonb,
  '{"scalable":true,"base_yield":{"quantity":2,"unit":"lbs"},"scaling_method":"linear","exceptions":[],"notes":"Doubles easily. Use stand mixer with paddle for batches over 4 lbs."}'::jsonb,
  '{"common_mistakes":[],"quality_checks":[],"notes":""}'::jsonb,
  admin_uid
),
(
  'creamed-spinach',
  'Creamed Spinach',
  'base',
  8, 'portions',
  3, 'days',
  ARRAY['classic', 'side station'],
  '["https://picsum.photos/seed/creamed-spinach/400/300"]'::jsonb,
  '[{"group_name":"Spinach","order":1,"items":[{"name":"Baby spinach, washed","quantity":2,"unit":"lbs","prep_note":null,"allergens":[]},{"name":"Olive oil","quantity":1,"unit":"tbsp","prep_note":null,"allergens":[]},{"name":"Garlic, sliced thin","quantity":3,"unit":"cloves","prep_note":null,"allergens":[]}]},{"group_name":"Cream Base","order":2,"items":[{"name":"Unsalted butter","quantity":2,"unit":"tbsp","prep_note":null,"allergens":["dairy"]},{"name":"All-purpose flour","quantity":2,"unit":"tbsp","prep_note":null,"allergens":["gluten"]},{"name":"Heavy cream","quantity":1.5,"unit":"cups","prep_note":null,"allergens":["dairy"]},{"name":"Parmesan, finely grated","quantity":0.25,"unit":"cup","prep_note":null,"allergens":["dairy"]},{"name":"Nutmeg, freshly grated","quantity":0.25,"unit":"tsp","prep_note":null,"allergens":[]},{"name":"Kosher salt & white pepper","quantity":null,"unit":"to taste","prep_note":null,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Wilt Spinach","order":1,"steps":[{"step_number":1,"instruction":"Heat olive oil in large sauté pan over high heat.","critical":false},{"step_number":2,"instruction":"Add garlic, cook 30 sec until fragrant — do not brown.","critical":false},{"step_number":3,"instruction":"Add spinach in batches, toss until just wilted. Transfer to colander.","critical":false},{"step_number":4,"instruction":"Press out excess liquid thoroughly. Rough chop and set aside.","critical":true}]},{"group_name":"Cream Sauce & Combine","order":2,"steps":[{"step_number":1,"instruction":"Melt butter in saucepan over medium heat. Add flour, whisk 1 min (blonde roux).","critical":false},{"step_number":2,"instruction":"Slowly stream in cream while whisking. Cook until thickened (3-4 min).","critical":false},{"step_number":3,"instruction":"Stir in Parmesan and nutmeg. Season with salt and white pepper.","critical":false},{"step_number":4,"instruction":"Fold in chopped spinach. Should coat leaves without being soupy.","critical":false},{"step_number":5,"instruction":"Hold at 140°F+ for service or cool rapidly for storage.","critical":true}]}]'::jsonb,
  '{"scalable":true,"base_yield":{"quantity":8,"unit":"portions"},"scaling_method":"linear","exceptions":[],"notes":"No special scaling considerations."}'::jsonb,
  '{"common_mistakes":["Not pressing water from spinach"],"quality_checks":["Roux should be thick enough to coat the leaves"],"notes":"Press ALL water from spinach."}'::jsonb,
  admin_uid
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: plate_specs (3 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO plate_specs (slug, name, plate_type, menu_category, allergens, tags, images, components, assembly_procedure, notes, created_by)
VALUES
(
  'bone-in-ribeye',
  '16oz Bone-In Ribeye',
  'entree', 'entree',
  ARRAY['dairy'],
  ARRAY['signature', 'grill', 'premium'],
  '["https://picsum.photos/seed/ribeye-steak/400/300"]'::jsonb,
  '[{"group_name":"Grill","order":1,"items":[{"type":"raw","name":"Bone-in ribeye, 1.5\" thick","quantity":16,"unit":"oz","order":1,"allergens":[]},{"type":"prep_recipe","name":"Herb Compound Butter","prep_recipe_ref":"herb-compound-butter","quantity":1,"unit":"pc","order":2}]},{"group_name":"Plate","order":2,"items":[{"type":"prep_recipe","name":"Red Wine Demi-Glace","prep_recipe_ref":"red-wine-demi-glace","quantity":3,"unit":"oz","order":1},{"type":"prep_recipe","name":"Creamed Spinach","prep_recipe_ref":"creamed-spinach","quantity":1,"unit":"ptn","order":2},{"type":"raw","name":"Fingerling potatoes, roasted","quantity":5,"unit":"oz","order":3,"allergens":[]},{"type":"raw","name":"Fresh rosemary garnish","quantity":1,"unit":"sprig","order":4,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Grill","order":1,"steps":[{"step_number":1,"instruction":"Temper steak 30-45 min before grilling. Season generously with salt and pepper.","critical":false},{"step_number":2,"instruction":"Grill over high heat: sear 4-5 min per side for medium-rare (130°F).","critical":true},{"step_number":3,"instruction":"Rest 5-7 min on cutting board, loosely tented with foil.","critical":false}]},{"group_name":"Plate","order":2,"steps":[{"step_number":1,"instruction":"Creamed spinach mound at 10 o''clock on warm plate.","critical":false},{"step_number":2,"instruction":"Fan fingerling potatoes at 2 o''clock.","critical":false},{"step_number":3,"instruction":"Ribeye center-front, bone pointing away from guest.","critical":false},{"step_number":4,"instruction":"Herb butter medallion on top of steak (begin melting).","critical":false},{"step_number":5,"instruction":"Drizzle demi-glace around the plate (not over steak).","critical":false},{"step_number":6,"instruction":"Rosemary sprig leaning on the bone.","critical":false}]}]'::jsonb,
  'Bone always points AWAY from guest (12 o''clock). Butter on immediately before running — timing is critical for visual melt.',
  admin_uid
),
(
  'skirt-steak-chimichurri',
  'Grilled Skirt Steak w/ Chimichurri',
  'entree', 'entree',
  ARRAY[]::text[],
  ARRAY['Argentine', 'grill', 'shareable'],
  '["https://picsum.photos/seed/skirt-steak/400/300"]'::jsonb,
  '[{"group_name":"Grill","order":1,"items":[{"type":"raw","name":"Outside skirt steak, trimmed","quantity":12,"unit":"oz","order":1,"allergens":[]}]},{"group_name":"Plate","order":2,"items":[{"type":"prep_recipe","name":"Chimichurri","prep_recipe_ref":"chimichurri","quantity":3,"unit":"oz","order":1},{"type":"raw","name":"Grilled broccolini","quantity":6,"unit":"oz","order":2,"allergens":[]},{"type":"raw","name":"Crispy smashed potatoes","quantity":4,"unit":"oz","order":3,"allergens":[]},{"type":"raw","name":"Lemon wedge","quantity":1,"unit":"pc","order":4,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Grill","order":1,"steps":[{"step_number":1,"instruction":"Season steak with salt, pepper, light coat of olive oil.","critical":false},{"step_number":2,"instruction":"Very high heat: 3-4 min per side for medium-rare. Do NOT overcook — tough past medium.","critical":true},{"step_number":3,"instruction":"Rest 3-4 min. Slice against the grain in 1/2\" strips on a bias.","critical":false}]},{"group_name":"Plate","order":2,"steps":[{"step_number":1,"instruction":"Fan sliced steak across center of warm oval plate.","critical":false},{"step_number":2,"instruction":"Spoon chimichurri generously over sliced steak.","critical":false},{"step_number":3,"instruction":"Grilled broccolini alongside. Smashed potatoes at the end.","critical":false},{"step_number":4,"instruction":"Lemon wedge on the side.","critical":false}]}]'::jsonb,
  'Slice AGAINST the grain — most critical step for tenderness. Grain runs the short way across the steak.',
  admin_uid
),
(
  'steakhouse-wedge-salad',
  'Steakhouse Wedge Salad',
  'appetizer', 'appetizer',
  ARRAY['dairy', 'eggs'],
  ARRAY['classic', 'cold station'],
  '["https://picsum.photos/seed/wedge-salad/400/300"]'::jsonb,
  '[{"group_name":"Plating","order":1,"items":[{"type":"raw","name":"Iceberg lettuce wedge (1/4 head)","quantity":1,"unit":"pc","order":1,"allergens":[]},{"type":"raw","name":"House blue cheese dressing","quantity":3,"unit":"oz","order":2,"allergens":["dairy","eggs"]},{"type":"raw","name":"Applewood smoked bacon, crispy","quantity":3,"unit":"strips","order":3,"allergens":[]},{"type":"raw","name":"Cherry tomatoes, halved","quantity":6,"unit":"pc","order":4,"allergens":[]},{"type":"raw","name":"Red onion, shaved thin","quantity":2,"unit":"tbsp","order":5,"allergens":[]},{"type":"raw","name":"Blue cheese crumbles","quantity":1,"unit":"tbsp","order":6,"allergens":["dairy"]},{"type":"raw","name":"Chives, snipped","quantity":1,"unit":"pinch","order":7,"allergens":[]},{"type":"raw","name":"Freshly cracked black pepper","quantity":null,"unit":"to taste","order":8,"allergens":[]}]}]'::jsonb,
  '[{"group_name":"Plating","order":1,"steps":[{"step_number":1,"instruction":"Iceberg wedge on chilled plate, cut-side up.","critical":false},{"step_number":2,"instruction":"Ladle blue cheese dressing generously over the top.","critical":false},{"step_number":3,"instruction":"Bacon strips criss-crossed over the wedge.","critical":false},{"step_number":4,"instruction":"Scatter tomato halves and shaved red onion around plate.","critical":false},{"step_number":5,"instruction":"Sprinkle blue cheese crumbles and chives on top.","critical":false},{"step_number":6,"instruction":"Finish with freshly cracked black pepper.","critical":false}]}]'::jsonb,
  'Plate MUST be chilled. Wedge should stand upright. Wilted or browning lettuce = replace it.',
  admin_uid
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: foh_plate_specs (12 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO foh_plate_specs (slug, plate_spec_id, menu_name, plate_type, short_description, detailed_description, ingredients, key_ingredients, flavor_profile, allergens, allergy_notes, upsell_notes, notes, image, is_top_seller, created_by)
VALUES
(
  'loaded-queso', NULL, 'Loaded Queso', 'appetizer',
  E'Our signature queso blanco loaded with smoked brisket, pico de gallo, and jalape\u00f1os. The perfect shareable starter that hooks the table from the first chip.',
  E'Alamo Prime''s Loaded Queso is the appetizer that sets the tone for the meal. We start with a velvety white American cheese base, slow-melted to a perfect consistency, then fold in tender house-smoked brisket that''s been chopped to bite-size pieces. Fresh pico de gallo adds brightness, while sliced jalape\u00f1os bring a controlled heat that builds with each chip.',
  ARRAY['White American cheese','Smoked brisket','Pico de gallo','Jalapeños','Tortilla chips','Onion','Garlic','Cumin','Cayenne pepper','Whole milk'],
  ARRAY['White American cheese','Smoked brisket','Pico de gallo','Jalapeños','Tortilla chips'],
  ARRAY['Rich','Smoky','Savory','Spicy'],
  ARRAY['dairy','gluten'],
  E'Contains dairy (cheese, milk). Tortilla chips contain gluten. Brisket is smoked — not suitable for guests avoiding smoked foods. Can be served without jalape\u00f1os for heat-sensitive guests.',
  'Pair with a Margarita or Ranch Water. Great table starter before steaks arrive. Suggest adding a second order for tables of 4+.',
  E'Great for tables of 2+. Mention it''s shareable. The brisket makes it unique to Alamo Prime — no other steakhouse does queso like this.',
  'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=250&fit=crop',
  true, admin_uid
),
(
  'jumbo-shrimp-cocktail', NULL, 'Jumbo Shrimp Cocktail', 'appetizer',
  E'Six perfectly chilled jumbo Gulf shrimp with our house-made horseradish cocktail sauce. A classic steakhouse opener with Texas-sized shrimp.',
  E'Our Jumbo Shrimp Cocktail features six wild-caught Gulf shrimp — the biggest and sweetest you''ll find. Each shrimp is carefully poached in a seasoned court-bouillon, then shocked in an ice bath to lock in that perfect snap. The house cocktail sauce has real grated horseradish for a clean, sinus-clearing kick that complements the sweet shrimp beautifully.',
  ARRAY['Wild-caught Gulf shrimp','Horseradish root','Ketchup','Lemon','Bay leaf','Black peppercorn','Celery','Worcestershire sauce','Hot sauce'],
  ARRAY['Gulf shrimp','Horseradish','Cocktail sauce','Lemon'],
  ARRAY['Clean','Briny','Tangy','Crisp'],
  ARRAY['shellfish'],
  'Contains shellfish (shrimp). Cocktail sauce contains Worcestershire (anchovies). No dairy, no gluten. Safe for most other allergy groups.',
  'Pair with a dry white wine or Champagne. Suggest as a light starter before the ribeye or filet.',
  E'Emphasize the size — these are truly jumbo shrimp. Great as a lighter appetizer option. The horseradish cocktail sauce is made in-house daily.',
  'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&h=250&fit=crop',
  false, admin_uid
),
(
  'crispy-brussels-sprouts', NULL, 'Crispy Brussels Sprouts', 'appetizer',
  E'Flash-fried brussels sprouts tossed in chili-honey glaze with toasted almonds. Crispy, sweet, spicy — the appetizer that converts brussels sprout skeptics.',
  E'These aren''t your grandmother''s brussels sprouts. We halve them and flash-fry at 375°F until the outer leaves are like chips and the centers stay tender. The chili-honey glaze hits sweet, spicy, and savory all at once, and the toasted almonds add a nutty crunch.',
  ARRAY['Brussels sprouts','Honey','Red pepper flakes','Soy sauce','Toasted almonds','Flaky sea salt','Canola oil','Rice vinegar'],
  ARRAY['Brussels sprouts','Chili-honey glaze','Toasted almonds','Sea salt'],
  ARRAY['Sweet','Spicy','Crispy','Nutty'],
  ARRAY[]::text[],
  E'No major allergens in standard recipe. Contains tree nuts (almonds) — can be omitted on request. Soy sauce used in glaze.',
  'Suggest as a shared appetizer alongside the Loaded Queso for variety. Pairs well with a light beer or Sauvignon Blanc.',
  E'Great recommendation for guests who say they don''t like brussels sprouts. Can be made vegan by substituting the honey.',
  'https://images.unsplash.com/photo-1534938665420-4ca8be7a4330?w=400&h=250&fit=crop',
  false, admin_uid
),
(
  '16oz-bone-in-ribeye',
  (SELECT id FROM plate_specs WHERE slug = 'bone-in-ribeye'),
  '16oz Bone-In Ribeye', 'entree',
  E'Our flagship steak: a 16-ounce bone-in ribeye, dry-aged 28 days for intense beefy flavor. The most marbled, most flavorful cut on our menu.',
  E'The 16oz Bone-In Ribeye is the crown jewel of Alamo Prime''s menu. We source USDA Prime grade — the top 2% of all beef — and then dry-age it in our temperature-controlled aging room for 28 days. The bone adds flavor during cooking, and our 900°F infrared broiler creates a perfect crust while keeping the interior at the guest''s desired temperature.',
  ARRAY['USDA Prime bone-in ribeye','Coarse sea salt','Cracked black pepper','Herb butter','Thyme','Rosemary','Garlic'],
  ARRAY['Prime ribeye','Bone-in','Herb butter','Sea salt'],
  ARRAY['Rich','Beefy','Buttery','Bold'],
  ARRAY['dairy'],
  E'Contains dairy (herb butter finish). Can be served without butter on request. No gluten. Cooked on shared broiler — not suitable for severe cross-contamination concerns.',
  'Pair with Loaded Baked Potato or Creamed Spinach. Suggest an Old Fashioned or full-bodied Cabernet. Recommend the bone-in over boneless for flavor.',
  E'This is our signature dish — lead with this for steak lovers. Always ask about temperature preference. The bone keeps the meat juicier.',
  'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=250&fit=crop',
  true, admin_uid
),
(
  '8oz-filet-mignon', NULL, '8oz Filet Mignon', 'entree',
  E'The most tender cut in the house: an 8-ounce center-cut filet mignon, butter-soft with a delicate, refined beef flavor.',
  E'The 8oz Filet Mignon is the most tender steak on our menu, cut from the center of the tenderloin — the muscle that does the least work on the animal. The result is a butter-soft texture that practically melts on contact. The butter-baste technique adds richness while building an incredible golden crust.',
  ARRAY['Center-cut beef tenderloin','Cracked black pepper','Unsalted butter','Fresh thyme','Garlic cloves','Sea salt','Canola oil'],
  ARRAY['Center-cut filet','Black pepper','Butter baste','Thyme'],
  ARRAY['Tender','Delicate','Refined','Buttery'],
  ARRAY['dairy'],
  E'Contains dairy (butter baste). Can be prepared with olive oil instead of butter on request. No gluten.',
  E'Pair with Creamed Spinach for an elegant combination. Suggest a Bordeaux or Pinot Noir. Great for special occasions.',
  'Recommend to guests who prefer tenderness over bold flavor. Great for special occasions.',
  'https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=250&fit=crop',
  false, admin_uid
),
(
  'grilled-atlantic-salmon', NULL, 'Grilled Atlantic Salmon', 'entree',
  E'A perfectly grilled 10oz Atlantic salmon fillet with lemon-dill butter sauce. Our go-to recommendation for guests looking beyond steak.',
  E'Our Grilled Atlantic Salmon is the best non-steak entree on the menu. The 10oz fillet is grilled skin-side down to achieve perfectly crispy skin while the flesh stays moist and flaky. The house lemon-dill butter sauce adds brightness and richness.',
  ARRAY['Atlantic salmon fillet','Lemon juice','Fresh dill','Clarified butter','White wine','Olive oil','Sea salt','Black pepper','Seasonal vegetables'],
  ARRAY['Atlantic salmon','Lemon-dill butter','Seasonal vegetables','Olive oil'],
  ARRAY['Fresh','Bright','Buttery','Herbaceous'],
  ARRAY['fish'],
  E'Contains fish (salmon). Butter sauce contains dairy — can be served with olive oil and lemon instead. No gluten.',
  E'Pair with Sauvignon Blanc or Pinot Noir. Suggest Creamed Spinach as a side. Position it as elegant, not a consolation prize.',
  E'Best recommendation for non-steak guests. The crispy skin is a highlight — mention it.',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=250&fit=crop',
  false, admin_uid
),
(
  'chicken-fried-steak', NULL, 'Chicken Fried Steak', 'entree',
  E'A Texas original: hand-breaded, golden-fried steak cutlet smothered in white pepper gravy. Comfort food elevated to steakhouse quality.',
  E'Chicken Fried Steak is Texas comfort food at its finest, and at Alamo Prime, we give it the premium treatment. We start with a quality beef cutlet that''s hand-tenderized, then put it through a double-dredge process for an extra thick, crunchy breading. The white pepper cream gravy is made from scratch using the pan drippings.',
  ARRAY['Beef cutlet','All-purpose flour','Buttermilk','Eggs','Seasoned salt','White pepper','Heavy cream','Butter','Mashed potatoes','Canola oil'],
  ARRAY['Tenderized steak cutlet','Seasoned breading','White pepper gravy','Mashed potatoes'],
  ARRAY['Savory','Comforting','Crispy','Peppery'],
  ARRAY['gluten','dairy','eggs'],
  E'Contains gluten (flour breading), dairy (buttermilk, cream gravy, butter), and eggs (egg wash). Cannot be modified — fundamental to the dish.',
  E'Pair with an Old Fashioned or sweet tea. Great for first-time visitors wanting a true Texas experience.',
  E'A Texas essential — this is the most "Texas" dish on the menu. The double-dredge technique is what makes our breading superior.',
  'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400&h=250&fit=crop',
  true, admin_uid
),
(
  'loaded-baked-potato', NULL, 'Loaded Baked Potato', 'side',
  E'A massive Idaho potato, slow-baked until fluffy, loaded with butter, sour cream, cheddar, bacon, and chives.',
  E'Our Loaded Baked Potato is the quintessential steakhouse side. We use oversized Idaho Russet potatoes — known for their fluffy, starchy interior — and bake them low and slow until the skin is salty and crispy and the inside is cloud-like. Then we load it up with everything.',
  ARRAY['Idaho Russet potato','Unsalted butter','Sour cream','Sharp cheddar cheese','Applewood-smoked bacon','Fresh chives','Olive oil','Coarse salt'],
  ARRAY['Idaho potato','Butter','Sour cream','Cheddar cheese','Bacon','Chives'],
  ARRAY['Creamy','Salty','Smoky','Comforting'],
  ARRAY['dairy'],
  E'Contains dairy (butter, sour cream, cheddar). Can be modified: no cheese, no sour cream, no bacon. Potato and skin are naturally dairy-free and gluten-free.',
  'The #1 side pairing with the Bone-In Ribeye. Suggest alongside any steak.',
  E'The most popular side with steaks. Always suggest it alongside the ribeye. The potato is genuinely large — set expectations.',
  'https://images.unsplash.com/photo-1633436375153-d7045cb93e38?w=400&h=250&fit=crop',
  false, admin_uid
),
(
  'creamed-spinach-dish', NULL, 'Creamed Spinach', 'side',
  E'Velvety creamed spinach with nutmeg, garlic, and Parmesan. The elegant steakhouse side that adds a touch of green to any plate.',
  E'Creamed Spinach is the steakhouse side that bridges comfort and elegance. We start by wilting fresh baby spinach in garlic butter, then fold it into a béchamel cream sauce perfumed with freshly grated nutmeg. A generous amount of Parmigiano-Reggiano adds depth and umami.',
  ARRAY['Baby spinach','Heavy cream','Parmigiano-Reggiano','Garlic','Unsalted butter','All-purpose flour','Whole nutmeg','Sea salt','White pepper'],
  ARRAY['Baby spinach','Heavy cream','Parmesan','Garlic','Nutmeg'],
  ARRAY['Creamy','Savory','Earthy','Aromatic'],
  ARRAY['dairy'],
  E'Contains dairy (cream, butter, Parmesan). Flour in béchamel contains gluten — can be made gluten-free with cornstarch on request.',
  E'Best paired with the 8oz Filet Mignon — the elegance matches. Also great alongside salmon.',
  E'Best paired with filet mignon. Mention the nutmeg — it''s a distinguishing detail. Good option for guests avoiding carbs.',
  'https://images.unsplash.com/photo-1580013759032-7d2a085e7d73?w=400&h=250&fit=crop',
  false, admin_uid
),
(
  'mac-and-cheese', NULL, 'Mac & Cheese', 'side',
  E'Four-cheese mac & cheese with a golden breadcrumb crust, baked until bubbling. The ultimate comfort side.',
  E'Our Mac & Cheese is what happens when comfort food meets steakhouse quality. We use cavatappi (corkscrew) pasta for maximum sauce grip, and our four-cheese blend creates a sauce that''s both rich and complex: sharp cheddar for tang, Gruyère for nuttiness, fontina for melt, and Parmesan for depth.',
  ARRAY['Cavatappi pasta','Sharp cheddar','Gruyère','Fontina','Parmigiano-Reggiano','Panko breadcrumbs','Unsalted butter','All-purpose flour','Whole milk','Dried herbs'],
  ARRAY['Cavatappi pasta','Sharp cheddar','Gruyère','Fontina','Parmesan','Breadcrumbs'],
  ARRAY['Cheesy','Rich','Nutty','Comforting'],
  ARRAY['dairy','gluten'],
  E'Contains dairy (four cheeses, butter, milk) and gluten (pasta, flour, breadcrumbs). Cannot be modified to remove either — fundamental to the dish.',
  E'Second most popular side after baked potato. Universally loved — suggest for tables with kids.',
  E'Second most popular side after the baked potato. The four-cheese blend is what makes it special. Comes in a hot baking dish — warn guests it''s hot.',
  'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=400&h=250&fit=crop',
  true, admin_uid
),
(
  'pecan-pie', NULL, 'Pecan Pie', 'dessert',
  E'Texas pecan pie with a buttery, flaky crust and caramelized pecan filling. Served warm with a scoop of vanilla bean ice cream.',
  E'Pecan Pie is the ultimate Texas dessert, and ours does it justice. We use locally sourced Texas pecans — known for their large size and rich, buttery flavor. The filling is a brown sugar-butter custard that caramelizes during baking. Served warm with a scoop of vanilla bean ice cream that melts into the warm pie.',
  ARRAY['Texas pecans','Brown sugar','Unsalted butter','Pure vanilla extract','Eggs','Corn syrup','All-purpose flour','Salt','Vanilla bean ice cream'],
  ARRAY['Texas pecans','Brown sugar','Butter','Vanilla','Flaky pie crust','Vanilla bean ice cream'],
  ARRAY['Sweet','Nutty','Caramelized','Warm'],
  ARRAY['tree-nuts','gluten','dairy','eggs'],
  E'Contains tree nuts (pecans), gluten (pie crust), dairy (butter, ice cream), and eggs. Multiple allergens — always confirm with guests.',
  E'Pair with coffee, after-dinner bourbon, or a dessert wine. Our most popular dessert — mention it''s a Texas tradition.',
  E'Most popular dessert on the menu. Emphasize it''s a Texas tradition. The warm pie with cold ice cream is the key selling point.',
  'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=400&h=250&fit=crop',
  true, admin_uid
),
(
  'chocolate-lava-cake', NULL, 'Chocolate Lava Cake', 'dessert',
  E'Individual dark chocolate cake with a molten center that flows when you cut into it. Served with whipped cream and fresh berries.',
  E'Our Chocolate Lava Cake is the grand finale for chocolate lovers. Made with premium dark chocolate, each cake is baked to order in its own ramekin with precise timing. When you cut into it, the molten chocolate center flows out like velvet.',
  ARRAY['70% cacao dark chocolate','Unsalted butter','Eggs','Sugar','All-purpose flour','Cocoa powder','Heavy cream','Seasonal berries','Powdered sugar'],
  ARRAY['Dark chocolate','Butter','Eggs','Whipped cream','Fresh berries'],
  ARRAY['Decadent','Rich','Bittersweet','Velvety'],
  ARRAY['dairy','gluten','eggs'],
  E'Contains dairy (butter, cream), gluten (flour), and eggs. Cannot be modified — all three are structural. Made in shared kitchen — possible trace nuts.',
  E'Must be ordered early — 12-minute bake time. Suggest at the start of the entree course. Great for date nights.',
  E'This takes 12 minutes to bake, so suggest it early. The "lava moment" when they cut into it is the experience — mention it when selling.',
  'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=250&fit=crop',
  false, admin_uid
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: wines (5 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO wines (slug, name, producer, region, country, vintage, varietal, blend, style, body, tasting_notes, producer_notes, notes, is_top_seller, image, created_by)
VALUES
(
  'chateau-margaux-2018', E'Château Margaux 2018', E'Château Margaux', 'Margaux, Bordeaux', 'France', '2018',
  'Cabernet Sauvignon blend', true, 'red', 'full',
  'Deep garnet with violet rim. Aromas of blackcurrant, cedar, and violet lead into a palate of cassis, graphite, and subtle tobacco. Silky tannins with extraordinary length and precision.',
  E'First Growth Bordeaux estate with history dating to 1590, Château Margaux was classified in the legendary 1855 Classification and has remained at the pinnacle of fine wine ever since. The estate spans 262 hectares in the prestigious Margaux appellation, where gravelly soils and a unique microclimate produce wines of extraordinary finesse.',
  E'Pair with prime ribeye or rack of lamb. Serve at 64°F. Decant 1 hour before service. Glass: Bordeaux.',
  true, 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32e6?w=400&h=600&fit=crop', admin_uid
),
(
  'cloudy-bay-sauvignon-blanc-2023', 'Cloudy Bay Sauvignon Blanc 2023', 'Cloudy Bay', 'Marlborough', 'New Zealand', '2023',
  'Sauvignon Blanc', false, 'white', 'light',
  'Pale straw with green glints. Vibrant aromas of passionfruit, citrus zest, and freshly cut grass. Crisp and refreshing with a mineral finish that lingers beautifully.',
  E'Founded in 1985 in Marlborough, Cloudy Bay was one of the first wineries to prove that New Zealand could produce world-class Sauvignon Blanc. Named after the bay at the tip of the South Island first charted by Captain Cook in 1770. Today owned by LVMH, Cloudy Bay continues to set the benchmark for vibrant, fruit-driven Sauvignon Blanc.',
  E'Pair with oysters, ceviche, or goat cheese salad. Serve at 46°F. No decanting needed. Glass: White wine or universal.',
  false, 'https://images.unsplash.com/photo-1566754436898-857ef05c9cd7?w=400&h=600&fit=crop', admin_uid
),
(
  'whispering-angel-rose-2023', E'Whispering Angel Rosé 2023', E'Château d''Esclans', 'Provence', 'France', '2023',
  'Grenache / Rolle blend', true, E'rosé', 'light',
  'Delicate pale pink with salmon hues. Aromas of fresh strawberry, white peach, and rose petal. Light-bodied and elegant with a crisp, dry finish and subtle minerality.',
  E'Château d''Esclans is a historic estate nestled in the hills of Provence, with roots tracing back to the Gallo-Roman era. In 2006, Sacha Lichine purchased the property and transformed it into the world''s most recognized rosé producer. Whispering Angel single-handedly ignited the global Provence rosé revolution.',
  E'Pair with Mediterranean appetizers, grilled shrimp, or light salads. Serve at 48°F. No decanting needed. Glass: White wine.',
  false, 'https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=400&h=600&fit=crop', admin_uid
),
(
  'veuve-clicquot-yellow-label-brut-nv', 'Veuve Clicquot Yellow Label Brut NV', 'Veuve Clicquot', 'Champagne', 'France', NULL,
  'Pinot Noir / Chardonnay / Pinot Meunier', true, 'sparkling', 'medium',
  'Golden-yellow with fine, persistent bubbles. Aromas of brioche, apple, and white flowers. Rich and toasty on the palate with stone fruit, honey, and a balanced, lingering finish.',
  E'Founded in 1772 in Reims, Veuve Clicquot is one of the oldest and most prestigious Champagne houses in the world. The house owes its legend to Madame Barbe-Nicole Clicquot, who took over the business at age 27 after her husband''s death and invented the riddling technique (remuage) that made clear, sparkling Champagne possible.',
  E'Pair with raw bar, smoked salmon, or as an aperitif. Serve at 47°F. No decanting — keep in ice bucket. Glass: Flute or tulip.',
  true, 'https://images.unsplash.com/photo-1594372365401-3b5ff14eaaed?w=400&h=600&fit=crop', admin_uid
),
(
  'erath-pinot-noir-2021', 'Erath Pinot Noir 2021', 'Erath Winery', 'Willamette Valley, Oregon', 'USA', '2021',
  'Pinot Noir', false, 'red', 'medium',
  'Ruby red with garnet edge. Aromas of ripe cherry, raspberry, and warm baking spice. Medium-bodied with soft tannins, bright acidity, and a smooth, earthy finish.',
  E'Dick Erath was a true pioneer who planted some of the first Pinot Noir vines in Oregon''s Willamette Valley back in 1968, when most people thought quality wine couldn''t be made outside California. Today, Erath Winery remains one of the most respected producers in the valley.',
  E'Pair with grilled salmon, duck breast, or mushroom risotto. Serve at 58°F. Light decanting optional (30 min). Glass: Burgundy.',
  false, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=600&fit=crop', admin_uid
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: cocktails (5 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO cocktails (slug, name, style, glass, ingredients, key_ingredients, procedure, tasting_notes, description, notes, is_top_seller, image, created_by)
VALUES
(
  'old-fashioned', 'Old Fashioned', 'classic', 'Rocks',
  '2 oz Bourbon, 0.5 oz Demerara syrup, 2 dashes Angostura bitters, 1 dash Orange bitters, Orange peel',
  'Bourbon, Angostura bitters',
  '[{"step":1,"instruction":"Add Demerara syrup and both bitters to a mixing glass."},{"step":2,"instruction":"Stir briefly to combine the syrup and bitters."},{"step":3,"instruction":"Add bourbon and a large ice cube to a rocks glass."},{"step":4,"instruction":"Stir gently for 30 seconds until well-chilled and diluted."},{"step":5,"instruction":"Express an orange peel over the glass and place it as garnish."}]'::jsonb,
  'Rich, warm, and subtly sweet with deep caramel and vanilla from the bourbon. The bitters add layers of baking spice and a hint of citrus, while the Demerara syrup rounds everything into a smooth, lingering finish.',
  E'The Old Fashioned is the original cocktail — a direct descendant of the earliest mixed drinks from the early 1800s. It strips cocktail-making to its essence: spirit, sugar, water, and bitters.',
  E'Use a large, clear ice cube for slow dilution. Express the orange peel oils over the surface for aroma. Avoid muddling fruit — this is a spirit-forward drink. Always stir, never shake.',
  true, 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=530&fit=crop', admin_uid
),
(
  'espresso-martini', 'Espresso Martini', 'modern', 'Coupe',
  '2 oz Vodka, 0.5 oz Kahlua, 1 oz Fresh espresso, 0.25 oz Simple syrup',
  'Vodka, Kahlua, Espresso',
  '[{"step":1,"instruction":"Pull a fresh espresso shot and let it cool slightly for 30 seconds."},{"step":2,"instruction":"Combine vodka, Kahlua, espresso, and simple syrup in a shaker."},{"step":3,"instruction":"Add ice and shake hard for 15 seconds to build the crema."},{"step":4,"instruction":"Double strain into a chilled coupe glass."},{"step":5,"instruction":"Garnish with three coffee beans on the foam."}]'::jsonb,
  E'Bold coffee aroma with a velvety crema on top. The palate balances rich espresso bitterness with the smooth sweetness of Kahlua and a clean vodka backbone.',
  E'Created in 1980s London by bartender Dick Bradsell when a young model asked for something to "wake me up, then mess me up." Fresh espresso is the non-negotiable key — it provides the signature crema and bold flavor.',
  E'Always use freshly pulled espresso — cold brew or instant won''t create the crema. Shake vigorously to aerate. Chill the coupe glass in advance. Three coffee beans = health, wealth, happiness.',
  true, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=530&fit=crop', admin_uid
),
(
  'mai-tai', 'Mai Tai', 'tiki', 'Rocks',
  '2 oz Aged rum, 1 oz Lime juice, 0.5 oz Orange curacao, 0.5 oz Orgeat, 0.5 oz Dark rum (float), Mint sprig',
  'Aged rum, Orgeat, Dark rum',
  '[{"step":1,"instruction":"Combine aged rum, lime juice, orange curacao, and orgeat in a shaker."},{"step":2,"instruction":"Add ice and shake vigorously for 12 seconds."},{"step":3,"instruction":"Strain over crushed ice in a rocks glass."},{"step":4,"instruction":"Gently float the dark rum on top by pouring over the back of a spoon."},{"step":5,"instruction":"Garnish with a fresh mint sprig."},{"step":6,"instruction":"Add a spent lime shell and a cocktail straw."}]'::jsonb,
  'Tropical and complex with layers of aged rum warmth, bright citrus acidity, and the distinctive almond sweetness of orgeat. The dark rum float adds a molasses-rich top note.',
  E'Invented by Trader Vic Bergeron in 1944 at his Oakland restaurant, the Mai Tai is the crown jewel of tiki cocktails. A properly made Mai Tai is nothing like the syrupy fruit-punch versions found at tourist bars.',
  E'Use quality aged rum — the rum does the heavy lifting. Orgeat (almond syrup) is essential and not substitutable. Fresh lime juice only. Crushed ice is critical.',
  false, 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&h=530&fit=crop', admin_uid
),
(
  'penicillin', 'Penicillin', 'modern', 'Rocks',
  '2 oz Blended Scotch, 0.75 oz Lemon juice, 0.75 oz Honey-ginger syrup, 0.25 oz Islay Scotch (float), Candied ginger',
  'Blended Scotch, Islay Scotch, Honey-ginger',
  '[{"step":1,"instruction":"Combine blended Scotch, lemon juice, and honey-ginger syrup in a shaker."},{"step":2,"instruction":"Add ice and shake vigorously for 12 seconds."},{"step":3,"instruction":"Strain over fresh ice in a rocks glass."},{"step":4,"instruction":"Carefully float the Islay Scotch on top."},{"step":5,"instruction":"Garnish with a piece of candied ginger on a pick."}]'::jsonb,
  'Warm honey and fresh ginger spice upfront, with a smooth Scotch backbone and bright lemon acidity. The Islay float adds a dramatic smoky whisper that lingers on the nose and palate.',
  E'Created by Sam Ross at Milk & Honey in New York City around 2005, the Penicillin has become the most acclaimed modern cocktail of the 21st century. Named playfully as a "cure-all."',
  E'The honey-ginger syrup is made by simmering fresh ginger in honey and water. The Islay float is essential — it provides the smoky nose that defines the drink. Use a good blended Scotch as the base.',
  false, 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=530&fit=crop', admin_uid
),
(
  'paloma', 'Paloma', 'refresher', 'Highball',
  '2 oz Tequila blanco, 2 oz Fresh grapefruit juice, 0.5 oz Lime juice, 0.5 oz Agave nectar, 2 oz Club soda',
  'Tequila blanco, Grapefruit',
  '[{"step":1,"instruction":"Salt half the rim of a highball glass."},{"step":2,"instruction":"Fill the glass with fresh ice."},{"step":3,"instruction":"Add tequila, grapefruit juice, lime juice, and agave nectar."},{"step":4,"instruction":"Top with club soda and stir gently to combine."},{"step":5,"instruction":"Garnish with a grapefruit wedge."}]'::jsonb,
  E'Bright and effervescent with juicy grapefruit upfront and clean tequila agave character. The salt rim amplifies every flavor, and the soda keeps it light and crushable.',
  E'The Paloma is Mexico''s most popular tequila cocktail — far outselling the Margarita in its homeland. The name means "dove" in Spanish. Our version uses fresh grapefruit juice and club soda for a cleaner, brighter flavor.',
  E'Use 100% agave tequila blanco for clean, bright agave flavor. Fresh grapefruit juice is essential — canned or bottled tastes flat. The half-salt rim lets guests choose their sip.',
  false, 'https://images.unsplash.com/photo-1560512823-829485b8bf24?w=400&h=530&fit=crop', admin_uid
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: beer_liquor_list (15 rows)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO beer_liquor_list (slug, name, category, subcategory, producer, country, description, style, notes, created_by)
VALUES
('shiner-bock', 'Shiner Bock', 'Beer', 'Bock', 'Spoetzl Brewery', 'USA',
 E'Texas'' most iconic dark lager with rich malt character and a clean, easy-drinking finish. Brewed in Shiner, TX since 1913.',
 'Malty, smooth, amber',
 E'Serve at 38-42°F in a pint glass or frosted mug. Pairs exceptionally well with BBQ, burgers, and Tex-Mex.',
 admin_uid),
('modelo-especial', 'Modelo Especial', 'Beer', 'Lager', 'Grupo Modelo', 'Mexico',
 E'A pilsner-style lager with a slightly sweet malt character and a hint of orange blossom honey aroma. The #1 beer brand in the U.S. by sales.',
 'Crisp, light, balanced',
 E'Serve ice-cold at 34-38°F. Excellent with seafood, ceviche, and spicy dishes. Offer with a lime wedge if the guest prefers.',
 admin_uid),
('dos-equis-amber', 'Dos Equis Amber', 'Beer', 'Vienna Lager', E'Cuauhtémoc Moctezuma', 'Mexico',
 E'A Vienna-style lager with a deep amber color and toasted malt sweetness. Originally brewed by a German immigrant in Mexico in 1897.',
 'Toasty, caramel, smooth',
 E'Serve at 38-42°F in a pint glass. The caramel malt notes pair beautifully with grilled meats and smoky flavors.',
 admin_uid),
('firemans-4', E'Fireman''s 4', 'Beer', 'Blonde Ale', 'Real Ale Brewing', 'USA',
 'A Texas craft blonde ale brewed in Blanco, TX. Light-bodied with subtle citrus hop notes and a clean malt backbone. Named for volunteer firefighters.',
 'Light, citrusy, crisp',
 E'Serve cold at 36-40°F. Very food-friendly — works with salads, grilled chicken, fish tacos. Great gateway craft beer.',
 admin_uid),
('lone-star', 'Lone Star', 'Beer', 'Lager', 'Pabst (Lone Star)', 'USA',
 E'The "National Beer of Texas" since 1884. A classic American lager — light, crisp, and unpretentious. Pure Texas nostalgia in a can.',
 'Light, clean, easy-drinking',
 E'Serve ice-cold. Often ordered alongside a shot of whiskey (boilermaker style). Pairs with anything casual — wings, nachos, burgers.',
 admin_uid),
('blue-moon', 'Blue Moon', 'Beer', 'Wheat', 'Blue Moon Brewing', 'USA',
 'A Belgian-style wheat ale brewed with Valencia orange peel and coriander. Hazy golden color with a creamy body and subtle spice notes.',
 'Citrusy, smooth, wheaty',
 E'Always serve with a fresh orange slice — it''s part of the experience. Serve at 40-45°F. Pairs well with lighter dishes and seafood.',
 admin_uid),
('guinness-draught', 'Guinness Draught', 'Beer', 'Stout', 'Guinness', 'Ireland',
 E'The world''s most famous stout. Nitrogenated for a velvety-smooth cascade and dense creamy head. Surprisingly light-bodied — only 125 calories per serving.',
 'Roasty, creamy, dry',
 E'Pour with the two-part pour: fill to 3/4, let settle, then top off. Serve at 42-46°F. The "lighter than it looks" fact is a great conversation starter.',
 admin_uid),
('bulleit-bourbon', 'Bulleit Bourbon', 'Liquor', 'Bourbon', 'Bulleit', 'USA',
 E'A high-rye bourbon (28% rye in the mash bill) with a distinctively spicy, bold character. A bartender favorite for its versatility.',
 'Spicy, oaky, bold',
 E'Recommend neat or with a single large ice cube for sipping. The high-rye spice makes it excellent in cocktails — especially Old Fashioneds.',
 admin_uid),
('woodford-reserve', 'Woodford Reserve', 'Liquor', 'Bourbon', 'Woodford Reserve', 'USA',
 E'A premium small-batch bourbon from Kentucky''s oldest distillery. Triple-distilled in copper pot stills for exceptional smoothness. The official bourbon of the Kentucky Derby.',
 'Rich, vanilla, refined',
 'Best served neat or with a splash of water to open up the aromas. Also makes an exceptional Manhattan.',
 admin_uid),
('macallan-12', 'Macallan 12', 'Liquor', 'Scotch', 'The Macallan', 'Scotland',
 E'Aged 12 years exclusively in sherry-seasoned oak casks from Jerez, Spain. The world''s most collected and awarded single malt.',
 'Sherried, fruity, oak',
 'Serve neat in a Glencairn glass, or with a few drops of water. Good upsell from blended Scotch. Pairs with dark chocolate and dried fruits.',
 admin_uid),
('patron-silver', E'Patrón Silver', 'Liquor', 'Tequila', E'Patrón', 'Mexico',
 E'A premium 100% Weber Blue Agave tequila, small-batch produced in Jalisco. Crystal clear with a smooth, fresh character — light citrus and agave sweetness.',
 'Smooth, citrus, clean',
 E'Excellent in Margaritas and Palomas, or sipped neat/on the rocks. Mention it''s 100% agave — no mixto shortcuts.',
 admin_uid),
('casamigos-blanco', 'Casamigos Blanco', 'Liquor', 'Tequila', 'Casamigos', 'Mexico',
 E'Co-founded by George Clooney and Rande Gerber, designed to be the smoothest tequila that doesn''t need to be masked in a cocktail. Slow-roasted agave and 80-hour fermentation.',
 'Silky, sweet agave, mild',
 E'Best sipped neat or on the rocks to appreciate its smoothness. The celebrity backstory is a natural conversation starter.',
 admin_uid),
('hendricks', E'Hendrick''s', 'Liquor', 'Gin', E'Hendrick''s', 'Scotland',
 E'A Scottish gin infused with rose petals and cucumber after distillation. The iconic apothecary-style bottle and quirky branding have made it the world''s most recognizable premium gin.',
 'Floral, cucumber, botanical',
 E'Serve in a Gin & Tonic with a cucumber slice garnish (not lime). The cucumber-rose profile makes it an excellent gateway gin. Mention the Scottish origin.',
 admin_uid),
('titos', E'Tito''s', 'Liquor', 'Vodka', 'Fifth Generation', 'USA',
 E'Handmade in Austin, TX from corn, making it naturally gluten-free. Six-times distilled in old-fashioned pot stills. Grew from a one-man operation to America''s best-selling spirit.',
 'Clean, smooth, neutral',
 E'The Texas connection is a strong selling point at Alamo Prime. Works in any vodka cocktail. The gluten-free angle matters to some guests.',
 admin_uid),
('bacardi-superior', E'Bacardí Superior', 'Liquor', 'Rum', E'Bacardí', 'Puerto Rico',
 E'The world''s most recognized white rum, charcoal-filtered for a clean, light profile. Founded in Santiago de Cuba in 1862. The bat logo represents good fortune.',
 'Light, dry, versatile',
 E'The essential base for Mojitos, Daiquirís, and Cuba Libres. Too light for sipping neat — always recommend in cocktails.',
 admin_uid);

END $$;
