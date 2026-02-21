// =============================================================================
// MOCK DISH DATA
// Hardcoded dishes for FOH Plate Specs Viewer (Phase 1 - no Supabase integration)
// =============================================================================

// --- Types ---

export type DishCategory = 'appetizer' | 'entree' | 'side' | 'dessert';

export type AllergenType = 'dairy' | 'gluten' | 'eggs' | 'shellfish' | 'fish' | 'tree-nuts' | 'soy' | 'peanuts';

export type DishAIAction = 'practicePitch' | 'samplePitch' | 'teachMe' | 'questions';

export interface Dish {
  id: string;
  slug: string;
  name: string;
  category: DishCategory;
  shortDescription: string;
  keyIngredients: string[];
  ingredients: string[];
  allergens: AllergenType[];
  flavorProfile: string[];
  allergyNotes: string;
  upsellNotes: string;
  detailedDescription: string;
  notes: string;
  image: string;
  topSeller: boolean;
  aiResponses: Record<DishAIAction, string>;
}

// --- AI action buttons config ---

export const DISH_AI_ACTIONS: { key: DishAIAction; label: string; icon: string }[] = [
  { key: 'practicePitch', label: 'Practice a pitch', icon: 'mic' },
  { key: 'samplePitch', label: 'Hear a sample pitch', icon: 'play' },
  { key: 'teachMe', label: 'Teach Me', icon: 'graduation-cap' },
  { key: 'questions', label: 'Have any questions?', icon: 'help-circle' },
];

// --- Category config (colors for badges) ---

export const DISH_CATEGORY_CONFIG: Record<DishCategory, {
  label: string;
  color: string;
  darkColor: string;
  textColor: string;
}> = {
  appetizer: {
    label: 'Appetizer',
    color: 'bg-[#2aa962] text-white',
    darkColor: '',
    textColor: 'text-[#2aa962]',
  },
  entree: {
    label: 'Entree',
    color: 'bg-red-600 text-white',
    darkColor: 'dark:bg-red-700',
    textColor: 'text-red-600 dark:text-red-400',
  },
  side: {
    label: 'Side',
    color: 'bg-sky-600 text-white',
    darkColor: 'dark:bg-sky-700',
    textColor: 'text-sky-600 dark:text-sky-400',
  },
  dessert: {
    label: 'Dessert',
    color: 'bg-amber-500 text-white',
    darkColor: 'dark:bg-amber-600',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
};

// --- Allergen config (pills) ---

export const ALLERGEN_CONFIG: Record<AllergenType, {
  label: string;
  emoji: string;
  color: string;
  darkColor: string;
}> = {
  dairy: { label: 'Dairy', emoji: '\u{1F95B}', color: 'bg-amber-500 text-white', darkColor: 'dark:bg-amber-600' },
  gluten: { label: 'Gluten', emoji: '\u{1F33E}', color: 'bg-orange-600 text-white', darkColor: 'dark:bg-orange-700' },
  eggs: { label: 'Eggs', emoji: '\u{1F95A}', color: 'bg-yellow-600 text-white', darkColor: 'dark:bg-yellow-700' },
  shellfish: { label: 'Shellfish', emoji: '\u{1F990}', color: 'bg-rose-600 text-white', darkColor: 'dark:bg-rose-700' },
  fish: { label: 'Fish', emoji: '\u{1F41F}', color: 'bg-sky-600 text-white', darkColor: 'dark:bg-sky-700' },
  'tree-nuts': { label: 'Tree Nuts', emoji: '\u{1F330}', color: 'bg-red-600 text-white', darkColor: 'dark:bg-red-700' },
  soy: { label: 'Soy', emoji: '\u{1FAD8}', color: 'bg-lime-600 text-white', darkColor: 'dark:bg-lime-700' },
  peanuts: { label: 'Peanuts', emoji: '\u{1F95C}', color: 'bg-orange-500 text-white', darkColor: 'dark:bg-orange-600' },
};

// --- Category display order ---

export const CATEGORY_ORDER: DishCategory[] = ['appetizer', 'entree', 'side', 'dessert'];

// --- Mock dishes ---

const DISHES: Dish[] = [
  // ===== APPETIZERS =====
  {
    id: 'dish-1',
    slug: 'loaded-queso',
    name: 'Loaded Queso',
    category: 'appetizer',
    shortDescription: 'Our signature queso blanco loaded with smoked brisket, pico de gallo, and jalapeños. The perfect shareable starter that hooks the table from the first chip.',
    keyIngredients: ['White American cheese', 'Smoked brisket', 'Pico de gallo', 'Jalapeños', 'Tortilla chips'],
    ingredients: ['White American cheese', 'Smoked brisket', 'Pico de gallo', 'Jalapeños', 'Tortilla chips', 'Onion', 'Garlic', 'Cumin', 'Cayenne pepper', 'Whole milk'],
    allergens: ['dairy', 'gluten'],
    flavorProfile: ['Rich', 'Smoky', 'Savory', 'Spicy'],
    allergyNotes: 'Contains dairy (cheese, milk). Tortilla chips contain gluten. Brisket is smoked — not suitable for guests avoiding smoked foods. Can be served without jalapeños for heat-sensitive guests.',
    upsellNotes: 'Pair with a Margarita or Ranch Water. Great table starter before steaks arrive. Suggest adding a second order for tables of 4+.',
    detailedDescription: 'Alamo Prime\'s Loaded Queso is the appetizer that sets the tone for the meal. We start with a velvety white American cheese base, slow-melted to a perfect consistency, then fold in tender house-smoked brisket that\'s been chopped to bite-size pieces. Fresh pico de gallo adds brightness, while sliced jalapeños bring a controlled heat that builds with each chip.',
    notes: 'Great for tables of 2+. Mention it\'s shareable. The brisket makes it unique to Alamo Prime — no other steakhouse does queso like this.',
    image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=250&fit=crop',
    topSeller: true,
    aiResponses: {
      practicePitch: 'Our Loaded Queso is the best way to start your meal at Alamo Prime. It\'s a rich, creamy white cheese dip loaded with our house-smoked brisket, fresh pico de gallo, and jalapeños. It comes out bubbling hot in a cast iron skillet with warm chips. It\'s perfect for sharing — and honestly, it\'s one of those starters that every table ends up ordering once they see it go by.',
      samplePitch: 'Let me tell you about our Loaded Queso — it\'s our most popular starter and it\'s incredible. We take smooth, creamy white American cheese and load it with our own house-smoked brisket, fresh pico, and jalapeños. It comes out sizzling in cast iron with warm tortilla chips. It\'s generous enough to share, and trust me, once one table orders it, every table around them does too.',
      teachMe: 'What makes Alamo Prime\'s queso special is the brisket. Most restaurants use ground beef or chorizo in their queso, but we smoke our brisket low and slow for 14 hours, then chop it and fold it right into the cheese base. The white American cheese is key — it melts smoother than cheddar and doesn\'t break or get grainy. The pico and jalapeños are prepped fresh daily. The cast iron skillet keeps it hot through the entire appetizer course.',
      questions: 'Common guest questions:\n\n"How spicy is it?" — Mild to medium. The jalapeños add flavor more than heat, but we can add extra jalapeños or leave them off entirely.\n\n"Is it enough for the table?" — Absolutely. It\'s a generous portion, great for 2-4 people. Bigger groups might want two.\n\n"Can I get it without brisket?" — We can, but the brisket is what makes it special. If they\'re vegetarian, suggest the Crispy Brussels Sprouts instead.',
    },
  },
  {
    id: 'dish-2',
    slug: 'jumbo-shrimp-cocktail',
    name: 'Jumbo Shrimp Cocktail',
    category: 'appetizer',
    shortDescription: 'Six perfectly chilled jumbo Gulf shrimp with our house-made horseradish cocktail sauce. A classic steakhouse opener with Texas-sized shrimp.',
    keyIngredients: ['Gulf shrimp', 'Horseradish', 'Cocktail sauce', 'Lemon'],
    ingredients: ['Wild-caught Gulf shrimp', 'Horseradish root', 'Ketchup', 'Lemon', 'Bay leaf', 'Black peppercorn', 'Celery', 'Worcestershire sauce', 'Hot sauce'],
    allergens: ['shellfish'],
    flavorProfile: ['Clean', 'Briny', 'Tangy', 'Crisp'],
    allergyNotes: 'Contains shellfish (shrimp). Cocktail sauce contains Worcestershire (anchovies). No dairy, no gluten. Safe for most other allergy groups.',
    upsellNotes: 'Pair with a dry white wine or Champagne. Suggest as a light starter before the ribeye or filet.',
    detailedDescription: 'Our Jumbo Shrimp Cocktail features six wild-caught Gulf shrimp — the biggest and sweetest you\'ll find. Each shrimp is carefully poached in a seasoned court-bouillon, then shocked in an ice bath to lock in that perfect snap. The house cocktail sauce has real grated horseradish for a clean, sinus-clearing kick that complements the sweet shrimp beautifully.',
    notes: 'Emphasize the size — these are truly jumbo shrimp. Great as a lighter appetizer option. The horseradish cocktail sauce is made in-house daily.',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'Our Jumbo Shrimp Cocktail is a classic steakhouse starter done right. Six wild-caught Gulf shrimp — and when I say jumbo, I mean jumbo — served perfectly chilled with our house-made horseradish cocktail sauce. The shrimp have this beautiful sweet, clean flavor and a satisfying snap when you bite into them. It\'s light, elegant, and a great way to start before your steak.',
      samplePitch: 'If you\'re looking for a lighter start, our Jumbo Shrimp Cocktail is outstanding. We use wild-caught Gulf shrimp — six enormous ones, perfectly chilled. Our cocktail sauce is made fresh daily with real grated horseradish, so it has that clean kick. It\'s one of those classic steakhouse appetizers that never goes out of style, and our shrimp are some of the biggest you\'ll find anywhere.',
      teachMe: 'The secret is in the poaching and the ice bath. We use a court-bouillon — that\'s a quick French technique where you simmer aromatics (bay leaf, black peppercorn, lemon, celery) in water to create a flavorful poaching liquid. The shrimp cook for just 2-3 minutes — overcooking makes them rubbery. Then they go straight into an ice bath to stop the cooking and lock in that snappy texture. Wild-caught Gulf shrimp have a sweeter, cleaner flavor than farmed shrimp.',
      questions: 'Common guest questions:\n\n"Are these Gulf shrimp?" — Yes, wild-caught from the Gulf of Mexico. They\'re the gold standard for American shrimp.\n\n"How big are they really?" — These are U-8 size, meaning fewer than 8 shrimp per pound. They\'re impressively large.\n\n"Is the cocktail sauce spicy?" — It has a horseradish kick, but it\'s more of a clean, sinus-clearing heat than a lingering spice. We can serve it on the side if they want to control the amount.',
    },
  },
  {
    id: 'dish-3',
    slug: 'crispy-brussels-sprouts',
    name: 'Crispy Brussels Sprouts',
    category: 'appetizer',
    shortDescription: 'Flash-fried brussels sprouts tossed in chili-honey glaze with toasted almonds. Crispy, sweet, spicy — the appetizer that converts brussels sprout skeptics.',
    keyIngredients: ['Brussels sprouts', 'Chili-honey glaze', 'Toasted almonds', 'Sea salt'],
    ingredients: ['Brussels sprouts', 'Honey', 'Red pepper flakes', 'Soy sauce', 'Toasted almonds', 'Flaky sea salt', 'Canola oil', 'Rice vinegar'],
    allergens: [],
    flavorProfile: ['Sweet', 'Spicy', 'Crispy', 'Nutty'],
    allergyNotes: 'No major allergens in standard recipe. Contains tree nuts (almonds) — can be omitted on request. Soy sauce used in glaze. Can be made vegan by substituting honey with agave.',
    upsellNotes: 'Suggest as a shared appetizer alongside the Loaded Queso for variety. Pairs well with a light beer or Sauvignon Blanc.',
    detailedDescription: 'These aren\'t your grandmother\'s brussels sprouts. We halve them and flash-fry at 375°F until the outer leaves are like chips and the centers stay tender. The chili-honey glaze hits sweet, spicy, and savory all at once, and the toasted almonds add a nutty crunch. This dish has single-handedly converted more brussels sprout haters than any other item on our menu.',
    notes: 'This is a great recommendation for guests who say they don\'t like brussels sprouts. No allergens — perfect for guests with dietary restrictions. Can be made vegan by substituting the honey.',
    image: 'https://images.unsplash.com/photo-1534938665420-4ca8be7a4330?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'You have to try our Crispy Brussels Sprouts — they\'re nothing like what you\'re imagining. We flash-fry them until the outside is shatteringly crispy, almost like chips, and then toss them in a chili-honey glaze with toasted almonds. They\'re sweet, spicy, salty, and crunchy all at once. Even guests who think they don\'t like brussels sprouts end up ordering a second round.',
      samplePitch: 'Our Crispy Brussels Sprouts are genuinely one of the most popular dishes on our menu, and I always recommend them, especially to skeptics. We flash-fry them until they\'re incredibly crispy on the outside but still tender inside, then toss them in our chili-honey glaze and finish with toasted almonds. The combination of sweet heat and crunch is addictive. I\'ve seen entire tables fight over the last one.',
      teachMe: 'The key technique is the high-temperature flash fry at 375°F. This creates that contrast between shatteringly crispy outer leaves and a tender center. The moisture needs to escape quickly for maximum crispiness, which is why we halve them — more surface area means more crispy edges. The chili-honey glaze is a balance of local honey, red pepper flakes, and a touch of soy sauce. It needs to coat the sprouts while they\'re still hot so it caramelizes slightly. The toasted almonds add texture contrast and nutty depth.',
      questions: 'Common guest questions:\n\n"I don\'t like brussels sprouts — will I like these?" — I hear that all the time, and the answer is almost always yes. The frying and the glaze completely transform them.\n\n"Are these vegan?" — The standard version uses honey in the glaze, but we can substitute agave if needed. No dairy, no eggs, no gluten.\n\n"Are they spicy?" — Mildly. The chili-honey is more sweet than hot, with just a pleasant warmth at the end.',
    },
  },

  // ===== ENTREES =====
  {
    id: 'dish-4',
    slug: '16oz-bone-in-ribeye',
    name: '16oz Bone-In Ribeye',
    category: 'entree',
    shortDescription: 'Our flagship steak: a 16-ounce bone-in ribeye, dry-aged 28 days for intense beefy flavor. The most marbled, most flavorful cut on our menu.',
    keyIngredients: ['Prime ribeye', 'Bone-in', 'Herb butter', 'Sea salt'],
    ingredients: ['USDA Prime bone-in ribeye', 'Coarse sea salt', 'Cracked black pepper', 'Herb butter', 'Thyme', 'Rosemary', 'Garlic'],
    allergens: ['dairy'],
    flavorProfile: ['Rich', 'Beefy', 'Buttery', 'Bold'],
    allergyNotes: 'Contains dairy (herb butter finish). Can be served without butter on request. No gluten. Cooked on shared broiler — not suitable for severe cross-contamination concerns.',
    upsellNotes: 'Pair with Loaded Baked Potato or Creamed Spinach. Suggest an Old Fashioned or full-bodied Cabernet. Recommend the bone-in over boneless for flavor.',
    detailedDescription: 'The 16oz Bone-In Ribeye is the crown jewel of Alamo Prime\'s menu. We source USDA Prime grade — the top 2% of all beef — and then dry-age it in our temperature-controlled aging room for 28 days. During aging, natural enzymes tenderize the meat while moisture evaporates, concentrating the beefy flavor to an almost nutty intensity. The bone adds flavor during cooking, and our 900°F infrared broiler creates a perfect crust while keeping the interior at the guest\'s desired temperature.',
    notes: 'This is our signature dish — lead with this for steak lovers. Always ask about temperature preference. The bone keeps the meat juicier. Suggest the Loaded Baked Potato or Creamed Spinach as sides.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=250&fit=crop',
    topSeller: true,
    aiResponses: {
      practicePitch: 'Our 16oz Bone-In Ribeye is the star of the menu and the reason most people come to Alamo Prime. It\'s USDA Prime grade — the top 2% of beef — and we dry-age it in-house for 28 days. That aging process concentrates the flavor into something incredibly rich and almost nutty. We sear it at 900 degrees for that perfect crust, and it comes finished with our herb butter. It\'s 16 ounces of the most flavorful, most marbled steak you\'ll find anywhere.',
      samplePitch: 'If you love steak, our 16oz Bone-In Ribeye is the reason to be here tonight. It\'s Prime grade, dry-aged 28 days in our own aging room, and seared at 900°F on our infrared broiler. The dry-aging creates this incredible depth of flavor — concentrated, beefy, with a slight nuttiness you won\'t find in a regular ribeye. The bone keeps it extra juicy, and we finish it with our house herb butter. It\'s genuinely one of the best steaks in the city.',
      teachMe: 'Dry-aging is what separates a great steakhouse from a good one. For 28 days, our ribeyes sit in a temperature and humidity-controlled room (34-36°F, 85% humidity). Two things happen: natural enzymes break down the muscle fibers, making it more tender, and moisture evaporates — we lose about 15% of the weight, but the flavor that remains is incredibly concentrated. The exterior develops a "crust" (called the pellicle) that we trim before cooking. USDA Prime means the top 2% of all beef graded in the US — it has the most marbling (intramuscular fat), which means more flavor and juiciness. Our 900°F infrared broiler creates a Maillard reaction crust in seconds without overcooking the interior.',
      questions: 'Common guest questions:\n\n"What\'s the difference between this and the filet?" — The ribeye is all about flavor and marbling — it\'s richer and more intensely beefy. The filet is about tenderness — it\'s leaner and more subtle. For steak lovers, I always recommend the ribeye.\n\n"What temperature do you recommend?" — Medium-rare (130°F) is ideal for ribeye. The fat needs some heat to render properly, so rare can leave it a bit chewy. Medium is fine too.\n\n"What does dry-aged mean?" — We age the beef for 28 days in a controlled environment. It loses moisture, which concentrates the flavor, and natural enzymes make it more tender. It\'s like the difference between a regular tomato and a sun-dried one — way more intense.',
    },
  },
  {
    id: 'dish-5',
    slug: '8oz-filet-mignon',
    name: '8oz Filet Mignon',
    category: 'entree',
    shortDescription: 'The most tender cut in the house: an 8-ounce center-cut filet mignon, butter-soft with a delicate, refined beef flavor. Elegance on a plate.',
    keyIngredients: ['Center-cut filet', 'Black pepper', 'Butter baste', 'Thyme'],
    ingredients: ['Center-cut beef tenderloin', 'Cracked black pepper', 'Unsalted butter', 'Fresh thyme', 'Garlic cloves', 'Sea salt', 'Canola oil'],
    allergens: ['dairy'],
    flavorProfile: ['Tender', 'Delicate', 'Refined', 'Buttery'],
    allergyNotes: 'Contains dairy (butter baste). Can be prepared with olive oil instead of butter on request. No gluten. Pan-seared in cast iron — minimal cross-contamination risk.',
    upsellNotes: 'Pair with Creamed Spinach for an elegant combination. Suggest a Bordeaux or Pinot Noir. Great for special occasions — mention the celebration angle.',
    detailedDescription: 'The 8oz Filet Mignon is the most tender steak on our menu, cut from the center of the tenderloin — the muscle that does the least work on the animal. The result is a butter-soft texture that practically melts on contact. We keep the seasoning simple to let the beef\'s delicate flavor shine, and the butter-baste technique adds richness while building an incredible golden crust.',
    notes: 'Recommend to guests who prefer tenderness over bold flavor. Great for special occasions. Suggest pairing with a full-bodied red wine. The center-cut ensures a uniform shape and even cooking.',
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'Our 8oz Filet Mignon is the most tender steak you\'ll ever have. It\'s center-cut from the tenderloin — the most prized, most tender muscle on the animal. We sear it in cast iron and baste it with butter, thyme, and garlic for this incredible golden crust. The inside is butter-soft, literally melt-in-your-mouth. If you\'re celebrating something special or just love a refined, elegant steak, this is the one.',
      samplePitch: 'For the most tender steak on our menu, the 8oz Filet Mignon is unmatched. It\'s center-cut — that means the very best part of the tenderloin — and we prepare it simply: a beautiful sear in cast iron, basted with butter, thyme, and garlic. The texture is impossibly soft, and the flavor is delicate and refined. It\'s the opposite of our bold ribeye — this is about elegance and tenderness. Perfect with a glass of Bordeaux.',
      teachMe: 'The tenderloin is a long, narrow muscle that runs along the spine. Because this muscle does almost no work during the animal\'s life, it has very little connective tissue, making it the most naturally tender cut. We use the center-cut (the thickest, most uniform part) to ensure even cooking. The cast iron baste technique involves continuously spooning hot butter, thyme, and garlic over the steak as it sears — this builds flavor layers and creates an even, golden-brown crust. Because filet has less marbling than ribeye, the butter baste adds the richness that the lean meat needs.',
      questions: 'Common guest questions:\n\n"Is this more tender than the ribeye?" — Yes, significantly. The filet is the most tender cut on the animal. The ribeye has more fat and bolder flavor, but for pure tenderness, the filet can\'t be beat.\n\n"What temperature should I order?" — Medium-rare is ideal. Since the filet is lean, going above medium can dry it out. Medium-rare keeps it juicy and tender.\n\n"Is 8 ounces enough?" — For a filet, absolutely. It\'s a rich, satisfying portion, especially with a side or two. The density of the cut means 8oz of filet feels more substantial than 8oz of a thinner steak.',
    },
  },
  {
    id: 'dish-6',
    slug: 'grilled-atlantic-salmon',
    name: 'Grilled Atlantic Salmon',
    category: 'entree',
    shortDescription: 'A perfectly grilled 10oz Atlantic salmon fillet with lemon-dill butter sauce. Our go-to recommendation for guests looking beyond steak.',
    keyIngredients: ['Atlantic salmon', 'Lemon-dill butter', 'Seasonal vegetables', 'Olive oil'],
    ingredients: ['Atlantic salmon fillet', 'Lemon juice', 'Fresh dill', 'Clarified butter', 'White wine', 'Olive oil', 'Sea salt', 'Black pepper', 'Seasonal vegetables'],
    allergens: ['fish'],
    flavorProfile: ['Fresh', 'Bright', 'Buttery', 'Herbaceous'],
    allergyNotes: 'Contains fish (salmon). Butter sauce contains dairy — can be served with olive oil and lemon instead. No gluten. Grilled on shared grill — possible cross-contact with shellfish.',
    upsellNotes: 'Pair with Sauvignon Blanc or Pinot Noir. Suggest Creamed Spinach as a side. Great option for guests who want something lighter — position it as elegant, not a consolation prize.',
    detailedDescription: 'Our Grilled Atlantic Salmon is the best non-steak entree on the menu. The 10oz fillet is grilled skin-side down to achieve perfectly crispy skin while the flesh stays moist and flaky. The house lemon-dill butter sauce adds brightness and richness, and the seasonal vegetables round out the plate with color and freshness.',
    notes: 'Best recommendation for non-steak guests. The crispy skin is a highlight — mention it. Pairs beautifully with Sauvignon Blanc or Pinot Noir. Ask about desired doneness — medium is most popular for salmon.',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'If you\'re in the mood for something other than steak tonight, our Grilled Atlantic Salmon is exceptional. It\'s a generous 10-ounce fillet, grilled until the skin is perfectly crispy and the inside is flaky and moist. We finish it with a lemon-dill butter sauce that adds this beautiful brightness. It comes with seasonal vegetables, and it pairs wonderfully with a glass of our Sauvignon Blanc or Pinot Noir.',
      samplePitch: 'Our salmon is one of the best-kept secrets on the menu. It\'s a 10-ounce Atlantic fillet grilled skin-side down for that incredible crispy skin — it\'s almost like a chip on the bottom — while the flesh stays perfectly moist and flaky. The lemon-dill butter sauce ties everything together with a fresh, bright flavor. It\'s the dish I recommend to anyone who wants something lighter but still wants a serious, satisfying entree.',
      teachMe: 'The key to great grilled salmon is temperature control and not moving the fish. Skin-side down on high heat creates a barrier between the flesh and the grill, and the skin renders its fat and crisps beautifully. We don\'t flip it — the heat travels through the fillet from the bottom up. This way, the skin gets crispy while the top stays gently cooked. For a medium result, the thickest part should be slightly translucent in the center — it will carry over in heat. The lemon-dill butter is an emulsion of clarified butter, fresh lemon juice, fresh dill, and a touch of white wine.',
      questions: 'Common guest questions:\n\n"Is it wild or farmed?" — It\'s Atlantic salmon, which is farm-raised. Atlantic salmon has a milder, richer flavor and more consistent quality than wild-caught varieties.\n\n"How should I order it?" — Medium is our most popular doneness for salmon — flaky throughout with a touch of translucency in the center. We can also do it medium-well for those who prefer it fully cooked through.\n\n"What sides go well with it?" — The Creamed Spinach and Loaded Baked Potato are both great choices. For something lighter, the seasonal vegetables it comes with are wonderful.',
    },
  },
  {
    id: 'dish-7',
    slug: 'chicken-fried-steak',
    name: 'Chicken Fried Steak',
    category: 'entree',
    shortDescription: 'A Texas original: hand-breaded, golden-fried steak cutlet smothered in white pepper gravy. Comfort food elevated to steakhouse quality.',
    keyIngredients: ['Tenderized steak cutlet', 'Seasoned breading', 'White pepper gravy', 'Mashed potatoes'],
    ingredients: ['Beef cutlet', 'All-purpose flour', 'Buttermilk', 'Eggs', 'Seasoned salt', 'White pepper', 'Heavy cream', 'Butter', 'Mashed potatoes', 'Canola oil'],
    allergens: ['gluten', 'dairy', 'eggs'],
    flavorProfile: ['Savory', 'Comforting', 'Crispy', 'Peppery'],
    allergyNotes: 'Contains gluten (flour breading), dairy (buttermilk, cream gravy, butter), and eggs (egg wash). Cannot be modified to remove any of these — fundamental to the dish. Fried in shared oil.',
    upsellNotes: 'Pair with an Old Fashioned or sweet tea. Great for first-time visitors wanting a true Texas experience. Suggest adding Crispy Brussels Sprouts to balance the richness.',
    detailedDescription: 'Chicken Fried Steak is Texas comfort food at its finest, and at Alamo Prime, we give it the premium treatment. We start with a quality beef cutlet that\'s hand-tenderized for maximum tenderness, then put it through a double-dredge process for an extra thick, crunchy breading. The white pepper cream gravy is made from scratch using the pan drippings, and the whole thing sits on a bed of our buttery mashed potatoes.',
    notes: 'A Texas essential — this is the most "Texas" dish on the menu. Great recommendation for first-time visitors who want to experience Texas cuisine. The double-dredge technique is what makes our breading superior. Pairs well with an Old Fashioned.',
    image: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400&h=250&fit=crop',
    topSeller: true,
    aiResponses: {
      practicePitch: 'Our Chicken Fried Steak is pure Texas comfort food, done the Alamo Prime way. We take a tender beef cutlet, hand-bread it with our seasoned double-dredge for maximum crunch, fry it golden, and smother it in our house-made white pepper cream gravy. It comes on a bed of buttery mashed potatoes. If you want to experience a true Texas classic elevated to steakhouse quality, this is it.',
      samplePitch: 'If you haven\'t had a real Texas Chicken Fried Steak, tonight\'s your night. We hand-tenderize a quality beef cutlet, put it through our double-dredge breading process for this incredibly thick, crunchy crust, then fry it golden and smother it in our scratch-made white pepper gravy. It sits on creamy mashed potatoes. It\'s indulgent, it\'s comforting, and it\'s one of those dishes that makes you understand why people love Texas food.',
      teachMe: 'Chicken Fried Steak — despite the name — has nothing to do with chicken. The name comes from the cooking method: it\'s steak prepared the same way as fried chicken (breaded and fried). It\'s a staple of Texas and Southern cuisine. Our double-dredge technique is key: seasoned flour first, then a buttermilk-egg wash, then flour again. The second coating creates a thicker, crunchier crust. The white pepper gravy is a béchamel-style sauce made with the pan drippings (the browned bits from frying), cream, butter, and white pepper — white pepper instead of black gives it a milder, more nuanced heat. The dish originated with German and Austrian immigrants who brought the schnitzel technique to Texas in the 1800s.',
      questions: 'Common guest questions:\n\n"Why is it called \'chicken fried\' if it\'s steak?" — Great question. It\'s steak cooked using the same method as fried chicken — breaded and fried. There\'s no chicken in it.\n\n"Is this really a Texas thing?" — Absolutely. Chicken Fried Steak is the unofficial state dish of Texas. We take it seriously here.\n\n"Is the gravy spicy?" — No, the white pepper gives it a warm, gentle heat that\'s much milder than black pepper. It\'s rich, creamy, and savory, not spicy.',
    },
  },

  // ===== SIDES =====
  {
    id: 'dish-8',
    slug: 'loaded-baked-potato',
    name: 'Loaded Baked Potato',
    category: 'side',
    shortDescription: 'A massive Idaho potato, slow-baked until fluffy, loaded with butter, sour cream, cheddar, bacon, and chives. The steakhouse side that never disappoints.',
    keyIngredients: ['Idaho potato', 'Butter', 'Sour cream', 'Cheddar cheese', 'Bacon', 'Chives'],
    ingredients: ['Idaho Russet potato', 'Unsalted butter', 'Sour cream', 'Sharp cheddar cheese', 'Applewood-smoked bacon', 'Fresh chives', 'Olive oil', 'Coarse salt'],
    allergens: ['dairy'],
    flavorProfile: ['Creamy', 'Salty', 'Smoky', 'Comforting'],
    allergyNotes: 'Contains dairy (butter, sour cream, cheddar). Can be modified: no cheese, no sour cream, no bacon. Potato and skin are naturally dairy-free and gluten-free.',
    upsellNotes: 'The #1 side pairing with the Bone-In Ribeye. Suggest alongside any steak. For tables wanting more, suggest adding Mac & Cheese as a second side.',
    detailedDescription: 'Our Loaded Baked Potato is the quintessential steakhouse side. We use oversized Idaho Russet potatoes — known for their fluffy, starchy interior — and bake them low and slow until the skin is salty and crispy and the inside is cloud-like. Then we load it up with everything: real butter, cool sour cream, sharp cheddar that melts into the hot potato, crispy bacon bits, and fresh-snipped chives.',
    notes: 'The most popular side with steaks. Always suggest it alongside the ribeye. The potato is genuinely large — set expectations. Can be modified: no bacon, no cheese, etc.',
    image: 'https://images.unsplash.com/photo-1633436375153-d7045cb93e38?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'Our Loaded Baked Potato is the classic steakhouse side done perfectly. We slow-bake an oversized Idaho potato until the inside is incredibly fluffy and the skin is crispy and salty. Then we load it with butter, sour cream, sharp cheddar, crispy bacon, and fresh chives. It\'s the ideal companion to any of our steaks — that combination of creamy, salty, and rich is just perfect alongside a great cut of beef.',
      samplePitch: 'For your side, I have to recommend the Loaded Baked Potato. We use these massive Idaho potatoes, bake them for over an hour until they\'re perfectly fluffy inside with a crispy salt-crusted skin, and then load them up — butter, sour cream, sharp cheddar, crispy bacon bits, and chives. It\'s generous, it\'s indulgent, and it\'s the reason steakhouses and baked potatoes are an inseparable pair.',
      teachMe: 'Idaho Russet potatoes are the gold standard for baking because of their high starch content. When baked slowly, the starch granules absorb moisture and swell, creating that fluffy, light texture. We rub the skins with oil and coarse salt before baking — the oil crisps the skin and the salt seasons it. Baking at 400°F for 60-75 minutes (depending on size) ensures the interior is fully cooked without turning gummy. The key to a great loaded potato is temperature contrast: hot, fluffy potato meets cold sour cream, melting cheese, and crispy bacon. Each bite should be different.',
      questions: 'Common guest questions:\n\n"How big is it?" — It\'s a full-sized baked potato — think the size of your forearm. It\'s a generous portion.\n\n"Can I get it without bacon?" — Absolutely. We can customize the toppings however you\'d like.\n\n"Is the potato itself good or is it just about the toppings?" — Both. We slow-bake our potatoes for over an hour so the inside is incredibly fluffy and the skin is crispy and seasoned. Even without toppings, it\'s excellent.',
    },
  },
  {
    id: 'dish-9',
    slug: 'creamed-spinach',
    name: 'Creamed Spinach',
    category: 'side',
    shortDescription: 'Velvety creamed spinach with nutmeg, garlic, and Parmesan. The elegant steakhouse side that adds a touch of green to any plate.',
    keyIngredients: ['Baby spinach', 'Heavy cream', 'Parmesan', 'Garlic', 'Nutmeg'],
    ingredients: ['Baby spinach', 'Heavy cream', 'Parmigiano-Reggiano', 'Garlic', 'Unsalted butter', 'All-purpose flour', 'Whole nutmeg', 'Sea salt', 'White pepper'],
    allergens: ['dairy'],
    flavorProfile: ['Creamy', 'Savory', 'Earthy', 'Aromatic'],
    allergyNotes: 'Contains dairy (cream, butter, Parmesan). Flour in béchamel contains gluten — can be made gluten-free with cornstarch on request. No eggs, no nuts.',
    upsellNotes: 'Best paired with the 8oz Filet Mignon — the elegance matches. Also great alongside salmon. Suggest for guests watching carbs as an alternative to potato.',
    detailedDescription: 'Creamed Spinach is the steakhouse side that bridges comfort and elegance. We start by wilting fresh baby spinach in garlic butter, then fold it into a béchamel cream sauce that\'s been perfumed with freshly grated nutmeg — the classic pairing with spinach. A generous amount of Parmigiano-Reggiano adds depth and umami. The result is velvety, rich, and just a little decadent.',
    notes: 'Best paired with filet mignon — the lightness of the spinach balances the richness of the butter-basted filet. Mention the nutmeg — it\'s a distinguishing detail. Can be a good option for guests avoiding carbs as a side.',
    image: 'https://images.unsplash.com/photo-1580013759032-7d2a085e7d73?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'Our Creamed Spinach is a steakhouse classic — baby spinach wilted in garlic butter and folded into a rich, velvety cream sauce with freshly grated nutmeg and Parmigiano-Reggiano. It\'s silky, savory, and adds a beautiful touch of green to your plate. I especially recommend it alongside our filet mignon — the combination is perfect.',
      samplePitch: 'For a side with elegance, our Creamed Spinach is hard to beat. We wilt fresh baby spinach in garlic butter, then fold it into a rich cream sauce with nutmeg and real Parmigiano-Reggiano. The nutmeg is the secret — it\'s the classic pairing with spinach and gives it this warm, aromatic depth. It\'s one of those sides that elevates the entire plate.',
      teachMe: 'Creamed spinach is a French-American steakhouse tradition. The béchamel base (butter, flour, cream) provides the rich, clinging sauce. Nutmeg and spinach are a classic flavor pairing that dates back to Renaissance Italian cooking — the warm, slightly sweet spice cuts through the spinach\'s natural bitterness. We use baby spinach for tenderness and wilt it quickly to preserve its bright color. The Parmigiano-Reggiano is added at the end, off heat, so it melts into the sauce without becoming stringy. The key is balance — creamy enough to be indulgent, but the spinach should still have presence and not be drowned.',
      questions: 'Common guest questions:\n\n"Is it really creamy or more like sautéed spinach?" — It\'s definitely creamy — a rich, velvety sauce coats every leaf. Think classic steakhouse style, not a light sauté.\n\n"Is there a lot of garlic?" — There\'s garlic, but it\'s balanced — more of a background flavor that supports the cream and nutmeg.\n\n"Is this a good low-carb side?" — Yes, it\'s one of the best options on the side menu if you\'re watching carbs. It\'s primarily spinach and cream, no potatoes or bread.',
    },
  },
  {
    id: 'dish-10',
    slug: 'mac-and-cheese',
    name: 'Mac & Cheese',
    category: 'side',
    shortDescription: 'Four-cheese mac & cheese with a golden breadcrumb crust, baked until bubbling. The ultimate comfort side that adults and kids fight over equally.',
    keyIngredients: ['Cavatappi pasta', 'Sharp cheddar', 'Gruyère', 'Fontina', 'Parmesan', 'Breadcrumbs'],
    ingredients: ['Cavatappi pasta', 'Sharp cheddar', 'Gruyère', 'Fontina', 'Parmigiano-Reggiano', 'Panko breadcrumbs', 'Unsalted butter', 'All-purpose flour', 'Whole milk', 'Dried herbs'],
    allergens: ['dairy', 'gluten'],
    flavorProfile: ['Cheesy', 'Rich', 'Nutty', 'Comforting'],
    allergyNotes: 'Contains dairy (four cheeses, butter, milk) and gluten (pasta, flour, breadcrumbs). Cannot be modified to remove either — fundamental to the dish.',
    upsellNotes: 'Second most popular side after baked potato. Universally loved — suggest for tables with kids. Pair with any steak. For indulgent tables, suggest alongside the Loaded Baked Potato for the ultimate side combo.',
    detailedDescription: 'Our Mac & Cheese is what happens when comfort food meets steakhouse quality. We use cavatappi (corkscrew) pasta for maximum sauce grip, and our four-cheese blend creates a sauce that\'s both rich and complex: sharp cheddar for tang, Gruyère for nuttiness, fontina for melt, and Parmesan for depth. The seasoned breadcrumb crust adds a golden, crunchy contrast to the creamy interior.',
    notes: 'Second most popular side after the baked potato. Universally loved — kids, adults, everyone. The four-cheese blend is what makes it special. Comes in a hot baking dish — warn guests it\'s hot.',
    image: 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=400&h=250&fit=crop',
    topSeller: true,
    aiResponses: {
      practicePitch: 'Our Mac & Cheese is a four-cheese masterpiece — sharp cheddar, Gruyère, fontina, and Parmesan, all folded around cavatappi pasta and baked with a golden breadcrumb crust until it\'s bubbling hot. It comes right to the table in the baking dish. It\'s the kind of mac and cheese that makes adults feel like kids again, and it\'s the perfect indulgent side alongside any of our steaks.',
      samplePitch: 'You absolutely need our Mac & Cheese. It\'s not your basic mac — we use four cheeses: sharp cheddar for tang, Gruyère for nuttiness, fontina for that incredible melt, and Parmesan for depth. The pasta is cavatappi, those corkscrew shapes that trap sauce in every turn. And the golden breadcrumb crust on top gives you that satisfying crunch with every bite. It comes out of the oven bubbling in its own dish. It\'s indulgent, it\'s comforting, and it goes with everything.',
      teachMe: 'The four-cheese blend is designed so each cheese contributes something different: sharp cheddar provides tang and color, Gruyère adds a nutty complexity and great melt, fontina brings incredible creaminess without stringiness, and Parmesan adds umami depth. The cheese sauce starts as a béchamel (butter, flour, milk), then the cheeses are added off heat to prevent breaking. Cavatappi pasta is chosen specifically because the corkscrew shape traps sauce both inside the tubes and between the spirals — every bite is fully coated. The breadcrumb crust (panko mixed with melted butter and herbs) creates the textural contrast that elevates it from stovetop mac to a baked, restaurant-quality dish.',
      questions: 'Common guest questions:\n\n"Is this enough for two?" — It\'s a generous side portion, great for one person alongside a steak. For sharing, it works for two, but if the table loves mac and cheese, everyone might want their own.\n\n"What makes it different from regular mac and cheese?" — Four cheeses instead of one, cavatappi pasta for better sauce grip, and a baked breadcrumb crust. It\'s in a different league from boxed mac.\n\n"Is the crust crunchy?" — Yes, the breadcrumb topping is golden and crunchy, which gives a great contrast to the creamy pasta underneath.',
    },
  },

  // ===== DESSERTS =====
  {
    id: 'dish-11',
    slug: 'pecan-pie',
    name: 'Pecan Pie',
    category: 'dessert',
    shortDescription: 'Texas pecan pie with a buttery, flaky crust and caramelized pecan filling. Served warm with a scoop of vanilla bean ice cream. A true Texas dessert.',
    keyIngredients: ['Texas pecans', 'Brown sugar', 'Butter', 'Vanilla', 'Flaky pie crust', 'Vanilla bean ice cream'],
    ingredients: ['Texas pecans', 'Brown sugar', 'Unsalted butter', 'Pure vanilla extract', 'Eggs', 'Corn syrup', 'All-purpose flour', 'Salt', 'Vanilla bean ice cream'],
    allergens: ['tree-nuts', 'gluten', 'dairy', 'eggs'],
    flavorProfile: ['Sweet', 'Nutty', 'Caramelized', 'Warm'],
    allergyNotes: 'Contains tree nuts (pecans), gluten (pie crust), dairy (butter, ice cream), and eggs. Multiple allergens — always confirm with guests. Ice cream can be omitted for dairy-free (pie still contains butter).',
    upsellNotes: 'Pair with coffee, after-dinner bourbon, or a dessert wine. Our most popular dessert — mention it\'s a Texas tradition. Suggest for the whole table to share if they\'re full.',
    detailedDescription: 'Pecan Pie is the ultimate Texas dessert, and ours does it justice. We use locally sourced Texas pecans — known for their large size and rich, buttery flavor. The filling is a brown sugar-butter custard that caramelizes during baking, creating a gooey, toffee-like center with a crunchy pecan layer on top. The crust is made in-house, buttery and flaky, providing the perfect base. Served warm with a scoop of vanilla bean ice cream that melts into the warm pie.',
    notes: 'Most popular dessert on the menu. Emphasize it\'s a Texas tradition. The warm pie with cold ice cream is the key selling point. Great with coffee or after-dinner bourbon.',
    image: 'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=400&h=250&fit=crop',
    topSeller: true,
    aiResponses: {
      practicePitch: 'You have to end your meal with our Pecan Pie — it\'s a Texas tradition and our most popular dessert. We use locally sourced Texas pecans in a rich, caramelized brown sugar filling with a buttery, flaky crust made in-house. We serve it warm with a scoop of vanilla bean ice cream that starts melting the moment it hits the pie. It\'s the perfect sweet finish to a great steak dinner.',
      samplePitch: 'Our Pecan Pie is the dessert I recommend to every table, and for good reason — it\'s our best seller. Texas pecans, brown sugar caramel filling, house-made flaky crust, served warm with vanilla bean ice cream. The contrast between the warm, gooey pie and the cold ice cream is just incredible. It\'s a Texas classic, and we make it exactly the way it should be made. Pairs beautifully with a cup of coffee or even a pour of bourbon.',
      teachMe: 'Pecan pie is deeply tied to Texas identity — Texas is the largest pecan-producing state, and the pecan is the official state tree. Our recipe uses a traditional approach: Texas pecans (larger and more buttery than other varieties), a brown sugar-butter-egg custard base, and pure vanilla extract. The science of the filling is interesting — the eggs and sugar create a custard that sets during baking, while the butter and brown sugar caramelize, creating that signature gooey-toffee texture. The pecans float to the top during baking, forming a crunchy layer. The crust is all-butter (no shortening) for maximum flavor and flakiness. Served warm because the custard filling softens and becomes more syrupy, creating a better contrast with the cold ice cream.',
      questions: 'Common guest questions:\n\n"Is it very sweet?" — It\'s rich and sweet, as pecan pie should be, but the pecans add a savory, nutty balance. The vanilla ice cream also helps temper the sweetness.\n\n"Can I take a slice to go?" — Absolutely, we can box it up for you.\n\n"Is it made in-house?" — Yes, everything — the crust, the filling, all from scratch. We bake our pies fresh daily.',
    },
  },
  {
    id: 'dish-12',
    slug: 'chocolate-lava-cake',
    name: 'Chocolate Lava Cake',
    category: 'dessert',
    shortDescription: 'Individual dark chocolate cake with a molten center that flows when you cut into it. Served with whipped cream and fresh berries. Pure indulgence.',
    keyIngredients: ['Dark chocolate', 'Butter', 'Eggs', 'Whipped cream', 'Fresh berries'],
    ingredients: ['70% cacao dark chocolate', 'Unsalted butter', 'Eggs', 'Sugar', 'All-purpose flour', 'Cocoa powder', 'Heavy cream', 'Seasonal berries', 'Powdered sugar'],
    allergens: ['dairy', 'gluten', 'eggs'],
    flavorProfile: ['Decadent', 'Rich', 'Bittersweet', 'Velvety'],
    allergyNotes: 'Contains dairy (butter, cream), gluten (flour), and eggs. Cannot be modified — all three are structural to the cake. Made in shared kitchen — possible trace nuts.',
    upsellNotes: 'Must be ordered early — 12-minute bake time. Suggest at the start of the entree course. Great for date nights and celebrations. Pair with espresso or dessert wine.',
    detailedDescription: 'Our Chocolate Lava Cake is the grand finale for chocolate lovers. Made with premium dark chocolate, each cake is baked to order in its own ramekin with precise timing — too little and it\'s raw, too much and you lose the lava. When you cut into it, the molten chocolate center flows out like velvet. The fresh whipped cream adds lightness and the berries provide a tart counterpoint to the rich chocolate.',
    notes: 'This takes 12 minutes to bake, so suggest it early in the meal so the kitchen can time it. The "lava moment" when they cut into it is the experience — mention it when selling. Great date-night dessert.',
    image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=250&fit=crop',
    topSeller: false,
    aiResponses: {
      practicePitch: 'Our Chocolate Lava Cake is incredible — it\'s baked to order, so when you cut into it, the center flows out like molten chocolate. We use premium dark chocolate, and it comes with fresh whipped cream and seasonal berries. It does take about 12 minutes to bake, so I\'d recommend ordering it now so it arrives perfectly timed with the end of your meal. It\'s the ultimate dessert for chocolate lovers.',
      samplePitch: 'For dessert, I have to tell you about our Chocolate Lava Cake. It\'s made to order with premium dark chocolate — and the moment you break through the cake with your spoon, this river of molten chocolate flows out. It\'s one of those desserts that actually makes people gasp. We serve it with fresh whipped cream and berries to balance the richness. Fair warning: it takes 12 minutes to bake, so if you\'re interested, let me put the order in now and it\'ll arrive right when you\'re ready.',
      teachMe: 'The Chocolate Lava Cake (also called "Fondant au Chocolat") was popularized by chef Jean-Georges Vongerichten in the 1990s, though some debate its exact origins. The technique relies on precise baking time — the batter is essentially a rich chocolate ganache with just enough flour and egg to set the outside into a cake while the center stays liquid. Our recipe uses 70% cacao dark chocolate for intensity. The individual ramekins are buttered and cocoa-dusted (prevents sticking and adds chocolate flavor). The 12-minute bake time at 425°F is calibrated to our oven — even 60 seconds too long turns it into a regular chocolate cake without the lava. This is why we bake to order — it can\'t sit and wait.',
      questions: 'Common guest questions:\n\n"How long does it take?" — About 12 minutes, since we bake it fresh to order. That\'s why I like to suggest ordering it early so it arrives perfectly timed.\n\n"Is it very rich?" — It\'s definitely indulgent — rich dark chocolate throughout. The whipped cream and berries help lighten it up, and it\'s also great for sharing.\n\n"Can two people share it?" — Absolutely. It\'s a rich dessert, and sharing is very common. We can bring extra spoons.',
    },
  },
];

// --- Exports ---

export const ALL_DISHES: Dish[] = DISHES;

export function getDishBySlug(slug: string): Dish | undefined {
  return DISHES.find(d => d.slug === slug);
}
