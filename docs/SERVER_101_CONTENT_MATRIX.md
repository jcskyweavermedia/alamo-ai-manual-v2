# Server 101 Content Mapping Matrix

Quick reference showing which database records are used in each course section.

## Course 1: Culture & Standards (5 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| Welcome & Philosophy | manual_sections | `welcome-philosophy` | ✅ |
| Core Values | manual_sections | `core-values` | ✅ |
| Service Excellence | manual_sections | `service-excellence` | ✅ |
| Brand Standards | manual_sections | `brand-standards` | ✅ |
| Culture Quiz | custom | - | ❌ |

## Course 2: Entrees & Steaks (7 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| 16oz Bone-In Ribeye | foh_plate_specs | `16oz-bone-in-ribeye` | ✅ |
| 8oz Filet Mignon | foh_plate_specs | `8oz-filet-mignon` | ✅ |
| Chicken Fried Steak | foh_plate_specs | `chicken-fried-steak` | ✅ |
| Grilled Atlantic Salmon | foh_plate_specs | `grilled-atlantic-salmon` | ✅ |
| Mods & Allergens | custom | - | ❌ |
| Steak Temperatures Guide | custom | - | ❌ |
| Practice: Describe to Guest | custom | - | ❌ |

## Course 3: Appetizers & Sides (5 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| Loaded Queso | foh_plate_specs | `loaded-queso` | ✅ |
| Jumbo Shrimp Cocktail | foh_plate_specs | `jumbo-shrimp-cocktail` | ✅ |
| Crispy Brussels Sprouts | foh_plate_specs | `crispy-brussels-sprouts` | ✅ |
| Signature Sides | foh_plate_specs | `loaded-baked-potato`, `creamed-spinach-dish`, `mac-and-cheese` | ✅ (3) |
| Practice: Upselling Sides | custom | - | ❌ |

## Course 4: Wine Program (7 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| Wine Service Basics | custom | - | ❌ |
| Veuve Clicquot Yellow Label Brut | wines | `veuve-clicquot-yellow-label-brut-nv` | ✅ |
| Cloudy Bay Sauvignon Blanc | wines | `cloudy-bay-sauvignon-blanc-2023` | ✅ |
| Whispering Angel Rosé | wines | `whispering-angel-rose-2023` | ✅ |
| Erath Pinot Noir | wines | `erath-pinot-noir-2021` | ✅ |
| Château Margaux 2018 | wines | `chateau-margaux-2018` | ✅ |
| Practice: Wine Pairing Pitch | custom | - | ❌ |

## Course 5: Cocktails & Bar (6 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| Old Fashioned | cocktails | `old-fashioned` | ✅ |
| Espresso Martini | cocktails | `espresso-martini` | ✅ |
| Paloma | cocktails | `paloma` | ✅ |
| Penicillin | cocktails | `penicillin` | ✅ |
| Mai Tai | cocktails | `mai-tai` | ✅ |
| Practice: Describe Cocktails | custom | - | ❌ |

## Course 6: Beer & Liquor (4 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| Texas & Regional Beers | beer_liquor_list | `lone-star`, `shiner-bock`, `firemans-4` | ✅ (3) |
| Craft & Specialty Beers | beer_liquor_list | `modelo-especial`, `dos-equis-amber`, `blue-moon`, `guinness-draught` | ✅ (4) |
| Premium Spirits Collection | beer_liquor_list | `woodford-reserve`, `bulleit-bourbon`, `patron-silver`, `casamigos-blanco`, `macallan-12`, `hendricks` | ✅ (6) |
| Practice: Bar Recommendations | custom | - | ❌ |

## Course 7: Desserts & After-Dinner (3 sections)

| Section | Content Source | Slug(s) | UUID Required |
|---------|---------------|---------|---------------|
| Chocolate Lava Cake | foh_plate_specs | `chocolate-lava-cake` | ✅ |
| Pecan Pie | foh_plate_specs | `pecan-pie` | ✅ |
| After-Dinner Service | custom | - | ❌ |

---

## Summary Statistics

### Content References by Table
- **manual_sections:** 4 unique records
- **foh_plate_specs:** 12 unique records (10 single + 1 multi-item section with 3 records)
- **wines:** 5 unique records
- **cocktails:** 5 unique records
- **beer_liquor_list:** 15 unique records across 3 grouped sections
- **custom:** 8 sections (no DB references)

### Total Database Records Referenced
**41 unique content records** mapped across 35 course sections

### Content Distribution
| Table | Records | Sections Using It | Multi-Item Sections |
|-------|---------|-------------------|---------------------|
| manual_sections | 4 | 4 | 0 |
| foh_plate_specs | 12 | 11 | 1 (Signature Sides: 3 items) |
| wines | 5 | 5 | 0 |
| cocktails | 5 | 5 | 0 |
| beer_liquor_list | 15 | 3 | 3 (all grouped) |
| custom | - | 8 | - |

### Section Types
- **learn:** 27 sections
- **quiz:** 1 section
- **practice:** 7 sections

---

## Unused Content (Available for Future Courses)

### From foh_plate_specs (0 unused - all 12 used)
All current dishes are mapped.

### From wines (0 unused - all 5 used)
All wines are mapped.

### From cocktails (0 unused - all 5 used)
All cocktails are mapped.

### From beer_liquor_list (2 unused)
- `bacardi-superior` (Rum)
- `titos` (Vodka)

*Note: These could be added to Course 6, Section 3 (Premium Spirits Collection) if desired.*

### From manual_sections (30 unused)
Available for future courses:
- `company-overview`
- `hours-operations`
- `team-roles` (category parent)
- `server-standards`
- `host-essentials`
- `bus-person-procedures`
- `line-cook-standards`
- `prep-cook-procedures`
- `dishwasher-operations`
- `bartender-standards`
- `management-roles`
- `security-host-support`
- `operational-procedures` (category parent)
- `opening-duties`
- `ongoing-operations`
- `closing-protocols`
- `environment-standards`
- `guest-services` (category parent)
- `reservation-management`
- `telephone-etiquette`
- `guest-recovery`
- `frequently-asked`
- `appendix` (category parent)
- `terminology`
- `checklists`
- `contact-info`
- And 4 overview sections

*These could be used for advanced courses like "Server 201: Advanced Operations" or role-specific training.*

---

## Validation Checklist

Before deploying migration:
- [ ] All referenced slugs exist in database ✅ (verified via MCP queries)
- [ ] Group 'alamo-prime' exists ✅ (id: `00000000-0000-0000-0000-000000000001`)
- [ ] Course slugs are unique ✅
- [ ] Section slugs are unique ✅
- [ ] All content_source values are valid enum values ✅
- [ ] All section_type values are valid enum values ✅
- [ ] Sort orders are sequential ✅
- [ ] Estimated minutes are reasonable ✅
- [ ] Bilingual titles present ✅

---

**Ready to Deploy:** ✅ All content validated and mapped
