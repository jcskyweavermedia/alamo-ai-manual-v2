# Markdown Authoring Guide

This guide documents all available Markdown features and best practices for creating manual content that renders beautifully in our system.

---

## Quick Reference

| Feature | Syntax | Use Case |
|---------|--------|----------|
| H1 (`#`) | Page title | One per document, at the top |
| H2 (`##`) | Section headings | Major sections, appear in TOC |
| H3 (`###`) | Subsections | Sub-topics, appear in TOC |
| H4 (`####`) | Minor headings | Rarely needed |
| Bold (`**text**`) | Emphasis | Critical values, key terms |
| Italic (`*text*`) | Subtle emphasis | Definitions, side notes |
| Callouts | `> **⚠️ Critical**:` | Alerts, tips, notes |
| Tables | GFM tables | Reference data, comparisons |
| Lists | `-` or `1.` | Steps, requirements |
| Code | `` `inline` `` or fenced | Technical values, commands |
| Links | `[text](url)` | Cross-references |
| HR | `---` | Content separation |

---

## Headings

### Page Title (H1)

Use exactly **one H1** at the top of each document. This becomes the page title.

```markdown
# Temperature Monitoring
```

**Renders as:** Large 22px semibold title with tight tracking.

### Section Headings (H2)

Use H2 for major sections. These appear in the **In-Page Table of Contents** (shown on XL screens when 3+ headings exist).

```markdown
## Checking Temperatures
```

**Guidelines:**
- Keep titles concise (2-5 words ideal)
- Use sentence case ("Checking temperatures" not "Checking Temperatures")
- H2s generate anchor IDs for deep linking (`#checking-temperatures`)

### Subsections (H3)

Use H3 for subsections within an H2. Also appear in the TOC.

```markdown
### Hot Holding Requirements
```

### Minor Headings (H4)

Use sparingly for sub-sub-sections. Does not appear in TOC.

```markdown
#### Equipment Checklist
```

---

## Callouts (Special Blockquotes)

Callouts highlight critical information. They're created using blockquotes with special prefixes.

### Critical Callout (Red)

For **safety warnings**, food handling alerts, or actions that could cause harm if ignored.

```markdown
> **⚠️ Critical**: Temperature checks should be performed every 2 hours during service.
```

**Spanish variant:**
```markdown
> **⚠️ Crítico**: Las verificaciones de temperatura deben realizarse cada 2 horas.
```

### Warning Callout (Yellow/Orange)

For **general warnings** that aren't safety-critical but need attention.

```markdown
> **⚠️ Warning**: This equipment must be unplugged before cleaning.
```

### Tip Callout (Blue/Primary)

For **best practices**, helpful hints, or efficiency improvements.

```markdown
> **💡 Tip**: The "Danger Zone" is between 41°F and 139°F—bacteria grow rapidly in this range.
```

**Spanish variant:**
```markdown
> **💡 Consejo**: La "Zona de Peligro" está entre 5°C y 60°C.
```

### Note Callout (Gray/Muted)

For **supplementary information** that provides context but isn't critical.

```markdown
> **ℹ️ Note**: When in doubt, throw it out. Food safety is never worth the risk.
```

**Spanish variant:**
```markdown
> **ℹ️ Nota**: En caso de duda, deséchelo. La seguridad alimentaria nunca vale el riesgo.
```

### Plain Blockquotes

Regular blockquotes (without special prefixes) render as info-style callouts:

```markdown
> This is general supplementary information.
```

---

## Lists

### Unordered Lists

Use for non-sequential items, requirements, or features.

```markdown
- Salads and prepared salad items
- Dairy products (milk, cheese, cream)
- Cut fruits and vegetables
```

**Guidelines:**
- Start each item with a capital letter
- No periods at end unless complete sentences
- Keep items parallel in structure

### Ordered Lists

Use for **sequential steps** or prioritized items.

```markdown
1. Use a calibrated thermometer
2. Insert the probe into the thickest part
3. Wait for reading to stabilize (15-20 seconds)
4. Record temperature on monitoring sheet
5. Clean and sanitize thermometer between uses
```

**Guidelines:**
- Use for procedures, processes, or ranked items
- Keep steps actionable (start with verbs)
- One action per step for clarity

### Nested Lists

```markdown
- Primary item
  - Sub-item one
  - Sub-item two
- Another primary item
```

---

## Tables

Tables are ideal for reference data, comparisons, and structured information.

```markdown
| Food Type | Minimum Temp | Check Frequency |
|-----------|-------------|-----------------|
| Soups & Stews | 140°F (60°C) | Every 2 hours |
| Proteins | 140°F (60°C) | Every 2 hours |
| Sauces & Gravies | 140°F (60°C) | Every 2 hours |
```

**Guidelines:**
- Tables scroll horizontally on mobile (no need to limit columns)
- Use for 3+ rows of structured data
- Keep cell content concise
- Left-align text, right-align numbers when appropriate
- Bold important values in cells if needed

---

## Text Formatting

### Bold

Use for **critical values**, **key terms**, or **emphasis**.

```markdown
All hot foods must be held at **140°F (60°C)** or above.
```

**When to use:**
- Temperature thresholds
- Time limits
- Important keywords
- Required actions

### Italic

Use for *definitions*, *subtle emphasis*, or *side notes*.

```markdown
The *mise en place* should be completed before service begins.
```

### Inline Code

Use for technical values, codes, or literal text.

```markdown
Set the timer to `15:00` minutes.
The error code `E-04` indicates low oil level.
```

### Code Blocks

Use for multi-line technical content, though rarely needed in manuals.

````markdown
```
TEMP_CHECK_INTERVAL=2h
LOG_LOCATION=/kitchen/temp-log
```
````

---

## Links

### Internal Links

For cross-references within the manual (not yet fully implemented):

```markdown
See [Hand Washing Procedures](/manual/hand-washing) for details.
```

### External Links

External links automatically open in a new tab:

```markdown
Refer to the [FDA Food Code](https://www.fda.gov/food/fda-food-code) for regulations.
```

---

## Horizontal Rules

Use `---` to create visual separation between major content sections:

```markdown
## Section One

Content here...

---

## Section Two

More content...
```

**When to use:**
- Before footer/metadata
- Between unrelated sections
- After major topic transitions

---

## Images

Images are supported with lazy loading:

```markdown
![Thermometer placement diagram](https://example.com/thermometer-diagram.png)
```

**Guidelines:**
- Always include descriptive alt text
- Images are responsive (max-width: 100%)
- Use for diagrams, equipment photos, visual guides

---

## Best Practices for UX

### Document Structure

1. **Start with H1** — One title per document
2. **Use H2 for main sections** — These create the TOC
3. **Place callouts contextually** — Position them directly before or within the section they relate to, not clustered at the top
4. **End with reference material** — Tables, links, metadata at bottom

### Content Density

- **Short paragraphs** — 2-4 sentences max
- **Scannable content** — Use lists over long paragraphs
- **White space** — Don't cram content; let it breathe

### Callout Placement

**Wrong approach**: Dumping all warnings at the document top
```markdown
# Fryer Operation

> **⚠️ Critical**: Never leave hot oil unattended.
> **⚠️ Warning**: Unplug before cleaning.
> **💡 Tip**: Shake ice off frozen items.

## Before Use
...
```

**Correct approach**: Place callouts where they're actionable
```markdown
# Fryer Operation

## Before Use
Check oil level and ventilation before starting.

## During Operation
> **⚠️ Critical**: Never leave a hot fryer unattended. Oil fires start within seconds.

Lower food slowly into oil...

> **💡 Tip**: Shake excess ice from frozen items before frying to prevent splatter.

## Cleaning
> **⚠️ Warning**: Unplug and let oil cool completely before cleaning.
```

### Callout Usage Guide

Callouts aren't just for warnings—use them to **highlight any information worth remembering**.

| Callout | When to Use | Examples |
|---------|-------------|----------|
| **Critical** | Safety hazards, actions with serious consequences | Food safety temps, injury risks |
| **Warning** | Important cautions, things easily forgotten | Equipment prep, common mistakes |
| **Tip** | Best practices, efficiency tricks, pro knowledge | Time-savers, quality improvements |
| **Note** | Context, background info, "good to know" facts | Regulations, definitions, exceptions |

**Tip callouts for positive highlights:**
```markdown
> **💡 Tip**: Preheating the pan for 2 minutes gives you the perfect sear every time.

> **💡 Tip**: The "two-finger rule"—oil should be two finger-widths deep for optimal frying.
```

**Note callouts for context:**
```markdown
> **ℹ️ Note**: This procedure was updated in January 2024 to reflect new health department guidelines.

> **ℹ️ Note**: "Mise en place" is French for "everything in its place"—having ingredients prepped before cooking.
```

### Bilingual Content

When writing content that will be translated:

1. **English file**: `section-name.en.md`
2. **Spanish file**: `section-name.es.md`

Spanish callout prefixes:
- `⚠️ Crítico` → Critical
- `💡 Consejo` → Tip  
- `ℹ️ Nota` → Note

### Table of Contents Optimization

The in-page TOC shows H2 and H3 headings when there are 3+ headings. To optimize:

- Use descriptive but concise headings
- Maintain consistent heading hierarchy (H2 → H3, never skip levels)
- Aim for 4-8 headings per document for good TOC usability

---

## Complete Example

```markdown
# Fryer Operation

Safe operation of deep fryers is essential for preventing burns and fires.

> **⚠️ Critical**: Never leave a hot fryer unattended. Oil fires can start within seconds.

## Before Use

Check the following before turning on the fryer:

1. Oil level is at the fill line
2. No water or ice near the fryer
3. Basket is clean and dry
4. Ventilation hood is running

### Oil Temperature Guide

| Food Type | Temperature | Cook Time |
|-----------|-------------|-----------|
| French Fries | 350°F (175°C) | 3-4 min |
| Chicken | 350°F (175°C) | 12-15 min |
| Fish | 375°F (190°C) | 4-6 min |

## During Operation

> **💡 Tip**: Shake excess ice from frozen items before frying to prevent oil splatter.

- Lower food slowly into oil
- Don't overcrowd the basket
- Monitor oil temperature between batches

## Cleaning Procedure

### Daily Cleaning

1. Turn off and let oil cool completely
2. Filter oil through clean filter
3. Wipe exterior surfaces
4. Clean surrounding floor area

> **ℹ️ Note**: Hot oil takes 2+ hours to cool to a safe handling temperature.

---

*Last updated: February 2024*
```

---

## Features Not Yet Implemented

The following Markdown features are parsed but may have limited styling:

- **Task lists** (`- [ ]` / `- [x]`) — Not specially styled
- **Footnotes** — Not supported
- **Definition lists** — Not supported
- **Abbreviations** — Not supported
- **Charts/Diagrams** — Recharts components exist but not integrated with Markdown

---

## Summary

For the best user experience:

1. ✅ Use clear heading hierarchy (H1 → H2 → H3)
2. ✅ Front-load critical callouts
3. ✅ Use tables for reference data
4. ✅ Keep paragraphs short and scannable
5. ✅ Bold critical values and thresholds
6. ✅ Use ordered lists for procedures
7. ✅ Include horizontal rules for major breaks
8. ✅ Write descriptive alt text for images
