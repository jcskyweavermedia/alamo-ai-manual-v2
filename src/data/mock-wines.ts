// =============================================================================
// MOCK WINE DATA
// Hardcoded wines for FOH Wine Viewer (Phase 1 - no Supabase integration)
// =============================================================================

// --- Types ---

export type WineStyle = 'red' | 'white' | 'rosé' | 'sparkling';

export type WineBody = 'light' | 'medium' | 'full';

export type WineAIAction = 'explainToGuest' | 'wineDetails' | 'foodPairings' | 'questions';

export interface Wine {
  id: string;
  slug: string;
  name: string;
  producer: string;
  region: string;
  country: string;
  vintage: string | null; // null for NV
  style: WineStyle;
  body: WineBody;
  grape: string;
  isBlend: boolean;
  image: string;
  tastingNotes: string;
  producerStory: string;
  notes: string;
  topSeller: boolean;
  aiResponses: Record<WineAIAction, string>;
}

// --- AI action buttons config ---

export const WINE_AI_ACTIONS: { key: WineAIAction; label: string; icon: string }[] = [
  { key: 'explainToGuest', label: 'Practice a pitch', icon: 'mic' },
  { key: 'wineDetails', label: 'Hear a sample pitch', icon: 'play' },
  { key: 'foodPairings', label: 'Food pairings', icon: 'utensils-crossed' },
  { key: 'questions', label: 'Have any questions?', icon: 'help-circle' },
];

// --- Style config (colors for badges) ---

export const WINE_STYLE_CONFIG: Record<WineStyle, {
  label: string;
  light: string;
  dark: string;
  textColor: string;
}> = {
  red: {
    label: 'Red',
    light: 'bg-red-100 text-red-900',
    dark: 'dark:bg-red-900/30 dark:text-red-300',
    textColor: 'text-red-700 dark:text-red-400',
  },
  white: {
    label: 'White',
    light: 'bg-amber-50 text-amber-800',
    dark: 'dark:bg-amber-900/20 dark:text-amber-300',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  rosé: {
    label: 'Rosé',
    light: 'bg-pink-100 text-pink-800',
    dark: 'dark:bg-pink-900/30 dark:text-pink-300',
    textColor: 'text-pink-700 dark:text-pink-400',
  },
  sparkling: {
    label: 'Sparkling',
    light: 'bg-sky-50 text-sky-800',
    dark: 'dark:bg-sky-900/30 dark:text-sky-300',
    textColor: 'text-sky-700 dark:text-sky-400',
  },
};

// --- Mock wines ---

const WINES: Wine[] = [
  {
    id: 'wine-1',
    slug: 'chateau-margaux-2018',
    name: 'Château Margaux 2018',
    producer: 'Château Margaux',
    region: 'Margaux, Bordeaux',
    country: 'France',
    vintage: '2018',
    style: 'red',
    body: 'full',
    grape: 'Cabernet Sauvignon blend',
    isBlend: true,
    image: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32e6?w=400&h=600&fit=crop',
    tastingNotes:
      'Deep garnet with violet rim. Aromas of blackcurrant, cedar, and violet lead into a palate of cassis, graphite, and subtle tobacco. Silky tannins with extraordinary length and precision.',
    producerStory:
      'First Growth Bordeaux estate with history dating to 1590, Château Margaux was classified in the legendary 1855 Classification and has remained at the pinnacle of fine wine ever since. The estate spans 262 hectares in the prestigious Margaux appellation, where gravelly soils and a unique microclimate produce wines of extraordinary finesse. Under the direction of Paul Pontallier and now Philippe Bascaules, the château consistently crafts some of the world\'s most refined and age-worthy wines, blending power with an almost ethereal elegance.',
    notes:
      'Pair with prime ribeye or rack of lamb. Serve at 64°F. Decant 1 hour before service. Glass: Bordeaux.',
    topSeller: true,
    aiResponses: {
      explainToGuest: 'This is a Château Margaux 2018 — one of the five legendary First Growth estates from Bordeaux, France. The 2018 vintage is considered exceptional, with rich dark fruit flavors, silky tannins, and incredible complexity. It\'s the kind of wine that collectors dream about. Think of it as the Rolls-Royce of red wine — refined, powerful, and unforgettable.',
      wineDetails: 'Château Margaux 2018\nRegion: Margaux, Bordeaux, France\nGrapes: Cabernet Sauvignon (90%), Merlot (7%), Petit Verdot (2%), Cabernet Franc (1%)\nAlcohol: 13.5%\nAging: 24 months in new French oak barrels\nClassification: First Growth (Premier Grand Cru Classé, 1855)\nCellar potential: 40-60+ years\nCritic scores: 99-100 pts across major publications',
      foodPairings: 'Perfect with our prime ribeye — the marbling matches the wine\'s richness beautifully. Also excellent with rack of lamb with herb crust, filet mignon with truffle butter, or aged cheeses like Comté or Parmigiano-Reggiano. Avoid pairing with heavily spiced dishes or anything too acidic, as it would clash with the wine\'s elegance.',
      questions: 'Common guest questions:\n\n"Why is this wine so expensive?" — Château Margaux is one of only five First Growth estates, a classification that hasn\'t changed since 1855. Limited production and global demand drive the price.\n\n"Should we decant it?" — Absolutely. Give it at least an hour in a decanter to open up. It will transform in the glass.\n\n"How long can I cellar this?" — The 2018 will age gracefully for 40-60+ years, though it\'s already showing beautifully.',
    },
  },
  {
    id: 'wine-2',
    slug: 'cloudy-bay-sauvignon-blanc-2023',
    name: 'Cloudy Bay Sauvignon Blanc 2023',
    producer: 'Cloudy Bay',
    region: 'Marlborough',
    country: 'New Zealand',
    vintage: '2023',
    style: 'white',
    body: 'light',
    grape: 'Sauvignon Blanc',
    isBlend: false,
    image: 'https://images.unsplash.com/photo-1566754436898-857ef05c9cd7?w=400&h=600&fit=crop',
    tastingNotes:
      'Pale straw with green glints. Vibrant aromas of passionfruit, citrus zest, and freshly cut grass. Crisp and refreshing with a mineral finish that lingers beautifully.',
    producerStory:
      'Founded in 1985 in Marlborough, Cloudy Bay was one of the first wineries to prove that New Zealand could produce world-class Sauvignon Blanc. Named after the bay at the tip of the South Island first charted by Captain Cook in 1770, the winery quickly became a cult favorite in London and New York. Today owned by LVMH, Cloudy Bay continues to set the benchmark for vibrant, fruit-driven Sauvignon Blanc, while its estate vineyards in the Wairau Valley benefit from cool ocean breezes and long sunny days.',
    notes:
      'Pair with oysters, ceviche, or goat cheese salad. Serve at 46°F. No decanting needed. Glass: White wine or universal.',
    topSeller: false,
    aiResponses: {
      explainToGuest: 'This is a Cloudy Bay Sauvignon Blanc 2023 from Marlborough, New Zealand — one of the most famous white wines in the world. It\'s incredibly fresh and vibrant, bursting with tropical fruit and citrus flavors. Think passionfruit, grapefruit, and a hint of fresh-cut grass. It\'s light, crisp, and perfect for a warm evening or as a starter wine.',
      wineDetails: 'Cloudy Bay Sauvignon Blanc 2023\nRegion: Marlborough, New Zealand\nGrape: 100% Sauvignon Blanc\nAlcohol: 13.0%\nAging: Stainless steel tanks, brief lees contact\nVineyard: Estate vineyards in the Wairau Valley\nOwnership: LVMH (Moët Hennessy Louis Vuitton)\nStyle: Crisp, aromatic, fruit-forward\nCellar potential: Best enjoyed within 2-3 years',
      foodPairings: 'A natural match for our raw bar — oysters, shrimp cocktail, or ceviche. The bright acidity cuts through richness beautifully. Also pairs well with goat cheese salad, grilled fish tacos, sushi, or a light pasta with lemon and herbs. For something unexpected, try it with Thai green curry — the tropical fruit echoes the dish\'s aromatics.',
      questions: 'Common guest questions:\n\n"Is this sweet?" — No, it\'s completely dry despite the fruity aromas. The tropical notes come from the grape and climate, not residual sugar.\n\n"What makes New Zealand Sauvignon Blanc different?" — The cool maritime climate gives NZ Sauv Blanc more intense aromatics and higher acidity compared to French or California versions.\n\n"Do you have anything similar but different?" — If they enjoy this style, suggest our rosé for something lighter, or ask if they\'d like to try a crisp Chablis.',
    },
  },
  {
    id: 'wine-3',
    slug: 'whispering-angel-rose-2023',
    name: 'Whispering Angel Rosé 2023',
    producer: "Château d'Esclans",
    region: 'Provence',
    country: 'France',
    vintage: '2023',
    style: 'rosé',
    body: 'light',
    grape: 'Grenache / Rolle blend',
    isBlend: true,
    image: 'https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=400&h=600&fit=crop',
    tastingNotes:
      'Delicate pale pink with salmon hues. Aromas of fresh strawberry, white peach, and rose petal. Light-bodied and elegant with a crisp, dry finish and subtle minerality.',
    producerStory:
      "Château d'Esclans is a historic estate nestled in the hills of Provence, with roots tracing back to the Gallo-Roman era. In 2006, Sacha Lichine — son of legendary Bordeaux figure Alexis Lichine — purchased the property and transformed it into the world's most recognized rosé producer. Whispering Angel, the estate's flagship, single-handedly ignited the global Provence rosé revolution, proving that pink wine could be sophisticated, serious, and universally loved.",
    notes:
      'Pair with Mediterranean appetizers, grilled shrimp, or light salads. Serve at 48°F. No decanting needed. Glass: White wine.',
    topSeller: false,
    aiResponses: {
      explainToGuest: "This is Whispering Angel Rosé 2023 from Provence, France — probably the most famous rosé in the world right now. It's pale pink, bone dry, and beautifully elegant. You'll get delicate strawberry and white peach flavors with a refreshing, crisp finish. It's named after the angel carvings in the estate's chapel ceiling. Light, chic, and perfect for any occasion.",
      wineDetails: "Whispering Angel Rosé 2023\nRegion: Côtes de Provence, France\nGrapes: Grenache, Cinsault, Rolle (Vermentino)\nAlcohol: 13.0%\nAging: Stainless steel, temperature-controlled\nEstate: Château d'Esclans (est. Gallo-Roman era)\nWinemaker: Sacha Lichine\nStyle: Pale, dry, elegant Provençal rosé\nCellar potential: Drink within 1-2 years for freshness",
      foodPairings: "Pairs beautifully with our Mediterranean appetizers — bruschetta, grilled shrimp, or a Niçoise salad. Also lovely with seared scallops, grilled chicken with herbs, or a charcuterie board. The wine's light body and dry finish make it incredibly versatile. For a simple pairing, even a bowl of mixed olives and fresh bread works wonderfully.",
      questions: "Common guest questions:\n\n\"Why is it so pale?\" — Provence rosés are made with minimal skin contact, giving them that signature pale, almost translucent color. Deeper color doesn't mean better quality.\n\n\"Is this a sweet wine?\" — Not at all. Despite its light pink color, it's completely dry. The fruitiness comes from the grape aromas, not sugar.\n\n\"What does 'Whispering Angel' mean?\" — It's named after the carved angels on the 19th-century chapel ceiling at Château d'Esclans. Sacha Lichine felt the angels were whispering to him.",
    },
  },
  {
    id: 'wine-4',
    slug: 'veuve-clicquot-yellow-label-brut-nv',
    name: 'Veuve Clicquot Yellow Label Brut NV',
    producer: 'Veuve Clicquot',
    region: 'Champagne',
    country: 'France',
    vintage: null,
    style: 'sparkling',
    body: 'medium',
    grape: 'Pinot Noir / Chardonnay / Pinot Meunier',
    isBlend: true,
    image: 'https://images.unsplash.com/photo-1594372365401-3b5ff14eaaed?w=400&h=600&fit=crop',
    tastingNotes:
      'Golden-yellow with fine, persistent bubbles. Aromas of brioche, apple, and white flowers. Rich and toasty on the palate with stone fruit, honey, and a balanced, lingering finish.',
    producerStory:
      'Founded in 1772 in Reims, Veuve Clicquot is one of the oldest and most prestigious Champagne houses in the world. The house owes its legend to Madame Barbe-Nicole Clicquot, who took over the business at age 27 after her husband\'s death and invented the riddling technique (remuage) that made clear, sparkling Champagne possible. Her motto — "Only one quality, the finest" — still guides production today, and the iconic yellow label has become one of the most recognized symbols of celebration worldwide.',
    notes:
      'Pair with raw bar, smoked salmon, or as an aperitif. Serve at 47°F. No decanting — keep in ice bucket. Glass: Flute or tulip.',
    topSeller: true,
    aiResponses: {
      explainToGuest: 'This is Veuve Clicquot Yellow Label Brut — one of the most iconic Champagnes in the world. It\'s a non-vintage blend, meaning the winemaker combines wines from multiple years to maintain a consistent house style. You\'ll taste toasty brioche, crisp apple, and honey notes with beautifully fine bubbles. Named after Madame Clicquot, who revolutionized Champagne-making in the early 1800s.',
      wineDetails: 'Veuve Clicquot Yellow Label Brut NV\nRegion: Champagne, France\nGrapes: Pinot Noir (50-55%), Chardonnay (28-33%), Pinot Meunier (15-20%)\nDosage: 9-10 g/L (Brut)\nAging: Minimum 30 months on lees (house ages longer)\nReserve wines: 25-35% from previous vintages\nAlcohol: 12.0%\nFounder: Philippe Clicquot (1772)\nStyle: Rich, toasty, balanced Champagne',
      foodPairings: 'Wonderful as an aperitif on its own, or pair with our raw bar — oysters, shrimp, and crab. The toasty richness also complements smoked salmon, lobster bisque, or fried appetizers like tempura. For a classic luxury pairing, serve with caviar. The wine\'s acidity and bubbles cut through rich, fatty dishes beautifully.',
      questions: 'Common guest questions:\n\n"What does NV mean?" — Non-Vintage. The winemaker blends wines from multiple harvests to create a consistent house style year after year. It\'s actually more complex to make than vintage Champagne.\n\n"Should I get a flute or a coupe?" — We serve it in a tulip glass, which gives you the best of both worlds — you see the bubbles like a flute but get better aromatics like a wider glass.\n\n"Is this good enough for a celebration?" — Absolutely. Veuve Clicquot is world-class Champagne. It\'s been the toast of celebrations since Napoleon\'s era.',
    },
  },
  {
    id: 'wine-5',
    slug: 'erath-pinot-noir-2021',
    name: 'Erath Pinot Noir 2021',
    producer: 'Erath Winery',
    region: 'Willamette Valley, Oregon',
    country: 'USA',
    vintage: '2021',
    style: 'red',
    body: 'medium',
    grape: 'Pinot Noir',
    isBlend: false,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=600&fit=crop',
    tastingNotes:
      'Ruby red with garnet edge. Aromas of ripe cherry, raspberry, and warm baking spice. Medium-bodied with soft tannins, bright acidity, and a smooth, earthy finish.',
    producerStory:
      'Dick Erath was a true pioneer who planted some of the first Pinot Noir vines in Oregon\'s Willamette Valley back in 1968, when most people thought quality wine couldn\'t be made outside California. His gamble paid off spectacularly — the region is now considered one of the world\'s premier Pinot Noir appellations. Today, Erath Winery remains one of the most respected producers in the valley, crafting wines that balance approachability with the complex earthy character that makes Oregon Pinot so distinctive.',
    notes:
      'Pair with grilled salmon, duck breast, or mushroom risotto. Serve at 58°F. Light decanting optional (30 min). Glass: Burgundy.',
    topSeller: false,
    aiResponses: {
      explainToGuest: 'This is an Erath Pinot Noir 2021 from Oregon\'s Willamette Valley — one of the best regions in the world for this grape. It\'s medium-bodied with beautiful cherry and raspberry flavors, a touch of spice, and a smooth, earthy finish. Pinot Noir is known as the "heartbreak grape" because it\'s notoriously difficult to grow, but Oregon nails it. This is an elegant, food-friendly red that won\'t overpower your meal.',
      wineDetails: 'Erath Pinot Noir 2021\nRegion: Willamette Valley, Oregon, USA\nGrape: 100% Pinot Noir\nAlcohol: 13.5%\nAging: 10 months in French oak (20% new)\nVineyard: Estate and sourced fruit from Dundee Hills\nFounder: Dick Erath (1968, pioneer of Oregon wine)\nStyle: Elegant, fruit-forward with earthy complexity\nCellar potential: 5-8 years, drinking well now',
      foodPairings: 'Exceptional with our grilled salmon — the earthy Pinot and rich fish are a classic Pacific Northwest pairing. Also beautiful with duck breast, mushroom risotto, roasted chicken, or pork tenderloin. Pinot Noir is one of the most versatile food wines. For cheese, try it with Gruyère or a mild Brie. Avoid pairing with very heavy, spicy dishes.',
      questions: 'Common guest questions:\n\n"How is Oregon Pinot different from Burgundy?" — Oregon Pinot tends to be a bit more fruit-forward with ripe cherry flavors, while Burgundy leans earthier and more mineral. Both are elegant, but Oregon is more approachable young.\n\n"Is this a light wine?" — It\'s medium-bodied — lighter than a Cabernet but with more depth than you might expect. The soft tannins make it very smooth and easy to drink.\n\n"What temperature should this be?" — Slightly cool, around 58°F. Too warm and it loses its freshness; too cold and the flavors hide. We serve it at the right temp.',
    },
  },
];

// --- Exports ---

export const ALL_WINES: Wine[] = WINES;

export function getWineBySlug(slug: string): Wine | undefined {
  return WINES.find(w => w.slug === slug);
}
