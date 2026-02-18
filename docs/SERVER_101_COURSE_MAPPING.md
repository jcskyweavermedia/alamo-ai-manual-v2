# Server 101 Training Courses - Complete Mapping

## Overview
7 comprehensive courses covering all essential front-of-house training for new servers at Alamo Prime.
**Total: 7 courses, 35 sections, ~140 estimated minutes (~2.3 hours)**

---

## Course 1: Culture & Standards
**Icon:** Landmark | **Duration:** 20 min | **Passing Score:** 70%

Introduces new servers to Alamo Prime's values, service philosophy, and brand standards.

### Sections (5)
1. **Welcome & Philosophy** (4 min) - `manual_sections:welcome-philosophy`
2. **Core Values** (5 min) - `manual_sections:core-values`
3. **Service Excellence** (5 min) - `manual_sections:service-excellence`
4. **Brand Standards** (4 min) - `manual_sections:brand-standards`
5. **Culture Quiz** (2 min) - `custom` [quiz]

---

## Course 2: Entrees & Steaks
**Icon:** Beef | **Duration:** 30 min | **Passing Score:** 70%

Deep dive into all entrees with focus on steaks, cooking temps, mods, and allergens.

### Sections (7)
1. **16oz Bone-In Ribeye** (5 min) - `foh_plate_specs:16oz-bone-in-ribeye`
2. **8oz Filet Mignon** (5 min) - `foh_plate_specs:8oz-filet-mignon`
3. **Chicken Fried Steak** (4 min) - `foh_plate_specs:chicken-fried-steak`
4. **Grilled Atlantic Salmon** (4 min) - `foh_plate_specs:grilled-atlantic-salmon`
5. **Mods & Allergens** (5 min) - `custom`
6. **Steak Temperatures Guide** (4 min) - `custom`
7. **Practice: Describe to Guest** (3 min) - `custom` [practice]

---

## Course 3: Appetizers & Sides
**Icon:** UtensilsCrossed | **Duration:** 20 min | **Passing Score:** 70%

Covers all appetizers and signature sides, with focus on upselling techniques.

### Sections (5)
1. **Loaded Queso** (4 min) - `foh_plate_specs:loaded-queso`
2. **Jumbo Shrimp Cocktail** (4 min) - `foh_plate_specs:jumbo-shrimp-cocktail`
3. **Crispy Brussels Sprouts** (3 min) - `foh_plate_specs:crispy-brussels-sprouts`
4. **Signature Sides** (6 min) - `foh_plate_specs:loaded-baked-potato, creamed-spinach-dish, mac-and-cheese`
5. **Practice: Upselling Sides** (3 min) - `custom` [practice]

---

## Course 4: Wine Program
**Icon:** Wine | **Duration:** 25 min | **Passing Score:** 70%

Introduction to wine service basics and each wine on the list, with pairing techniques.

### Sections (7)
1. **Wine Service Basics** (4 min) - `custom`
2. **Veuve Clicquot Yellow Label Brut** (4 min) - `wines:veuve-clicquot-yellow-label-brut-nv`
3. **Cloudy Bay Sauvignon Blanc** (4 min) - `wines:cloudy-bay-sauvignon-blanc-2023`
4. **Whispering Angel Rosé** (3 min) - `wines:whispering-angel-rose-2023`
5. **Erath Pinot Noir** (4 min) - `wines:erath-pinot-noir-2021`
6. **Château Margaux 2018** (3 min) - `wines:chateau-margaux-2018`
7. **Practice: Wine Pairing Pitch** (3 min) - `custom` [practice]

---

## Course 5: Cocktails & Bar
**Icon:** Martini | **Duration:** 20 min | **Passing Score:** 70%

Training on all signature cocktails with focus on ingredients and presentation.

### Sections (6)
1. **Old Fashioned** (4 min) - `cocktails:old-fashioned`
2. **Espresso Martini** (4 min) - `cocktails:espresso-martini`
3. **Paloma** (3 min) - `cocktails:paloma`
4. **Penicillin** (4 min) - `cocktails:penicillin`
5. **Mai Tai** (3 min) - `cocktails:mai-tai`
6. **Practice: Describe Cocktails** (2 min) - `custom` [practice]

---

## Course 6: Beer & Liquor
**Icon:** Beer | **Duration:** 15 min | **Passing Score:** 70%

Overview of beer selection and premium spirits, organized by category.

### Sections (4)
1. **Texas & Regional Beers** (4 min) - `beer_liquor_list:lone-star, shiner-bock, firemans-4`
2. **Craft & Specialty Beers** (4 min) - `beer_liquor_list:modelo-especial, dos-equis-amber, blue-moon, guinness-draught`
3. **Premium Spirits Collection** (5 min) - `beer_liquor_list:woodford-reserve, bulleit-bourbon, patron-silver, casamigos-blanco, macallan-12, hendricks`
4. **Practice: Bar Recommendations** (2 min) - `custom` [practice]

---

## Course 7: Desserts & After-Dinner
**Icon:** CakeSlice | **Duration:** 10 min | **Passing Score:** 70%

Dessert menu and after-dinner service techniques to close the experience.

### Sections (3)
1. **Chocolate Lava Cake** (3 min) - `foh_plate_specs:chocolate-lava-cake`
2. **Pecan Pie** (3 min) - `foh_plate_specs:pecan-pie`
3. **After-Dinner Service** (4 min) - `custom`

---

## Content Source Summary

### By Content Type
- **manual_sections:** 4 sections (culture & standards content)
- **foh_plate_specs:** 15 sections (dishes)
- **wines:** 5 sections (wine list)
- **cocktails:** 5 sections (cocktail list)
- **beer_liquor_list:** 15 items across 3 grouped sections
- **custom:** 8 sections (quizzes, practice, guides)

### Total Content Items Referenced
- 4 manual sections
- 12 dish specs (8 entrees/apps, 3 sides, 2 desserts)
- 5 wines
- 5 cocktails
- 15 beer/liquor items

---

## Database Schema Reference

### Tables Used
```sql
-- Course master table
courses (
  id, group_id, slug, title_en, title_es, icon,
  sort_order, estimated_minutes, passing_score
)

-- Course section details
course_sections (
  id, course_id, group_id, slug, title_en, title_es,
  content_source, content_ids, sort_order,
  section_type, estimated_minutes
)

-- Content source tables
manual_sections (id, slug, title_en, content_en, ...)
foh_plate_specs (id, slug, menu_name, ...)
wines (id, slug, name, ...)
cocktails (id, slug, name, ...)
beer_liquor_list (id, slug, name, category, subcategory, ...)
```

### Content Source Enum
- `manual_sections` - Training manual content
- `foh_plate_specs` - Front-of-house plate specifications
- `wines` - Wine list
- `cocktails` - Cocktail recipes
- `beer_liquor_list` - Beer and liquor inventory
- `custom` - Custom sections (quizzes, practice, guides)

### Section Type Enum
- `learn` - Instructional content
- `quiz` - Knowledge check
- `practice` - Role-play scenarios

---

## Migration File

**File:** `supabase/migrations/20260213000000_seed_server_101_courses.sql`

**Execution:** Run via `npx supabase db push`

**Features:**
- Uses `DO $$ ... $$` block for dynamic ID lookup
- All content_ids use subqueries (no hardcoded UUIDs)
- Bilingual titles (EN/ES) for all courses and sections
- Proper sort_order for sequential learning
- Custom sections use empty UUID array: `'{}'::uuid[]`

---

## Next Steps

1. **Apply Migration**
   ```bash
   npx supabase db push
   ```

2. **Verify Data**
   ```sql
   SELECT * FROM courses ORDER BY sort_order;
   SELECT * FROM course_sections ORDER BY course_id, sort_order;
   ```

3. **Test UI Integration**
   - Course list view
   - Course detail with sections
   - Section content rendering
   - Progress tracking

4. **Content Development** (for custom sections)
   - Steak temperature guide
   - Mods & allergens reference
   - Wine service basics
   - After-dinner service protocol
   - Quiz questions
   - Practice scenarios

---

**Migration Status:** ✅ Ready to deploy
**Last Updated:** 2026-02-13
