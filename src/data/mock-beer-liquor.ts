// =============================================================================
// MOCK BEER & LIQUOR DATA
// Hardcoded items for FOH Beer & Liquor Viewer (Phase 1 - no Supabase integration)
// Simple awareness catalog — no images, no AI, no procedures.
// =============================================================================

// --- Types ---

export type BeerLiquorCategory = 'Beer' | 'Liquor';

export type BeerSubcategory = 'Bock' | 'Lager' | 'Vienna Lager' | 'Blonde Ale' | 'Wheat' | 'Stout';

export type LiquorSubcategory = 'Bourbon' | 'Scotch' | 'Tequila' | 'Gin' | 'Vodka' | 'Rum';

export type BeerLiquorSubcategory = BeerSubcategory | LiquorSubcategory;

export interface BeerLiquorItem {
  id: string;
  slug: string;
  name: string;
  category: BeerLiquorCategory;
  subcategory: BeerLiquorSubcategory;
  producer: string;
  country: string;
  description: string;
  style: string;
  notes: string;
}

// --- Subcategory badge colors ---

export const BEER_LIQUOR_SUBCATEGORY_CONFIG: Record<BeerLiquorSubcategory, {
  label: string;
  light: string;
  dark: string;
}> = {
  Bock: {
    label: 'Bock',
    light: 'bg-amber-100 text-amber-900',
    dark: 'dark:bg-amber-900/30 dark:text-amber-300',
  },
  Lager: {
    label: 'Lager',
    light: 'bg-yellow-50 text-yellow-800',
    dark: 'dark:bg-yellow-900/20 dark:text-yellow-300',
  },
  'Vienna Lager': {
    label: 'Vienna Lager',
    light: 'bg-orange-100 text-orange-800',
    dark: 'dark:bg-orange-900/30 dark:text-orange-300',
  },
  'Blonde Ale': {
    label: 'Blonde Ale',
    light: 'bg-lime-50 text-lime-800',
    dark: 'dark:bg-lime-900/20 dark:text-lime-300',
  },
  Wheat: {
    label: 'Wheat',
    light: 'bg-sky-50 text-sky-800',
    dark: 'dark:bg-sky-900/20 dark:text-sky-300',
  },
  Stout: {
    label: 'Stout',
    light: 'bg-slate-200 text-slate-900',
    dark: 'dark:bg-slate-800/50 dark:text-slate-300',
  },
  Bourbon: {
    label: 'Bourbon',
    light: 'bg-orange-100 text-orange-900',
    dark: 'dark:bg-orange-900/30 dark:text-orange-300',
  },
  Scotch: {
    label: 'Scotch',
    light: 'bg-amber-100 text-amber-900',
    dark: 'dark:bg-amber-900/30 dark:text-amber-300',
  },
  Tequila: {
    label: 'Tequila',
    light: 'bg-emerald-100 text-emerald-900',
    dark: 'dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  Gin: {
    label: 'Gin',
    light: 'bg-cyan-50 text-cyan-800',
    dark: 'dark:bg-cyan-900/20 dark:text-cyan-300',
  },
  Vodka: {
    label: 'Vodka',
    light: 'bg-slate-100 text-slate-800',
    dark: 'dark:bg-slate-800/40 dark:text-slate-300',
  },
  Rum: {
    label: 'Rum',
    light: 'bg-yellow-100 text-yellow-900',
    dark: 'dark:bg-yellow-900/30 dark:text-yellow-300',
  },
};

// --- Category → subcategory mapping (display order) ---

export const MENU_SECTIONS: { category: BeerLiquorCategory; subcategories: BeerLiquorSubcategory[] }[] = [
  {
    category: 'Beer',
    subcategories: ['Bock', 'Lager', 'Vienna Lager', 'Blonde Ale', 'Wheat', 'Stout'],
  },
  {
    category: 'Liquor',
    subcategories: ['Bourbon', 'Scotch', 'Tequila', 'Gin', 'Vodka', 'Rum'],
  },
];

// --- Mock items ---

const BEER_LIQUOR_ITEMS: BeerLiquorItem[] = [
  // ── Beer ──
  {
    id: 'bl-1',
    slug: 'shiner-bock',
    name: 'Shiner Bock',
    category: 'Beer',
    subcategory: 'Bock',
    producer: 'Spoetzl Brewery',
    country: 'USA',
    style: 'Malty, smooth, amber',
    description: 'Texas\' most iconic dark lager with rich malt character and a clean, easy-drinking finish. Brewed in Shiner, TX since 1913, it\'s the unofficial beer of the Lone Star State and a staple at any Texas steakhouse.',
    notes: 'Serve at 38-42°F in a pint glass or frosted mug. Pairs exceptionally well with BBQ, burgers, and Tex-Mex. A go-to recommendation for guests who want something local and approachable.',
  },
  {
    id: 'bl-2',
    slug: 'modelo-especial',
    name: 'Modelo Especial',
    category: 'Beer',
    subcategory: 'Lager',
    producer: 'Grupo Modelo',
    country: 'Mexico',
    style: 'Crisp, light, balanced',
    description: 'A pilsner-style lager with a slightly sweet malt character and a hint of orange blossom honey aroma. Modelo Especial has become the #1 beer brand in the U.S. by sales, beloved for its clean, refreshing taste.',
    notes: 'Serve ice-cold at 34-38°F. Excellent with seafood, ceviche, and spicy dishes. Offer with a lime wedge if the guest prefers. Great alternative for guests who find craft beer too heavy.',
  },
  {
    id: 'bl-3',
    slug: 'dos-equis-amber',
    name: 'Dos Equis Amber',
    category: 'Beer',
    subcategory: 'Vienna Lager',
    producer: 'Cuauhtémoc Moctezuma',
    country: 'Mexico',
    style: 'Toasty, caramel, smooth',
    description: 'A Vienna-style lager with a deep amber color and toasted malt sweetness. Originally brewed by a German immigrant in Mexico in 1897, it blends Old World brewing tradition with Mexican identity in a uniquely approachable package.',
    notes: 'Serve at 38-42°F in a pint glass. The caramel malt notes pair beautifully with grilled meats and smoky flavors. Good recommendation for guests who want more flavor than a standard lager but nothing too adventurous.',
  },
  {
    id: 'bl-4',
    slug: 'firemans-4',
    name: 'Fireman\'s 4',
    category: 'Beer',
    subcategory: 'Blonde Ale',
    producer: 'Real Ale Brewing',
    country: 'USA',
    style: 'Light, citrusy, crisp',
    description: 'A Texas craft blonde ale brewed in Blanco, TX. Light-bodied with subtle citrus hop notes and a clean malt backbone. Named for volunteer firefighters, a portion of sales supports Texas fire departments.',
    notes: 'Serve cold at 36-40°F. Very food-friendly — works with salads, grilled chicken, fish tacos, and lighter fare. Great gateway craft beer for guests transitioning from macro lagers. Mention the firefighter charity angle if guests ask about it.',
  },
  {
    id: 'bl-5',
    slug: 'lone-star',
    name: 'Lone Star',
    category: 'Beer',
    subcategory: 'Lager',
    producer: 'Pabst (Lone Star)',
    country: 'USA',
    style: 'Light, clean, easy-drinking',
    description: 'The "National Beer of Texas" since 1884. A classic American lager — light, crisp, and unpretentious. Lone Star is pure Texas nostalgia in a can, and it\'s the perfect low-key beer for guests who just want something cold and simple.',
    notes: 'Serve ice-cold. Often ordered alongside a shot of whiskey (boilermaker style). Pairs with anything casual — wings, nachos, burgers. Don\'t overthink it — this is a vibe beer, not a tasting beer.',
  },
  {
    id: 'bl-6',
    slug: 'blue-moon',
    name: 'Blue Moon',
    category: 'Beer',
    subcategory: 'Wheat',
    producer: 'Blue Moon Brewing',
    country: 'USA',
    style: 'Citrusy, smooth, wheaty',
    description: 'A Belgian-style wheat ale brewed with Valencia orange peel and coriander. Hazy golden color with a creamy body and subtle spice notes. Blue Moon single-handedly brought wheat beer to the American mainstream.',
    notes: 'Always serve with a fresh orange slice — it\'s part of the experience and enhances the citrus notes. Serve at 40-45°F. Pairs well with lighter dishes, salads, and seafood. Popular with guests who don\'t typically drink beer.',
  },
  {
    id: 'bl-7',
    slug: 'guinness-draught',
    name: 'Guinness Draught',
    category: 'Beer',
    subcategory: 'Stout',
    producer: 'Guinness',
    country: 'Ireland',
    style: 'Roasty, creamy, dry',
    description: 'The world\'s most famous stout. Nitrogenated for a velvety-smooth cascade and dense creamy head. Despite its dark color, Guinness is surprisingly light-bodied — only 125 calories per serving, less than most lagers.',
    notes: 'Pour with the two-part pour: fill to 3/4, let settle, then top off. Serve at 42-46°F. The "lighter than it looks" fact is a great conversation starter. Pairs with oysters, stews, and chocolate desserts. Popular year-round despite its "winter beer" reputation.',
  },
  // ── Liquor ──
  {
    id: 'bl-8',
    slug: 'bulleit-bourbon',
    name: 'Bulleit Bourbon',
    category: 'Liquor',
    subcategory: 'Bourbon',
    producer: 'Bulleit',
    country: 'USA',
    style: 'Spicy, oaky, bold',
    description: 'A high-rye bourbon (28% rye in the mash bill) with a distinctively spicy, bold character. The frontier-inspired brand has become a bartender favorite for its versatility — great neat, on the rocks, or as the backbone of an Old Fashioned.',
    notes: 'Recommend neat or with a single large ice cube for sipping. The high-rye spice makes it excellent in cocktails — especially Old Fashioneds and Whiskey Sours. Good entry-level premium bourbon at an accessible price point.',
  },
  {
    id: 'bl-9',
    slug: 'woodford-reserve',
    name: 'Woodford Reserve',
    category: 'Liquor',
    subcategory: 'Bourbon',
    producer: 'Woodford Reserve',
    country: 'USA',
    style: 'Rich, vanilla, refined',
    description: 'A premium small-batch bourbon from Kentucky\'s oldest distillery. Triple-distilled in copper pot stills for exceptional smoothness, with deep notes of vanilla, dried fruit, and toasted oak. The official bourbon of the Kentucky Derby.',
    notes: 'Best served neat or with a splash of water to open up the aromas. A step up for guests who want something more refined than a standard pour. Mention the Kentucky Derby connection for conversation. Also makes an exceptional Manhattan.',
  },
  {
    id: 'bl-10',
    slug: 'macallan-12',
    name: 'Macallan 12',
    category: 'Liquor',
    subcategory: 'Scotch',
    producer: 'The Macallan',
    country: 'Scotland',
    style: 'Sherried, fruity, oak',
    description: 'Aged 12 years exclusively in sherry-seasoned oak casks from Jerez, Spain. Rich golden color with complex flavors of dried fruits, ginger spice, and vanilla. The Macallan is the world\'s most collected and awarded single malt.',
    notes: 'Serve neat in a Glencairn glass, or with a few drops of water. The sherry cask influence makes it approachable for Scotch newcomers. Good upsell opportunity from blended Scotch. Pairs with dark chocolate, dried fruits, or after dinner as a digestif.',
  },
  {
    id: 'bl-11',
    slug: 'patron-silver',
    name: 'Patrón Silver',
    category: 'Liquor',
    subcategory: 'Tequila',
    producer: 'Patrón',
    country: 'Mexico',
    style: 'Smooth, citrus, clean',
    description: 'A premium 100% Weber Blue Agave tequila, small-batch produced in Jalisco. Crystal clear with a smooth, fresh character — light citrus and agave sweetness with a clean, peppery finish. Set the standard for premium tequila worldwide.',
    notes: 'Excellent in Margaritas and Palomas, or sipped neat/on the rocks. The smoothness makes it ideal for guests who think they don\'t like tequila. Serve with a lime wedge and salt if requested. Mention it\'s 100% agave — no mixto shortcuts.',
  },
  {
    id: 'bl-12',
    slug: 'casamigos-blanco',
    name: 'Casamigos Blanco',
    category: 'Liquor',
    subcategory: 'Tequila',
    producer: 'Casamigos',
    country: 'Mexico',
    style: 'Silky, sweet agave, mild',
    description: 'Co-founded by George Clooney and Rande Gerber, Casamigos was designed to be the smoothest tequila that doesn\'t need to be masked in a cocktail. Slow-roasted agave and an 80-hour fermentation process create an exceptionally soft, sweet profile.',
    notes: 'Best sipped neat or on the rocks to appreciate its smoothness. The celebrity backstory is a natural conversation starter. Very popular with guests who are new to sipping tequila. Also works beautifully in a simple Paloma or Margarita.',
  },
  {
    id: 'bl-13',
    slug: 'hendricks',
    name: 'Hendrick\'s',
    category: 'Liquor',
    subcategory: 'Gin',
    producer: 'Hendrick\'s',
    country: 'Scotland',
    style: 'Floral, cucumber, botanical',
    description: 'A Scottish gin infused with rose petals and cucumber after distillation, creating a distinctly smooth, floral character unlike traditional juniper-heavy gins. The iconic apothecary-style bottle and quirky branding have made it the world\'s most recognizable premium gin.',
    notes: 'Serve in a Gin & Tonic with a cucumber slice garnish (not lime). The cucumber-rose profile makes it an excellent gateway gin for guests who find traditional gins too piney. Also wonderful in a Gimlet or Tom Collins. Mention the Scottish origin — it surprises many guests.',
  },
  {
    id: 'bl-14',
    slug: 'titos',
    name: 'Tito\'s',
    category: 'Liquor',
    subcategory: 'Vodka',
    producer: 'Fifth Generation',
    country: 'USA',
    style: 'Clean, smooth, neutral',
    description: 'Handmade in Austin, TX from corn, making it naturally gluten-free. Six-times distilled in old-fashioned pot stills for a clean, slightly sweet character. Tito\'s grew from a one-man operation to America\'s best-selling spirit through pure word-of-mouth.',
    notes: 'The Texas connection is a strong selling point at Alamo Prime. Works in any vodka cocktail — Moscow Mule, Vodka Soda, Cosmopolitan. The gluten-free angle matters to some guests. Serve chilled for sipping or in a rocks glass with ice.',
  },
  {
    id: 'bl-15',
    slug: 'bacardi-superior',
    name: 'Bacardí Superior',
    category: 'Liquor',
    subcategory: 'Rum',
    producer: 'Bacardí',
    country: 'Puerto Rico',
    style: 'Light, dry, versatile',
    description: 'The world\'s most recognized white rum, charcoal-filtered for a clean, light profile. Founded in Santiago de Cuba in 1862, the Bacardí family pioneered the light rum style that revolutionized cocktail culture. The bat logo represents good fortune in Cuban tradition.',
    notes: 'The essential base for Mojitos, Daiquirís, and Cuba Libres. Too light for sipping neat — always recommend in cocktails. The bat logo story is a fun fact for curious guests. Pairs with tropical flavors, citrus, and mint.',
  },
];

// --- Exports ---

export const ALL_BEER_LIQUOR_ITEMS: BeerLiquorItem[] = BEER_LIQUOR_ITEMS;

export function getBeerLiquorBySlug(slug: string): BeerLiquorItem | undefined {
  return BEER_LIQUOR_ITEMS.find(item => item.slug === slug);
}

// --- AI action types and config ---

export type BeerLiquorAIAction = 'teachMe' | 'suggestPairing' | 'questions';

export const BEER_LIQUOR_AI_ACTIONS: { key: BeerLiquorAIAction; label: string; icon: string }[] = [
  { key: 'teachMe', label: 'Teach Me', icon: 'graduation-cap' },
  { key: 'suggestPairing', label: 'Suggest pairing', icon: 'utensils-crossed' },
  { key: 'questions', label: 'Ask a question', icon: 'help-circle' },
];

export function groupBySubcategory(
  items: BeerLiquorItem[]
): Record<BeerLiquorSubcategory, BeerLiquorItem[]> {
  const grouped = {} as Record<BeerLiquorSubcategory, BeerLiquorItem[]>;
  for (const item of items) {
    if (!grouped[item.subcategory]) {
      grouped[item.subcategory] = [];
    }
    grouped[item.subcategory].push(item);
  }
  return grouped;
}
