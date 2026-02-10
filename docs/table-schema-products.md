Got it. Below is a **single, clean, copy-paste-ready Markdown file** you can hand directly to **Claude Code**.

I have:

* Removed commentary, rationale, emojis, and prose
* Standardized headings
* Kept only what defines **structure, intent, and contracts**
* Preserved required JSON examples where they define schema
* Made it read like a **technical spec**, not a conversation

---

````md
# Restaurant Knowledge System — Data Model Specification

This document defines the core data tables for an AI-powered restaurant education and operations system.

All tables are **authoritative**, **AI-readable**, and designed for **paste → AI → review → save** ingestion workflows.

---

## TABLE 1 — prep_recipes

### Purpose
Single source of truth for all prep recipes. Every record is complete and AI-safe.

### Table Schema
```sql
prep_recipes (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  prep_type TEXT NOT NULL,

  status TEXT NOT NULL,
  version INTEGER NOT NULL,

  yield_qty NUMERIC NOT NULL,
  yield_unit TEXT NOT NULL,

  shelf_life_value INTEGER NOT NULL,
  shelf_life_unit TEXT NOT NULL,

  tags TEXT[] NOT NULL,
  images JSONB NOT NULL,

  ingredients JSONB NOT NULL,
  procedure JSONB NOT NULL,
  batch_scaling JSONB NOT NULL,
  training_notes JSONB NOT NULL,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
````

### JSON Contracts

**ingredients**

```json
[
  {
    "group_name": "Base",
    "order": 1,
    "items": [
      {
        "name": "Butter",
        "quantity": 500,
        "unit": "g",
        "prep_note": "unsalted",
        "allergens": ["dairy"]
      }
    ]
  }
]
```

**procedure**

```json
[
  {
    "group_name": "Base",
    "order": 1,
    "steps": [
      {
        "step_number": 1,
        "instruction": "Melt butter over low heat",
        "critical": true
      }
    ]
  }
]
```

**batch_scaling**

```json
{
  "scalable": true,
  "base_yield": { "quantity": 2, "unit": "liters" },
  "scaling_method": "linear",
  "exceptions": [],
  "notes": "No special scaling considerations"
}
```

**training_notes**

```json
{
  "common_mistakes": [],
  "quality_checks": [],
  "notes": ""
}
```

**ai_ingestion_meta**

```json
{
  "source_type": "manual_entry",
  "confidence_score": 1.0,
  "missing_fields": [],
  "last_ai_generated_at": null
}
```

---

## TABLE 2 — plate_specs

### Purpose

Authoritative BOH execution spec for each dish.

### Table Schema

```sql
plate_specs (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  plate_type TEXT NOT NULL,       -- entree | appetizer | side | dessert
  menu_category TEXT NOT NULL,

  status TEXT NOT NULL,
  version INTEGER NOT NULL,

  allergens TEXT[] NOT NULL,
  tags TEXT[] NOT NULL,
  images JSONB NOT NULL,

  components JSONB NOT NULL,
  assembly_procedure JSONB NOT NULL,
  notes TEXT NOT NULL,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### JSON Contracts

**components**

```json
[
  {
    "group_name": "Grill",
    "order": 1,
    "items": [
      {
        "type": "raw",
        "name": "Ribeye steak",
        "quantity": 16,
        "unit": "oz",
        "order": 1,
        "allergens": []
      },
      {
        "type": "prep_recipe",
        "name": "Herb Compound Butter",
        "prep_recipe_ref": "herb-compound-butter",
        "quantity": 1,
        "unit": "pc",
        "order": 2
      }
    ]
  },
  {
    "group_name": "Plate",
    "order": 2,
    "items": [
      {
        "type": "prep_recipe",
        "name": "Red Wine Demi-Glace",
        "prep_recipe_ref": "red-wine-demi-glace",
        "quantity": 3,
        "unit": "oz",
        "order": 1
      },
      {
        "type": "raw",
        "name": "Fingerling potatoes, roasted",
        "quantity": 5,
        "unit": "oz",
        "order": 2,
        "allergens": []
      }
    ]
  }
]
```

**assembly_procedure**

```json
[
  {
    "group_name": "Protein",
    "order": 1,
    "steps": [
      {
        "step_number": 1,
        "instruction": "Season steak generously with salt",
        "critical": true
      },
      {
        "step_number": 2,
        "instruction": "Grill to mid-rare and rest 5 minutes",
        "critical": true
      }
    ]
  },
  {
    "group_name": "Finish",
    "order": 2,
    "steps": [
      {
        "step_number": 3,
        "instruction": "Place steak centered on plate",
        "critical": true
      },
      {
        "step_number": 4,
        "instruction": "Spoon sauce over steak, avoiding plate rim",
        "critical": true
      }
    ]
  }
]
```

---

## TABLE 3 — foh_plate_specs

### Purpose

Guest-facing dish knowledge for FOH staff. Derived from plate_specs.

### Table Schema

```sql
foh_plate_specs (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  plate_spec_id UUID NOT NULL,
  menu_name TEXT NOT NULL,
  plate_type TEXT NOT NULL,       -- appetizer | entree | side | dessert

  status TEXT NOT NULL,
  version INTEGER NOT NULL,

  short_description TEXT NOT NULL,
  detailed_description TEXT NOT NULL,

  ingredients TEXT[] NOT NULL,
  key_ingredients TEXT[] NOT NULL,

  flavor_profile TEXT[] NOT NULL,

  allergens TEXT[] NOT NULL,
  allergy_notes TEXT NOT NULL,
  upsell_notes TEXT NOT NULL,
  notes TEXT NOT NULL,

  image TEXT,

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

---

## TABLE 4 — wines

### Purpose

Lean, sellable wine reference for FOH and AI.

### Table Schema

```sql
wines (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  producer TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  vintage TEXT,

  varietal TEXT NOT NULL,
  blend BOOLEAN NOT NULL,
  style TEXT NOT NULL,
  body TEXT NOT NULL,

  tasting_notes TEXT NOT NULL,
  producer_notes TEXT NOT NULL,

  status TEXT NOT NULL,
  version INTEGER NOT NULL,

  notes TEXT NOT NULL,

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  image TEXT,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

---

## TABLE 5 — cocktails

### Purpose

Executable cocktail specs with FOH-friendly descriptions.

### Table Schema

```sql
cocktails (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  style TEXT NOT NULL,
  glass TEXT NOT NULL,

  status TEXT NOT NULL,
  version INTEGER NOT NULL,

  ingredients TEXT NOT NULL,
  key_ingredients TEXT NOT NULL,

  procedure JSONB NOT NULL,
  tasting_notes TEXT NOT NULL,
  description TEXT NOT NULL,

  notes TEXT NOT NULL,

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  image TEXT,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### JSON Contract — procedure

```json
[
  { "step": 1, "instruction": "Add gin, lime juice, and simple syrup to a shaker with ice" },
  { "step": 2, "instruction": "Shake hard until well chilled" },
  { "step": 3, "instruction": "Strain into a chilled coupe glass" }
]
```

---

## TABLE 6 — beer_liquor_list

### Purpose

Simple FOH awareness catalog for beer and spirits.

### Table Schema

```sql
beer_liquor_list (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,

  producer TEXT NOT NULL,
  country TEXT NOT NULL,

  description TEXT NOT NULL,
  style TEXT NOT NULL,

  status TEXT NOT NULL,
  version INTEGER NOT NULL,

  notes TEXT NOT NULL,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

---

```


```
