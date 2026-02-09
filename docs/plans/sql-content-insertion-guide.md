# SQL Content Insertion Guide

This document explains how to generate SQL scripts for inserting markdown content into the `manual_sections` table. Use this guide to prepend the correct SQL header to each markdown content file.

---

## Overview

The database table `manual_sections` stores content in two columns:
- `content_en` — English markdown content
- `content_es` — Spanish markdown content

Each section is identified by its unique `slug`. The SQL script updates the content for an existing row.

---

## English Content Template

For **English** content files, prepend this SQL header:

```sql
-- English Content: [SECTION_TITLE]
-- Slug: [SLUG]
-- File: [ORIGINAL_FILE_PATH]

UPDATE manual_sections
SET content_en = $MD$
```

Then paste the **full markdown content** below the header.

Then close with:

```sql
$MD$,
    word_count_en = [WORD_COUNT],
    updated_at = now()
WHERE slug = '[SLUG]';
```

### Complete English Example

```sql
-- English Content: Line Cook Standards
-- Slug: line-cook-standards
-- File: 06-team-roles/06-05-line-cook-standards.md

UPDATE manual_sections
SET content_en = $MD$
# Line Cook Standards

## Introduction

The line cook is responsible for preparing menu items according to Alamo Prime's exacting standards...

## Station Setup

Before each shift, ensure your station is properly prepared:

- Check all equipment is functioning
- Verify ingredient par levels
- Review daily specials and modifications

## Recipe Execution

All recipes must be followed precisely...

$MD$,
    word_count_en = 4000,
    updated_at = now()
WHERE slug = 'line-cook-standards';
```

---

## Spanish Content Template

For **Spanish** content files, prepend this SQL header:

```sql
-- Spanish Content: [SECTION_TITLE_ES]
-- Slug: [SLUG]
-- File: [ORIGINAL_FILE_PATH]

UPDATE manual_sections
SET content_es = $MD$
```

Then paste the **full markdown content** below the header.

Then close with:

```sql
$MD$,
    word_count_es = [WORD_COUNT],
    updated_at = now()
WHERE slug = '[SLUG]';
```

### Complete Spanish Example

```sql
-- Spanish Content: Estándares de Cocinero de Línea
-- Slug: line-cook-standards
-- File: 06-roles-equipo/06-05-cocinero-linea-estandares.md

UPDATE manual_sections
SET content_es = $MD$
# Estándares de Cocinero de Línea

## Introducción

El cocinero de línea es responsable de preparar los elementos del menú según los estándares exigentes de Alamo Prime...

## Configuración de Estación

Antes de cada turno, asegúrese de que su estación esté debidamente preparada:

- Verifique que todo el equipo funcione correctamente
- Confirme los niveles de ingredientes
- Revise los especiales del día y las modificaciones

## Ejecución de Recetas

Todas las recetas deben seguirse con precisión...

$MD$,
    word_count_es = 4000,
    updated_at = now()
WHERE slug = 'line-cook-standards';
```

---

## Important Notes

### 1. Dollar-Quoting (`$MD$...$MD$`)
We use PostgreSQL dollar-quoting to safely handle markdown content that may contain:
- Single quotes (`'`)
- Double quotes (`"`)
- Backslashes (`\`)
- Any special characters

The `$MD$` delimiter can be any unique string. If your content happens to contain `$MD$`, use a different delimiter like `$CONTENT$` or `$MARKDOWN$`.

### 2. Slug Reference Table

Here are all the slugs currently in the database:

| Slug | English Title | Category |
|------|---------------|----------|
| `welcome-philosophy` | Welcome Philosophy | Root |
| `company-overview` | Company Overview | Root |
| `core-values` | Core Values | Root |
| `service-excellence` | Service Excellence | Root |
| `hours-operations` | Hours of Operations | Root |
| `brand-standards` | Brand Standards | Root |
| `team-roles-overview` | Team Roles Overview | Team Roles |
| `host-essentials` | Host Essentials | Team Roles |
| `server-standards` | Server Standards | Team Roles |
| `bus-person-procedures` | Bus Person Procedures | Team Roles |
| `management-roles` | Management Roles | Team Roles |
| `line-cook-standards` | Line Cook Standards | Team Roles |
| `prep-cook-procedures` | Prep Cook Procedures | Team Roles |
| `dishwasher-operations` | Dishwasher Operations | Team Roles |
| `bartender-standards` | Bartender Standards | Team Roles |
| `security-host-support` | Security and Host Support | Team Roles |
| `operational-procedures-overview` | Operational Procedures Overview | Operations |
| `opening-duties` | Opening Duties | Operations |
| `ongoing-operations` | Ongoing Operations | Operations |
| `closing-protocols` | Closing Protocols | Operations |
| `environment-standards` | Environment Standards | Operations |
| `guest-services-overview` | Guest Services Overview | Guest Services |
| `telephone-etiquette` | Telephone Etiquette | Guest Services |
| `reservation-management` | Reservation Management | Guest Services |
| `guest-recovery` | Guest Recovery | Guest Services |
| `frequently-asked` | Frequently Asked Questions | Guest Services |
| `appendix-overview` | Appendix Overview | Appendix |
| `terminology` | Restaurant Terminology | Appendix |
| `checklists` | Daily Operational Checklists | Appendix |
| `contact-info` | Important Contacts and Resources | Appendix |

### 3. Word Count Calculation

Estimate word count by:
- Counting words in the markdown content
- Excluding code blocks and formatting characters
- Rounding to the nearest 100

### 4. Execution Instructions

1. Copy the complete SQL script (header + content + footer)
2. Open the Lovable Cloud SQL editor
3. Paste the script
4. Execute
5. Verify with: `SELECT slug, LEFT(content_en, 100) FROM manual_sections WHERE slug = '[SLUG]';`

---

## Batch Template (Multiple Sections)

If you want to insert multiple sections in one script:

```sql
-- Batch Content Update: English
-- Generated: [DATE]

BEGIN;

-- Section 1: Welcome Philosophy
UPDATE manual_sections
SET content_en = $MD$
[MARKDOWN CONTENT HERE]
$MD$,
    word_count_en = 2000,
    updated_at = now()
WHERE slug = 'welcome-philosophy';

-- Section 2: Company Overview
UPDATE manual_sections
SET content_en = $MD$
[MARKDOWN CONTENT HERE]
$MD$,
    word_count_en = 2500,
    updated_at = now()
WHERE slug = 'company-overview';

COMMIT;
```

---

## Verification Query

After inserting content, verify with:

```sql
SELECT 
  slug,
  title_en,
  CASE WHEN content_en IS NOT NULL THEN '✅ EN' ELSE '❌ EN' END as english,
  CASE WHEN content_es IS NOT NULL THEN '✅ ES' ELSE '❌ ES' END as spanish,
  word_count_en,
  word_count_es
FROM manual_sections
WHERE is_category = false
ORDER BY sort_order;
```

This shows which sections have content populated.
