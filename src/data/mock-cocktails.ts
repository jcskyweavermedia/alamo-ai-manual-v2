// =============================================================================
// MOCK COCKTAIL DATA
// Hardcoded cocktails for FOH Cocktail Viewer (Phase 1 - no Supabase integration)
// =============================================================================

// --- Types ---

export type CocktailStyle = 'classic' | 'modern' | 'tiki' | 'refresher';

export type CocktailAIAction = 'explainToGuest' | 'samplePitch' | 'foodPairings' | 'questions';

export interface Cocktail {
  // --- Matches DB schema (cocktails table) ---
  id: string;
  name: string;
  style: CocktailStyle;
  glass: string;
  ingredients: string;
  keyIngredients: string;
  procedure: { step: number; instruction: string }[];
  tastingNotes: string;
  description: string;
  notes: string;

  // --- Frontend-only (not in DB, needed for UI) ---
  slug: string;
  image: string;
  topSeller: boolean;
  aiResponses: Record<CocktailAIAction, string>;
}

// --- AI action buttons config ---

export const COCKTAIL_AI_ACTIONS: { key: CocktailAIAction; label: string; icon: string }[] = [
  { key: 'explainToGuest', label: 'Practice a pitch', icon: 'mic' },
  { key: 'samplePitch', label: 'Hear a sample pitch', icon: 'play' },
  { key: 'foodPairings', label: 'Food pairings', icon: 'utensils-crossed' },
  { key: 'questions', label: 'Have any questions?', icon: 'help-circle' },
];

// --- Style config (colors for badges) ---

export const COCKTAIL_STYLE_CONFIG: Record<CocktailStyle, {
  label: string;
  light: string;
  dark: string;
}> = {
  classic: {
    label: 'Classic',
    light: 'bg-amber-100 text-amber-900',
    dark: 'dark:bg-amber-900/30 dark:text-amber-300',
  },
  modern: {
    label: 'Modern',
    light: 'bg-violet-100 text-violet-900',
    dark: 'dark:bg-violet-900/30 dark:text-violet-300',
  },
  tiki: {
    label: 'Tiki',
    light: 'bg-teal-100 text-teal-900',
    dark: 'dark:bg-teal-900/30 dark:text-teal-300',
  },
  refresher: {
    label: 'Refresher',
    light: 'bg-lime-100 text-lime-900',
    dark: 'dark:bg-lime-900/30 dark:text-lime-300',
  },
};

// --- Mock cocktails ---

const COCKTAILS: Cocktail[] = [
  {
    id: 'cocktail-1',
    slug: 'old-fashioned',
    name: 'Old Fashioned',
    style: 'classic',
    glass: 'Rocks',
    keyIngredients: 'Bourbon, Angostura bitters',
    ingredients: '2 oz Bourbon, 0.5 oz Demerara syrup, 2 dashes Angostura bitters, 1 dash Orange bitters, Orange peel',
    procedure: [
      { step: 1, instruction: 'Add Demerara syrup and both bitters to a mixing glass.' },
      { step: 2, instruction: 'Stir briefly to combine the syrup and bitters.' },
      { step: 3, instruction: 'Add bourbon and a large ice cube to a rocks glass.' },
      { step: 4, instruction: 'Stir gently for 30 seconds until well-chilled and diluted.' },
      { step: 5, instruction: 'Express an orange peel over the glass and place it as garnish.' },
    ],
    tastingNotes: 'Rich, warm, and subtly sweet with deep caramel and vanilla from the bourbon. The bitters add layers of baking spice and a hint of citrus, while the Demerara syrup rounds everything into a smooth, lingering finish.',
    description: 'The Old Fashioned is the original cocktail — a direct descendant of the earliest mixed drinks from the early 1800s. It strips cocktail-making to its essence: spirit, sugar, water, and bitters. Bourbon brings warmth and vanilla, while the Demerara syrup and Angostura bitters create a harmonious balance that has endured for over two centuries.',
    notes: 'Use a large, clear ice cube for slow dilution. Express the orange peel oils over the surface for aroma. Avoid muddling fruit — this is a spirit-forward drink. Always stir, never shake.',
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=530&fit=crop',
    topSeller: true,
    aiResponses: {
      explainToGuest: 'This is our Old Fashioned — the original cocktail, dating back to the early 1800s. It\'s beautifully simple: bourbon, a touch of Demerara syrup for sweetness, and Angostura bitters for spice and depth. We build it over a large ice cube for slow dilution, and finish with an expressed orange peel. It\'s warm, rich, and spirit-forward — the kind of drink that never goes out of style.',
      samplePitch: 'The Old Fashioned is our most popular cocktail, and for good reason. We make ours with premium bourbon, Demerara syrup instead of regular simple syrup for extra richness, and a blend of Angostura and orange bitters. It\'s stirred over a single large ice cube so it stays cold without getting watered down. If you appreciate a whiskey-forward drink with just a touch of sweetness and spice, this is the one.',
      foodPairings: 'Excellent alongside our prime ribeye — the bourbon\'s caramel notes complement the charred, fatty richness of the steak beautifully. Also pairs well with smoked meats, a charcuterie board, or dark chocolate desserts. The bitters and citrus peel cut through richness, making it a natural match for bold, savory dishes. Avoid pairing with delicate seafood or light salads.',
      questions: 'Common guest questions:\n\n"What bourbon do you use?" — We use a high-proof bourbon with strong vanilla and caramel character to stand up to the dilution and sweetener.\n\n"Can I get it with rye instead?" — Absolutely. Rye gives it a spicier, drier character. It\'s the original way it was made before bourbon became the standard.\n\n"Why the big ice cube?" — A large cube melts slower than smaller ones, keeping the drink cold without over-diluting. It\'s the key to a properly balanced Old Fashioned that holds up from first sip to last.',
    },
  },
  {
    id: 'cocktail-2',
    slug: 'espresso-martini',
    name: 'Espresso Martini',
    style: 'modern',
    glass: 'Coupe',
    keyIngredients: 'Vodka, Kahlua, Espresso',
    ingredients: '2 oz Vodka, 0.5 oz Kahlua, 1 oz Fresh espresso, 0.25 oz Simple syrup',
    procedure: [
      { step: 1, instruction: 'Pull a fresh espresso shot and let it cool slightly for 30 seconds.' },
      { step: 2, instruction: 'Combine vodka, Kahlua, espresso, and simple syrup in a shaker.' },
      { step: 3, instruction: 'Add ice and shake hard for 15 seconds to build the crema.' },
      { step: 4, instruction: 'Double strain into a chilled coupe glass.' },
      { step: 5, instruction: 'Garnish with three coffee beans on the foam.' },
    ],
    tastingNotes: 'Bold coffee aroma with a velvety crema on top. The palate balances rich espresso bitterness with the smooth sweetness of Kahlua and a clean vodka backbone. Finishes with lingering roasted coffee notes and a subtle mocha sweetness.',
    description: 'Created in 1980s London by bartender Dick Bradsell when a young model asked for something to "wake me up, then mess me up." The Espresso Martini became the defining cocktail of the modern brunch and after-dinner scene. Fresh espresso is the non-negotiable key — it provides the signature crema and bold flavor that pre-made coffee can\'t replicate.',
    notes: 'Always use freshly pulled espresso — cold brew or instant won\'t create the crema. Shake vigorously to aerate the espresso. Chill the coupe glass in advance. The three coffee beans represent health, wealth, and happiness in Italian tradition.',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=530&fit=crop',
    topSeller: true,
    aiResponses: {
      explainToGuest: 'This is our Espresso Martini — a modern classic created in 1980s London. We make it with fresh-pulled espresso, premium vodka, and Kahlua, shaken hard to build that beautiful crema on top. It\'s bold, rich, and perfectly balanced between coffee bitterness and smooth sweetness. Think of it as the best after-dinner pick-me-up — elegant, energizing, and delicious.',
      samplePitch: 'Our Espresso Martini is one of our most requested cocktails, and we make it the right way — with freshly pulled espresso, not cold brew or concentrate. The hard shake creates that signature velvet foam on top, and the Kahlua adds just enough sweetness to balance the espresso\'s bitterness without making it cloying. It\'s the perfect transition from dinner to the rest of your evening.',
      foodPairings: 'A natural after-dinner companion to our chocolate desserts — the coffee notes amplify rich dark chocolate beautifully. Also works surprisingly well with tiramisu (obviously), crème brûlée, or a cheese course featuring aged Gouda or Manchego. Some guests even enjoy it alongside our dessert appetizers. The coffee-forward character makes it a versatile end-of-meal choice.',
      questions: 'Common guest questions:\n\n"Will this keep me up all night?" — It has about the same caffeine as a single shot of espresso, so it\'s comparable to an after-dinner coffee. You\'ll get a nice lift without being wired.\n\n"Is it very sweet?" — No, we keep it on the drier side. The Kahlua adds just enough sweetness to balance the espresso\'s bitterness, but it\'s not a dessert drink.\n\n"Why three coffee beans?" — It\'s an Italian tradition — the three beans represent health, wealth, and happiness. Plus they look beautiful on that crema.',
    },
  },
  {
    id: 'cocktail-3',
    slug: 'mai-tai',
    name: 'Mai Tai',
    style: 'tiki',
    glass: 'Rocks',
    keyIngredients: 'Aged rum, Orgeat, Dark rum',
    ingredients: '2 oz Aged rum, 1 oz Lime juice, 0.5 oz Orange curacao, 0.5 oz Orgeat, 0.5 oz Dark rum (float), Mint sprig',
    procedure: [
      { step: 1, instruction: 'Combine aged rum, lime juice, orange curacao, and orgeat in a shaker.' },
      { step: 2, instruction: 'Add ice and shake vigorously for 12 seconds.' },
      { step: 3, instruction: 'Strain over crushed ice in a rocks glass.' },
      { step: 4, instruction: 'Gently float the dark rum on top by pouring over the back of a spoon.' },
      { step: 5, instruction: 'Garnish with a fresh mint sprig.' },
      { step: 6, instruction: 'Add a spent lime shell and a cocktail straw.' },
    ],
    tastingNotes: 'Tropical and complex with layers of aged rum warmth, bright citrus acidity, and the distinctive almond sweetness of orgeat. The dark rum float adds a molasses-rich top note, while the mint garnish provides an aromatic lift with every sip.',
    description: 'Invented by Trader Vic Bergeron in 1944 at his Oakland restaurant, the Mai Tai is the crown jewel of tiki cocktails. Legend has it that after tasting the first one, a Tahitian friend exclaimed "Mai tai roa ae!" — meaning "Out of this world!" The drink showcases rum at its most nuanced, balanced by orgeat\'s almond sweetness and fresh citrus. A properly made Mai Tai is nothing like the syrupy fruit-punch versions found at tourist bars.',
    notes: 'Use quality aged rum — the rum does the heavy lifting. Orgeat (almond syrup) is essential and not substitutable. Fresh lime juice only. The dark rum float creates visual drama and adds complexity as the guest sips. Crushed ice is critical for proper dilution and temperature.',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&h=530&fit=crop',
    topSeller: false,
    aiResponses: {
      explainToGuest: 'This is our Mai Tai — the king of tiki cocktails, invented by Trader Vic in 1944. Forget the neon-colored versions you might have had on vacation. A real Mai Tai is all about great rum, fresh lime, orange curacao, and orgeat — that\'s an almond syrup that gives it a beautiful nutty sweetness. We float dark rum on top for extra complexity. It\'s tropical but sophisticated, and it\'ll transport you straight to a Polynesian beach.',
      samplePitch: 'Our Mai Tai is the real deal — made the way Trader Vic intended it. We use quality aged rum as the base for depth and warmth, balance it with fresh lime and orgeat almond syrup, and float dark rum on top for that gorgeous layered look and extra richness. It\'s tropical without being sugary, complex without being complicated, and it\'s one of the most satisfying cocktails we serve. If you\'ve only had the tourist version, this will change your mind about Mai Tais.',
      foodPairings: 'Fantastic with our Asian-inspired appetizers — the rum and orgeat love ginger, soy, and sesame flavors. Also pairs beautifully with grilled shrimp, poke bowls, or coconut-based curries. The tropical character naturally complements seafood and Pacific Rim cuisine. For something unexpected, try it with spicy dishes — the sweetness and citrus tame the heat beautifully.',
      questions: 'Common guest questions:\n\n"Is this going to be really sweet and fruity?" — Not at all. A proper Mai Tai is actually quite balanced and spirit-forward. It\'s rum-driven with just enough sweetness from the orgeat and curacao. Nothing like the neon versions at beach bars.\n\n"What\'s orgeat?" — It\'s an almond syrup with a hint of orange blossom water. It gives the Mai Tai its distinctive nutty, silky character. It\'s the secret ingredient that makes a Mai Tai a Mai Tai.\n\n"What rum do you use?" — We use a quality aged rum for the base and a rich dark rum for the float. The combination gives you both complexity and that beautiful layered look.',
    },
  },
  {
    id: 'cocktail-4',
    slug: 'penicillin',
    name: 'Penicillin',
    style: 'modern',
    glass: 'Rocks',
    keyIngredients: 'Blended Scotch, Islay Scotch, Honey-ginger',
    ingredients: '2 oz Blended Scotch, 0.75 oz Lemon juice, 0.75 oz Honey-ginger syrup, 0.25 oz Islay Scotch (float), Candied ginger',
    procedure: [
      { step: 1, instruction: 'Combine blended Scotch, lemon juice, and honey-ginger syrup in a shaker.' },
      { step: 2, instruction: 'Add ice and shake vigorously for 12 seconds.' },
      { step: 3, instruction: 'Strain over fresh ice in a rocks glass.' },
      { step: 4, instruction: 'Carefully float the Islay Scotch on top.' },
      { step: 5, instruction: 'Garnish with a piece of candied ginger on a pick.' },
    ],
    tastingNotes: 'Warm honey and fresh ginger spice upfront, with a smooth Scotch backbone and bright lemon acidity. The Islay float adds a dramatic smoky whisper that lingers on the nose and palate, creating depth that evolves with every sip.',
    description: 'Created by Sam Ross at Milk & Honey in New York City around 2005, the Penicillin has become the most acclaimed modern cocktail of the 21st century. It brilliantly combines blended Scotch with honey-ginger syrup and fresh lemon, then tops it with a float of peaty Islay Scotch for a smoky aromatic finish. Named playfully as a "cure-all," it genuinely tastes like the best possible remedy on a cold evening.',
    notes: 'The honey-ginger syrup is made by simmering fresh ginger in honey and water. The Islay float is essential — it provides the smoky nose that defines the drink. Use a good blended Scotch (not single malt) as the base. Always fresh lemon juice.',
    image: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=530&fit=crop',
    topSeller: false,
    aiResponses: {
      explainToGuest: 'This is a Penicillin — the most celebrated modern cocktail, created in New York around 2005. It\'s built on blended Scotch with fresh lemon and house-made honey-ginger syrup, then finished with a float of smoky Islay Scotch on top. The name is playful — it\'s meant to be the perfect cure-all. That smoky aroma when you lean in, combined with the warm honey-ginger, makes it absolutely irresistible, especially on a cool evening.',
      samplePitch: 'The Penicillin is our bartender\'s favorite modern classic — it took the cocktail world by storm when Sam Ross created it at the legendary Milk & Honey bar in NYC. We shake blended Scotch with fresh lemon juice and house-made honey-ginger syrup, then float a touch of peaty Islay Scotch on top. That smoke on the nose combined with the warm ginger and honey is just incredible. If you like whiskey but want something more complex than an Old Fashioned, this is your drink.',
      foodPairings: 'Perfect alongside smoked meats or our charcuterie board — the smoky Islay float echoes the char and smoke flavors beautifully. Also wonderful with roasted lamb, grilled salmon, or sharp aged cheddar. The honey-ginger element works particularly well with Asian-influenced dishes. For dessert, try it with ginger or honey-based sweets.',
      questions: 'Common guest questions:\n\n"I don\'t usually like Scotch — will I like this?" — Yes! The honey-ginger syrup and fresh lemon completely transform the Scotch into something approachable and delicious. It\'s converted many Scotch skeptics.\n\n"What makes Islay Scotch different?" — Islay (eye-luh) Scotch is known for its intense smoky, peaty character — like a campfire by the sea. We only use a small float on top, so you get the aroma without it being overwhelming.\n\n"Is this sweet?" — It\'s balanced. The honey-ginger provides warmth and body but the fresh lemon keeps it from being sweet. It\'s closer to a sour than a sweet cocktail.',
    },
  },
  {
    id: 'cocktail-5',
    slug: 'paloma',
    name: 'Paloma',
    style: 'refresher',
    glass: 'Highball',
    keyIngredients: 'Tequila blanco, Grapefruit',
    ingredients: '2 oz Tequila blanco, 2 oz Fresh grapefruit juice, 0.5 oz Lime juice, 0.5 oz Agave nectar, 2 oz Club soda',
    procedure: [
      { step: 1, instruction: 'Salt half the rim of a highball glass.' },
      { step: 2, instruction: 'Fill the glass with fresh ice.' },
      { step: 3, instruction: 'Add tequila, grapefruit juice, lime juice, and agave nectar.' },
      { step: 4, instruction: 'Top with club soda and stir gently to combine.' },
      { step: 5, instruction: 'Garnish with a grapefruit wedge.' },
    ],
    tastingNotes: 'Bright and effervescent with juicy grapefruit upfront and clean tequila agave character. The lime adds a citrus edge while the agave nectar provides a smooth sweetness. The salt rim amplifies every flavor, and the soda keeps it light and crushable.',
    description: 'The Paloma is Mexico\'s most popular tequila cocktail — far outselling the Margarita in its homeland. The name means "dove" in Spanish, reflecting its gentle, approachable character. While the traditional Mexican version uses Squirt or Jarritos grapefruit soda, our version uses fresh grapefruit juice and club soda for a cleaner, brighter flavor. It\'s the quintessential warm-weather drink: refreshing, easy-going, and endlessly drinkable.',
    notes: 'Use 100% agave tequila blanco for clean, bright agave flavor. Fresh grapefruit juice is essential — canned or bottled tastes flat. The half-salt rim lets guests choose their sip. Build in the glass — no shaking required. Tall ice keeps it cold and bubbly.',
    image: 'https://images.unsplash.com/photo-1560512823-829485b8bf24?w=400&h=530&fit=crop',
    topSeller: false,
    aiResponses: {
      explainToGuest: 'This is our Paloma — it means "dove" in Spanish, and it\'s actually the most popular tequila cocktail in Mexico, even more than the Margarita. We make ours with fresh grapefruit juice, a squeeze of lime, a touch of agave nectar, and top it with soda over ice. It\'s incredibly refreshing, bright, and easy-drinking. The half-salt rim gives you the option of a salty sip or a clean one. It\'s like sunshine in a glass.',
      samplePitch: 'The Paloma is our go-to recommendation for anyone who loves tequila but wants something lighter and more refreshing than a Margarita. We use fresh-squeezed grapefruit juice — not the bottled stuff — with quality blanco tequila, a touch of lime and agave, and top it with soda. The half-salt rim is a nice touch because you can alternate between salty and clean sips. It\'s the most popular tequila drink in all of Mexico for a reason — once you try a well-made one, you\'ll understand.',
      foodPairings: 'A dream alongside our fish tacos, ceviche, or any citrus-forward dish. The grapefruit and tequila complement grilled seafood beautifully. Also wonderful with spicy food — the effervescence and citrus calm the heat while the salt amplifies flavor. Works with everything from guacamole and chips to grilled chicken or a light summer salad. It\'s one of the most food-friendly cocktails on our menu.',
      questions: 'Common guest questions:\n\n"How is this different from a Margarita?" — A Margarita is lime-forward, often shaken, and richer. The Paloma is grapefruit-based, built in the glass with soda, and much lighter and more refreshing. Think of it as the casual, everyday cousin to the Margarita.\n\n"Is it very grapefruity?" — It\'s bright and citrusy but not overpowering. The tequila and agave balance the grapefruit, and the soda lightens everything up. If you enjoy grapefruit at all, you\'ll love it.\n\n"Why only half the rim salted?" — So you can choose your experience. Salty sips on one side, clean on the other. It keeps every taste a little different.',
    },
  },
];

// --- Exports ---

export const ALL_COCKTAILS: Cocktail[] = COCKTAILS;

export function getCocktailBySlug(slug: string): Cocktail | undefined {
  return COCKTAILS.find(c => c.slug === slug);
}
