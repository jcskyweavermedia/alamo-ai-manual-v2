-- Normalize cocktail ingredients from comma-separated to newline-delimited
-- so the viewer utility can render them as individual lines consistently.
-- FTS trigger auto-fires on UPDATE — search index stays correct.

UPDATE cocktails SET ingredients = E'2 oz Bourbon\n0.5 oz Demerara syrup\n2 dashes Angostura bitters\n1 dash Orange bitters\nOrange peel'
WHERE slug = 'old-fashioned';

UPDATE cocktails SET ingredients = E'2 oz Vodka\n0.5 oz Kahlua\n1 oz Fresh espresso\n0.25 oz Simple syrup'
WHERE slug = 'espresso-martini';

UPDATE cocktails SET ingredients = E'2 oz Aged rum\n1 oz Lime juice\n0.5 oz Orange curacao\n0.5 oz Orgeat\n0.5 oz Dark rum (float)\nMint sprig'
WHERE slug = 'mai-tai';

UPDATE cocktails SET ingredients = E'2 oz Blended Scotch\n0.75 oz Lemon juice\n0.75 oz Honey-ginger syrup\n0.25 oz Islay Scotch (float)\nCandied ginger'
WHERE slug = 'penicillin';

UPDATE cocktails SET ingredients = E'2 oz Tequila blanco\n2 oz Fresh grapefruit juice\n0.5 oz Lime juice\n0.5 oz Agave nectar\n2 oz Club soda'
WHERE slug = 'paloma';
