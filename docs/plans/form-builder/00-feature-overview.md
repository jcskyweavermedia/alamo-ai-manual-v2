# Form Builder & AI-Assisted Form Filling — Feature Overview

## Vision

A form system that lets restaurant operators **create, fill, and manage operational forms** (employee write-ups, injury reports, incident logs, etc.) with full AI assistance. Forms can be created and filled via any input method the app already supports: **text, voice, image, Word/PDF/TXT file upload**. The AI assistant understands form structure, reads instructions, uses tools (search contacts, manual, products), and intelligently fills forms from unstructured user input.

---

## Core Concepts

### 1. Form Templates

A **form template** is the blueprint — the structure, fields, instructions, and AI configuration that define a reusable form type.

| Attribute | Description |
|-----------|-------------|
| **Title** | e.g., "Employee Write-Up", "Employee Injury Report" |
| **Description** | What this form is for, when to use it |
| **Slug** | URL-friendly identifier |
| **Icon** | Lucide icon for the card grid |
| **Fields** | Ordered list of field definitions (see Field Schema below) |
| **Instructions** | Step-by-step instructions for filling out the form (AI reads these) |
| **AI Tools** | Which tools the AI can use when filling this form (contacts, manual, products, etc.) |
| **Images** | Header image, logo, or reference images attached to the template |
| **Status** | `draft` / `published` |
| **Language** | `en` / `es` / `both` |
| **Group** | Which restaurant group owns this template |

### 2. Form Submissions

A **form submission** is a filled-out instance of a template — the actual data.

| Attribute | Description |
|-----------|-------------|
| **Template reference** | Which template was used |
| **Field values** | JSONB object mapping field keys to filled values |
| **Status** | `draft` / `completed` / `submitted` / `archived` |
| **Filled by** | User who filled / AI-assisted |
| **Submitted by** | User who submitted |
| **Attachments** | Images, signatures, uploaded evidence |
| **AI session** | Link to the AI conversation that helped fill the form |
| **Created / Updated** | Timestamps |
| **PDF export** | Generated PDF for printing/emailing |

### 3. Field Schema

Each field in a template is a JSON object:

```jsonc
{
  "key": "employee_name",           // Unique identifier within the form
  "label": "Employee Full Name",    // Display label (EN)
  "label_es": "Nombre Completo",    // Display label (ES)
  "type": "text",                   // Field type (see below)
  "required": true,
  "placeholder": "Enter employee's full legal name",
  "section": "Employee Information", // Visual grouping
  "hint": "As it appears on their ID", // Help text
  "ai_hint": "Extract the employee's full name from the input", // AI-specific instruction
  "options": [],                    // For select/radio/checkbox types
  "validation": {},                 // Optional validation rules
  "default": null,                  // Default value
  "order": 1                        // Sort order within section
}
```

**Supported Field Types:**

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text | Employee name, position |
| `textarea` | Multi-line text | Description of incident, corrective action |
| `date` | Date picker | Date of incident, date of write-up |
| `time` | Time picker | Time of incident |
| `datetime` | Date + time | When did the injury occur |
| `select` | Dropdown | Severity level, department |
| `radio` | Radio buttons | Yes/No, type of violation |
| `checkbox` | Multi-select checkboxes | Witnesses present, body parts affected |
| `number` | Numeric input | Number of prior warnings |
| `phone` | Phone number | Emergency contact phone |
| `email` | Email address | HR contact email |
| `signature` | Finger/stylus signature pad (see Signature Capture below) | Employee signature, manager signature |
| `image` | Camera photo or gallery upload (see Photo Capture below) | Photo of injury, photo of incident scene |
| `file` | File attachment | Supporting documents |
| `header` | Section header (display only) | Visual divider between form sections |
| `instructions` | Read-only text block | Special instructions within the form |
| `contact_lookup` | Auto-populated from contacts DB | Hospital to call, regional manager |

---

## Signature Capture (Finger / Stylus)

### Library: `react-signature-canvas`

| Detail | Value |
|--------|-------|
| Package | `react-signature-canvas` (wraps `signature_pad` by szimek) |
| Size | ~3.6 kB gzipped |
| Downloads | ~540K/week |
| TypeScript | Built-in types |
| Mobile | Full touch/pointer/stylus support |
| Exports | PNG, JPEG, SVG, base64 data URL |
| Features | Variable stroke width (velocity-based), clear, undo, resize-safe |
| shadcn/ui | Official block exists (`dialog-signature-pad`), bare `<canvas>` works with any Tailwind wrapper |

### How It Works in the Form

```
┌─────────────────────────────────────────────┐
│  Employee Signature                         │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │      ✍️ Sign here with finger       │   │
│  │                                     │   │
│  │    ~ ~ ~ Juan C. Marchan ~ ~ ~     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│  [Clear]  [Undo]            [✓ Confirm]    │
│                                             │
│  Signed: Feb 23, 2026 at 3:45 PM          │
└─────────────────────────────────────────────┘
```

- Canvas element styled with Tailwind (`w-full h-48 border rounded-md`)
- **`touch-none`** class on container — prevents page scroll while signing
- Clear button: `sigRef.current.clear()`
- Undo (stroke-by-stroke): save/restore via `toData()` / `fromData()`
- On confirm: `getTrimmedCanvas().toDataURL('image/png')` → compress → upload to Supabase Storage

### Storage

Signatures upload to a **Supabase Storage `form-attachments` bucket** (same bucket as photos). A trimmed PNG signature is typically 5–20 kB. The public URL is stored in the submission's `field_values` JSONB:

```jsonc
{
  "employee_signature": {
    "url": "https://nxeorbwqsovybfttemrw.supabase.co/storage/v1/object/public/form-attachments/signatures/abc123.png",
    "signed_at": "2026-02-23T15:45:00Z",
    "signed_by": "user-uuid"
  }
}
```

### Install

```bash
npm install react-signature-canvas
```

---

## Photo Capture & Image Upload

### Approach: Native HTML5 File Input (No Camera Library Needed)

For a BYOD restaurant environment (staff using personal phones/tablets), the native file input is the best approach:

```html
<input type="file" accept="image/*" />
```

| Platform | Behavior |
|----------|----------|
| **iOS Safari** | Shows choice sheet: Take Photo / Photo Library / Browse Files |
| **Android Chrome** | Shows camera + gallery picker |
| **Desktop** | Standard file picker dialog |

**Why not a camera library?** Staff already know their phone's camera. No permissions prompts, no learning curve, no extra bundle size. The OS camera app has better autofocus/exposure than any in-browser solution.

**Note:** We intentionally **omit** the `capture` attribute — this lets users either take a fresh photo OR select an existing one from their gallery (on Android, `capture` forces the camera and removes gallery access).

### Photo Flow

```
Tap [📷 Add Photo]
  → Phone opens camera/gallery (native OS UI)
  → User takes photo or selects from gallery
  → Photo appears as preview in the form
  → [Retake] or [✓ Confirm]
  → On confirm: compress → upload → URL stored
```

### Image Compression: `browser-image-compression`

Modern phones take 3–6 MB photos. We compress on the client before upload.

| Detail | Value |
|--------|-------|
| Package | `browser-image-compression` |
| Size | ~40 kB gzipped |
| Downloads | ~485K/week |
| Processing | Web Worker (non-blocking — UI doesn't freeze) |
| Output | Configurable: JPEG, WebP, PNG |

**Settings for our app:**

```ts
{
  maxSizeMB: 1,             // Max 1 MB output
  maxWidthOrHeight: 1920,   // Scale down oversized photos
  useWebWorker: true,       // Non-blocking
  fileType: 'image/webp'    // Modern format, ~30% smaller than JPEG
}
```

### Multiple Images Per Field

Form fields of type `image` support up to **5 photos** per field, displayed in a thumbnail grid:

```
┌─────────────────────────────────────────────┐
│  Photos of Injury Scene                     │
│                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │  📷    │  │  📷    │  │        │       │
│  │ photo1 │  │ photo2 │  │  [+]   │       │
│  │    [x] │  │    [x] │  │  Add   │       │
│  └────────┘  └────────┘  └────────┘       │
│                                             │
│  2 of 5 photos                             │
└─────────────────────────────────────────────┘
```

- Instant preview via `URL.createObjectURL()` (no server round-trip until confirmed)
- Each photo shows a remove (x) button
- Upload spinner overlay while uploading
- All photos upload to the `form-attachments` Supabase Storage bucket
- URLs stored as an array in `field_values`:

```jsonc
{
  "injury_photos": [
    { "url": "https://...storage.../photo1.webp", "caption": "", "uploaded_at": "..." },
    { "url": "https://...storage.../photo2.webp", "caption": "", "uploaded_at": "..." }
  ]
}
```

### Supabase Storage Bucket

```sql
-- PRIVATE bucket — signatures and injury photos are PII
-- Display requires createSignedUrl(path, 3600) — 1-hour expiry
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-attachments', 'form-attachments', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
);

-- RLS: authenticated users can upload
CREATE POLICY "auth users upload form attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'form-attachments');

-- RLS: authenticated users can read (signed URLs only since bucket is private)
CREATE POLICY "auth users read form attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'form-attachments');
```

### Install

```bash
npm install browser-image-compression
```

---

## Form Builder (Admin)

### Creation Methods

The form builder supports the same multi-modal ingestion the recipe builder uses:

| Method | Flow |
|--------|------|
| **Manual** | Admin builds form field-by-field using a visual builder UI |
| **Voice** | Admin describes the form → AI transcribes → generates template draft |
| **Text chat** | Admin describes in text → AI generates template draft |
| **Image** | Admin uploads photo of a paper form → AI vision extracts fields → generates template draft |
| **Word/PDF/TXT** | Admin uploads existing form document → AI extracts structure → generates template draft |

All AI-assisted methods produce a **draft template** that the admin reviews, edits, and publishes.

### Builder UI

Follows the same card-based pattern as recipe ingestion:

```
┌─────────────────────────────────────────────┐
│  Form Builder                    [Save Draft]│
├─────────────────────────────────────────────┤
│                                             │
│  📋 Form Title: ___________________________│
│  📝 Description: __________________________│
│  🖼️ Header Image: [Upload] [Preview]       │
│                                             │
│  ─── Fields ───────────────────────────────│
│                                             │
│  [+ Add Field]  [+ Add Section Header]      │
│                                             │
│  ┌─ Section: Employee Information ────────┐│
│  │ 📌 Employee Name    [text] [required]  ││
│  │ 📌 Position         [text] [required]  ││
│  │ 📌 Department       [select] [req]     ││
│  │ 📌 Date of Hire     [date]             ││
│  └────────────────────── [drag to reorder]─┘│
│                                             │
│  ┌─ Section: Incident Details ────────────┐│
│  │ 📌 Date of Incident [date] [required]  ││
│  │ 📌 Description      [textarea] [req]   ││
│  │ 📌 Witnesses        [checkbox]         ││
│  └────────────────────── [drag to reorder]─┘│
│                                             │
│  ─── Instructions (for AI) ────────────────│
│  [Rich text editor for step-by-step        │
│   instructions the AI reads when filling]  │
│                                             │
│  ─── AI Tools ─────────────────────────────│
│  ☑ Search Contacts (Who to Call)           │
│  ☑ Search Manual                           │
│  ☐ Search Menu / Products                  │
│  ☐ Search Employee Handbook                │
│                                             │
│  ─── Recommended Tools ────────────────────│
│  💡 Based on field types, we recommend:    │
│  • "Contact Lookup" field detected →       │
│     enabling "Search Contacts" tool        │
│  • "Injury" in title →                     │
│     enabling "Search Manual (Emergency)"   │
│                                             │
│  [Preview Form]  [Publish]                 │
└─────────────────────────────────────────────┘
```

### Smart Tool Recommendations

When the admin adds fields or sets the form title, the builder analyzes context and suggests which AI tools to enable:

| Signal | Recommended Tool |
|--------|-----------------|
| Field type `contact_lookup` or field label contains "hospital", "doctor", "call" | Search Contacts |
| Title/description contains "injury", "medical", "emergency", "safety" | Search Manual (Emergency/Safety sections) |
| Title/description contains "food", "recipe", "menu", "ingredient" | Search Products |
| Field label contains "policy", "procedure", "handbook", "standard" | Search Manual (full) |
| Any form (baseline) | Search Contacts + Search Manual |

---

## Form Viewer (All Users)

### Forms Page (`/forms`)

Grid of form template cards — same pattern as Recipes, Dishes, etc.

```
┌─────────────────────────────────────────────┐
│  📋 Forms                        🔍 [Search]│
├─────────────────────────────────────────────┤
│                                             │
│  📌 Pinned                                  │
│  ┌──────────┐  ┌──────────┐                │
│  │ 📝       │  │ 🏥       │                │
│  │ Employee │  │ Employee │                │
│  │ Write-Up │  │ Injury   │                │
│  └──────────┘  └──────────┘                │
│                                             │
│  All Forms                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 📝       │  │ 🏥       │  │ 📋       │ │
│  │ Employee │  │ Employee │  │ Daily    │ │
│  │ Write-Up │  │ Injury   │  │ Checklist│ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Search/filter forms by name
- Pin/unpin forms (localStorage, same as `usePinnedRecipes` pattern)
- Click → opens Form Detail view
- Admin badge for edit access

### Form Detail / Fill View

When a user selects a form, they see the card view with the form fields to fill:

```
┌─────────────────────────────────────────────┐
│  ← Back    Employee Write-Up      [AI Fill] │
├─────────────────────────────────────────────┤
│                                             │
│  ─── Employee Information ─────────────────│
│  Employee Name: ___________________________│
│  Position: ________________________________│
│  Department: [▼ Select]                    │
│  Date of Hire: [📅 Pick]                   │
│                                             │
│  ─── Incident Details ─────────────────────│
│  Date: [📅]  Time: [🕐]                   │
│  Description:                              │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Witnesses: ☐ Name1  ☐ Name2  ☐ Other     │
│                                             │
│  ─── Attachments ──────────────────────────│
│  [📷 Add Photo]  [📎 Add File]             │
│                                             │
│  ─── Signatures ───────────────────────────│
│  Employee: [Sign here]                     │
│  Manager:  [Sign here]                     │
│                                             │
│  [Save Draft]  [Submit Form]               │
└─────────────────────────────────────────────┘
```

---

## AI-Assisted Form Filling

### Two Entry Points

#### 1. From the Forms Page (Direct)

User navigates to `/forms` → selects a form → clicks **[AI Fill]** button → AI panel opens (docked on desktop, drawer on mobile — same pattern as product AI).

The AI:
1. Reads the form's instructions
2. Asks the user to describe the situation (text, voice, image, file upload)
3. Extracts field values from user input
4. Uses enabled tools to look up missing data (e.g., hospital contact from Who to Call)
5. Pre-fills the form with extracted values
6. Highlights any holes or ambiguities: "I wasn't able to determine the department — which department does this employee work in?"
7. User reviews, edits, confirms

#### 2. From the Main AI Chat (`/ask`)

User opens the main AI chat and says something like:

> "I need to fill out an injury report. John Smith in the kitchen cut his hand with a knife at 3pm today."

The AI:
1. **Recognizes** the intent: form filling
2. **Searches** available form templates → finds "Employee Injury Report"
3. **Displays** the matched form(s) with a confirmation prompt:
   > "I found the **Employee Injury Report** form. Is this the one you'd like to fill out?"
   >
   > 📋 Employee Injury Report
   > 📝 Employee Write-Up
   >
   > *[navigates to most likely match]*
4. After user confirms, the AI:
   - **Navigates** to the form detail page
   - **Pre-fills** fields from the information already provided
   - **Runs tools**: searches contacts for nearest hospital, checks manual for injury protocol
   - **Shows the filled form** and asks for any missing information
5. User reviews and submits

### AI Tool Use During Form Filling

When filling a form, the AI has access to **form-specific tools** configured in the template:

| Tool | What It Does | Example Use |
|------|-------------|-------------|
| `search_contacts` | Searches the contacts/vendors table | "Find the nearest hospital and their phone number" |
| `search_manual` | Searches manual sections via hybrid search | "Look up the injury reporting procedure" |
| `search_products` | Searches product tables | "What allergens are in the Caesar salad?" |
| `get_form_instructions` | Reads the form's built-in instructions | AI follows step-by-step guidance |
| `lookup_employee` | (Future) Searches employee records | "Get John Smith's hire date and department" |

The AI reads the form's **instructions** field to understand the workflow. For example, the Employee Injury form instructions might say:

> **Step 1:** Record the injured employee's information.
> **Step 2:** Document the incident details — what happened, when, where.
> **Step 3:** Use the "Search Contacts" tool to look up the nearest hospital and the regional manager's contact.
> **Step 4:** Record any witnesses.
> **Step 5:** Note any immediate actions taken (first aid, 911 call, etc.).
> **Step 6:** Get signatures from the employee (if able) and the manager on duty.

---

## Database Schema

### `form_templates` Table

```sql
CREATE TABLE form_templates (
  id               UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES groups(id),
  slug             TEXT UNIQUE NOT NULL,
  title_en         TEXT NOT NULL,
  title_es         TEXT,
  description_en   TEXT,
  description_es   TEXT,
  icon             TEXT DEFAULT 'ClipboardList',
  header_image     TEXT,                          -- URL to header image
  fields           JSONB NOT NULL DEFAULT '[]',   -- Array of field definitions
  instructions_en  TEXT,                          -- Step-by-step for AI (EN)
  instructions_es  TEXT,                          -- Step-by-step for AI (ES)
  ai_tools         TEXT[] DEFAULT '{}',           -- Enabled AI tools: {'search_contacts','search_manual','search_products'}
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order       INTEGER DEFAULT 0,
  template_version INTEGER NOT NULL DEFAULT 1,    -- Bumped on publish-edit; submissions record which version
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  -- Search (FTS only; embedding deferred to Phase 7)
  search_vector    TSVECTOR
);
```

### `form_submissions` Table

```sql
CREATE TABLE form_submissions (
  id               UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
  group_id         UUID NOT NULL REFERENCES groups(id),
  template_version INTEGER NOT NULL DEFAULT 1,       -- Which template version was used
  fields_snapshot  JSONB,                            -- Copy of template.fields at submission time
  field_values     JSONB NOT NULL DEFAULT '{}',      -- { "employee_name": "John Smith", ... }
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','submitted','archived')),
  filled_by        UUID NOT NULL REFERENCES profiles(id),  -- Who filled it
  submitted_by     UUID REFERENCES profiles(id),           -- Who submitted
  subject_user_id  UUID REFERENCES profiles(id),           -- Who the form is ABOUT (nullable)
  submitted_at     TIMESTAMPTZ,
  attachments      JSONB DEFAULT '[]',               -- [{ type, url, field_key, caption }]
  ai_session_id    TEXT,                             -- Link to AI conversation
  notes            TEXT,                             -- Internal notes
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

### `contacts` Table (Who to Call)

The current `contact-info` manual section has all placeholder data (`[Hospital Name]`, `[Phone Number]`, etc.). For the AI to actually look up contacts during form filling, we need a **structured, searchable table**:

```sql
CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id),
  category        TEXT NOT NULL,                 -- 'emergency','vendor','management','government','medical'
  subcategory     TEXT,                          -- 'hospital','urgent_care','fire_dept','meat_supplier', etc.
  name            TEXT NOT NULL,                 -- "Methodist Hospital", "John's Meats"
  contact_person  TEXT,                          -- "Dr. Smith", "Maria (Account Rep)"
  phone           TEXT,
  phone_alt       TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,                          -- "24/7 ER", "Delivery Mon-Fri 6am"
  is_priority     BOOLEAN NOT NULL DEFAULT false,-- Pin/highlight important contacts
  is_demo_data    BOOLEAN NOT NULL DEFAULT false,-- TRUE for seed data; UI shows warning
  sort_order      INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  -- Search (FTS only; embedding deferred to Phase 7)
  search_vector   TSVECTOR,
  -- Prevent exact duplicates within same group+category
  UNIQUE (group_id, name, category)
);
```

This replaces the placeholder markdown in the manual section with **queryable, structured data** the AI can search during form filling.

---

## Initial Form Templates

### Form 1: Employee Write-Up

**Purpose:** Document employee performance issues, policy violations, or behavioral concerns.

**Sections & Fields:**

| Section | Field | Type | Required |
|---------|-------|------|----------|
| **Employee Info** | Employee Full Name | text | yes |
| | Position / Title | text | yes |
| | Department | select (FOH/BOH/Bar/Management) | yes |
| | Date of Hire | date | no |
| | Supervisor Name | text | yes |
| **Write-Up Details** | Date of Incident | date | yes |
| | Type of Violation | select (Attendance/Performance/Conduct/Policy/Safety/Other) | yes |
| | Severity | radio (Verbal Warning/Written Warning/Final Warning/Suspension/Termination) | yes |
| | Number of Prior Warnings | number | no |
| **Incident Description** | Description of Incident | textarea | yes |
| | Employee's Explanation | textarea | no |
| | Corrective Action Required | textarea | yes |
| | Timeline for Improvement | text | no |
| **Supporting Evidence** | Attach Photos/Documents | file | no |
| **Acknowledgment** | Employee Signature | signature | no |
| | Manager Signature | signature | yes |
| | Date Signed | date | yes |
| | Employee Refused to Sign | checkbox | no |

**AI Tools:** `search_manual` (employee handbook policies)

**Instructions (for AI):**
> 1. Identify the employee and their role from the user's description.
> 2. Determine the type and severity of the violation.
> 3. Write a factual, professional description of the incident — no opinions, just facts.
> 4. Suggest appropriate corrective action based on the severity.
> 5. If the user mentions prior incidents, note the count of previous warnings.
> 6. Use the manual search to reference relevant company policies if applicable.

---

### Form 2: Employee Injury Report

**Purpose:** Document workplace injuries, ensure proper medical response, and maintain compliance records.

**Sections & Fields:**

| Section | Field | Type | Required |
|---------|-------|------|----------|
| **Injured Employee** | Employee Full Name | text | yes |
| | Position / Title | text | yes |
| | Department | select (FOH/BOH/Bar/Management) | yes |
| | Date of Hire | date | no |
| **Incident Details** | Date of Injury | date | yes |
| | Time of Injury | time | yes |
| | Location in Restaurant | select (Kitchen/Dining Room/Bar/Patio/Parking/Storage/Office/Restroom/Other) | yes |
| | Description of Injury | textarea | yes |
| | Body Part(s) Affected | checkbox (Head/Neck/Back/Shoulder/Arm/Hand/Finger/Leg/Knee/Foot/Torso/Other) | yes |
| | Type of Injury | select (Cut/Burn/Slip-Fall/Strain/Fracture/Chemical/Other) | yes |
| **Immediate Response** | First Aid Administered | textarea | no |
| | 911 Called | radio (Yes/No) | yes |
| | Transported to Hospital | radio (Yes/No) | yes |
| | Hospital / Medical Facility | contact_lookup (category: medical) | conditional |
| | Regional Manager Notified | radio (Yes/No) | yes |
| | Regional Manager Contact | contact_lookup (category: management) | conditional |
| **Witnesses** | Witnesses Present | radio (Yes/No) | yes |
| | Witness Names & Statements | textarea | conditional |
| **Root Cause** | What Caused the Injury | textarea | yes |
| | Could It Have Been Prevented | radio (Yes/No/Unsure) | no |
| | Corrective Action Taken | textarea | no |
| **Attachments** | Photos of Scene/Injury | image | no |
| | Supporting Documents | file | no |
| **Signatures** | Injured Employee Signature | signature | no |
| | Manager on Duty Signature | signature | yes |
| | Date Signed | date | yes |

**AI Tools:** `search_contacts`, `search_manual`

**Instructions (for AI):**
> 1. Record the injured employee's information (name, position, department).
> 2. Document exactly what happened — when, where, how. Be specific and factual.
> 3. Identify the type of injury and body parts affected from the description.
> 4. **CRITICAL — Use the "Search Contacts" tool to look up:**
>    - The nearest hospital or urgent care facility (category: "medical")
>    - The regional manager's contact information (category: "management")
>    - Pre-fill the Hospital and Regional Manager fields with this data.
> 5. Note any first aid or immediate actions taken.
> 6. Record witness information if anyone saw what happened.
> 7. Assess root cause — what led to the injury and if it could be prevented.
> 8. Use "Search Manual" to reference the emergency procedures section for compliance.

---

## AI Integration Architecture

### New Edge Function: `/ask-form`

Extends the existing `/ask` pattern with form-specific capabilities:

```
POST /functions/v1/ask-form
{
  "question": "John cut his hand on the slicer at 3pm",
  "templateId": "uuid-of-injury-form",
  "currentValues": { ... },         // Already-filled fields
  "language": "en",
  "groupId": "uuid"
}

Response:
{
  "fieldUpdates": {                  // AI-extracted field values
    "employee_name": "John",
    "description": "Employee cut his hand on the meat slicer at approximately 3:00 PM",
    "time_of_injury": "15:00",
    "type_of_injury": "Cut",
    "body_parts": ["Hand"],
    "location": "Kitchen"
  },
  "missingFields": ["employee_last_name", "department"],
  "followUpQuestion": "What is John's last name and which department does he work in?",
  "toolResults": {
    "hospital": { "name": "Methodist Hospital", "phone": "210-555-1234", "address": "..." },
    "regional_manager": { "name": "Sarah Johnson", "phone": "210-555-5678" }
  },
  "citations": [...],
  "usage": { ... }
}
```

### Main AI Chat Integration (`/ask` enhancement)

Add a new tool to the existing `/ask` function's tool-use loop:

```jsonc
{
  "name": "search_forms",
  "description": "Search available form templates by name or purpose",
  "parameters": {
    "query": "injury report",
    "match_count": 5
  }
}
```

When the main AI detects form-filling intent:
1. Calls `search_forms` tool to find matching templates
2. Returns results with `mode: "form_navigation"`
3. Frontend receives the form slug(s) and renders the confirmation UI
4. On confirmation, navigates to `/forms/{slug}` and passes extracted context

### Search Function: `search_forms`

```sql
CREATE FUNCTION search_forms(
  search_query TEXT,
  search_language TEXT DEFAULT 'en',
  match_count INT DEFAULT 5,
  p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, slug TEXT, title TEXT, description TEXT, icon TEXT, score FLOAT)
AS $$ ... $$  -- Same RRF hybrid pattern as other search functions
```

---

## Navigation & Routing

### New Routes

```
/forms                    → FormsList page (grid of form template cards)
/forms/:slug              → FormDetail page (view/fill form)
/forms/:slug/submissions  → FormSubmissions page (list of filled forms, admin)
/admin/forms              → FormBuilder list (admin)
/admin/forms/new          → FormBuilder new template (admin)
/admin/forms/:id/edit     → FormBuilder edit template (admin)
```

### Navigation Integration

- Add "Forms" to the main navigation sidebar/menu
- Forms icon in the app shell header
- Accessible from the main AI chat via form intent detection

---

## Phases (Implementation Order)

---

### Phase 1 — Database Foundation
> Estimated: ~1 session. No frontend changes.

**Goal:** All tables, indexes, RLS policies, search functions, seed data, and storage bucket — everything the frontend needs to build against.

**Deliverables:**
1. **Migration: `form_templates` table**
   - Schema as defined in Database Schema section above
   - FTS trigger: auto-populate `search_vector` from `title_en`, `title_es`, `description_en`, `description_es`
   - GIN index on `search_vector`
   - HNSW index on `embedding` (for future Phase 7 embeddings)
   - RLS policies: SELECT (authenticated), INSERT/UPDATE/DELETE (admin only)

2. **Migration: `form_submissions` table**
   - Schema as defined above
   - RLS policies: SELECT own submissions (authenticated), SELECT all (admin), INSERT (authenticated), UPDATE own (authenticated), DELETE (admin)

3. **Migration: `contacts` table**
   - Schema as defined above
   - FTS trigger: auto-populate `search_vector` from `name`, `category`, `subcategory`, `contact_person`, `notes`
   - GIN index on `search_vector`
   - HNSW index on `embedding`
   - RLS policies: SELECT (authenticated), INSERT/UPDATE/DELETE (admin only)

4. **Migration: Supabase Storage bucket `form-attachments`**
   - Public bucket for signatures + photos
   - RLS: authenticated can upload + read

5. **Migration: Seed form templates**
   - Employee Write-Up template (all fields as JSONB, instructions, AI tools)
   - Employee Injury Report template (all fields, instructions, AI tools including `search_contacts`)
   - Both set to `status = 'published'`

6. **Migration: Seed contacts**
   - Demo/example contacts for: emergency services, medical facilities, management, vendors
   - Clearly marked as example data (editable by admin)

7. **Migration: `search_forms()` PostgreSQL function**
   - FTS-only initially (embeddings come in Phase 7)
   - Same pattern as `search_dishes()`: accepts `search_query`, `search_language`, `match_count`, `p_group_id`
   - Returns: `id`, `slug`, `title`, `description`, `icon`, `score`
   - `SECURITY DEFINER`, `search_path` set, `status = 'published'` filter

8. **Migration: `search_contacts()` PostgreSQL function**
   - FTS-only initially
   - Accepts: `search_query`, `match_count`, `p_group_id`, optional `p_category` filter
   - Returns: `id`, `name`, `category`, `subcategory`, `phone`, `contact_person`, `address`, `score`
   - `SECURITY DEFINER`, `search_path` set, `status = 'active'` filter

**Verification:**
- `SELECT * FROM form_templates` returns 2 published templates
- `SELECT * FROM contacts` returns seeded contacts
- `SELECT * FROM search_forms('injury')` returns the injury form
- `SELECT * FROM search_contacts('hospital')` returns medical contacts
- RLS test: non-admin can read but not write templates/contacts
- RLS test: user can create/read own submissions, cannot read others'
- Storage: authenticated user can upload to `form-attachments` bucket

**Files created:**
```
supabase/migrations/
  YYYYMMDD_create_form_templates.sql
  YYYYMMDD_create_form_submissions.sql
  YYYYMMDD_create_contacts.sql
  YYYYMMDD_create_form_attachments_bucket.sql
  YYYYMMDD_seed_form_templates.sql
  YYYYMMDD_seed_contacts.sql
  YYYYMMDD_create_search_forms.sql
  YYYYMMDD_create_search_contacts.sql
```

---

### Phase 2 — Form Viewer (Read + Fill)
> Estimated: ~2 sessions. Frontend only (no edge functions).

**Goal:** Users can browse forms, open a form, fill it out manually (all field types working), save drafts, and submit. No AI yet.

**Deliverables:**

1. **Forms List Page (`/forms`)**
   - Card grid layout (same pattern as `Recipes.tsx`)
   - Search bar with live filtering
   - Pinned forms at top (localStorage via `usePinnedForms`)
   - Form cards show: icon, title, description snippet, status badge
   - Click navigates to `/forms/:slug`
   - Admin badge + edit link for admin users

2. **Data Hooks**
   - `useFormTemplates()` — fetches published templates from Supabase with React Query caching
   - `usePinnedForms()` — localStorage pin/unpin (mirrors `usePinnedRecipes`)
   - `useFormViewer()` — manages selected form, search query, filtered list
   - `useFormSubmission(templateId)` — CRUD for a single submission (create draft, update fields, submit)
   - `useFormSubmissions(templateId)` — list submissions for a template (admin view)

3. **Field Renderer Components**
   - `FormFieldRenderer.tsx` — switch on field type, renders the appropriate input
   - `TextField`, `TextareaField`, `DateField`, `TimeField`, `DateTimeField`
   - `SelectField`, `RadioField`, `CheckboxField`, `NumberField`
   - `PhoneField`, `EmailField`
   - `SignaturePadField` — `react-signature-canvas` wrapper with clear/undo/confirm
   - `ImageUploadField` — native file input + preview grid + compression + Supabase upload
   - `FileUploadField` — file attachment upload
   - `ContactLookupField` — searchable dropdown that queries `contacts` table
   - `HeaderField`, `InstructionsField` — display-only section dividers
   - All fields support: `required` validation, `placeholder`, `hint` text, `disabled` state, bilingual labels

4. **Form Detail Page (`/forms/:slug`)**
   - Header: back button, form title, icon, AI Fill button (disabled in this phase)
   - Sections rendered from template `fields` JSONB
   - All field types functional
   - Conditional field visibility (show/hide based on other field values)
   - [Save Draft] button — persists to `form_submissions` with status `draft`
   - [Submit Form] button — validates required fields, sets status `submitted`
   - Success confirmation after submit

5. **Navigation**
   - Add "Forms" link to main nav sidebar/menu
   - Add route `/forms` and `/forms/:slug` to `App.tsx`
   - Protected routes (authenticated only)

**Verification:**
- Forms grid renders with 2 seed forms
- Pin/unpin works across page reloads
- Search filters forms by title
- Each field type renders and captures input correctly
- Signature pad: draw with finger → clear → undo → confirm → uploads to storage
- Image field: take photo / select from gallery → preview → compress → upload
- Required field validation prevents submission when empty
- Draft save persists and reloads on return
- Submit changes status and shows confirmation
- Mobile responsive: form fills well on phone-width screens

**Files created:**
```
src/pages/Forms.tsx
src/pages/FormDetail.tsx
src/hooks/use-form-templates.ts
src/hooks/use-form-viewer.ts
src/hooks/use-pinned-forms.ts
src/hooks/use-form-submission.ts
src/hooks/use-form-submissions.ts
src/components/forms/FormCard.tsx
src/components/forms/FormCardGrid.tsx
src/components/forms/FormFieldRenderer.tsx
src/components/forms/fields/TextField.tsx
src/components/forms/fields/TextareaField.tsx
src/components/forms/fields/DateField.tsx
src/components/forms/fields/TimeField.tsx
src/components/forms/fields/SelectField.tsx
src/components/forms/fields/RadioField.tsx
src/components/forms/fields/CheckboxField.tsx
src/components/forms/fields/NumberField.tsx
src/components/forms/fields/SignaturePadField.tsx
src/components/forms/fields/ImageUploadField.tsx
src/components/forms/fields/FileUploadField.tsx
src/components/forms/fields/ContactLookupField.tsx
src/components/forms/fields/HeaderField.tsx
src/components/forms/fields/InstructionsField.tsx
```

---

### Phase 3 — AI Form Filling
> Estimated: ~2 sessions. Edge function + frontend integration.

**Goal:** User clicks [AI Fill] on a form, describes the situation via text/voice/image/file, and the AI extracts field values, uses tools, pre-fills the form, and asks about gaps.

**Deliverables:**

1. **Edge Function: `/ask-form`**
   - Auth: `verify_jwt: false`, manual `getUser()` (same pattern as `/ask-product`)
   - Usage limits: shared counters with existing AI limits
   - Input: `{ question, templateId, currentValues, language, groupId, attachments? }`
   - Reads template from DB (fields + instructions + ai_tools)
   - Builds system prompt: form structure + instructions + current values + available tools
   - OpenAI function calling with enabled tools:
     - `search_contacts(query, category?)` — calls `search_contacts` RPC
     - `search_manual(query)` — calls existing `hybrid_search_manual` RPC
     - `search_products(query, domain)` — calls existing product search RPCs
     - `get_form_instructions()` — returns the template's instructions field
   - Multi-turn tool-use loop (max 3 rounds, same as `/ask`)
   - Output: `{ fieldUpdates, missingFields, followUpQuestion, toolResults, citations, usage }`

2. **Frontend: `useAskForm` Hook**
   - Sends user input to `/ask-form`
   - Receives field updates and applies to form state
   - Manages conversation session (multi-turn follow-ups)
   - Handles loading, error, streaming states

3. **AI Panel Integration**
   - [AI Fill] button on form detail page (top-right, colored accent)
   - Desktop: `DockedFormAIPanel.tsx` (reuses `DockedProductAIPanel` pattern)
   - Mobile: `FormAIDrawer.tsx` (bottom drawer, same as `ProductAIDrawer`)
   - Panel contains:
     - `AskAboutContent`-style input (text box + voice button + file upload)
     - AI response display with extracted fields highlighted
     - "Apply to form" button that writes AI-extracted values into the form fields
     - Follow-up question display with answer input
   - Multi-modal input:
     - Text: type description → AI extracts
     - Voice: record → transcribe → AI extracts
     - Image: upload photo (e.g., handwritten incident report) → AI vision extracts
     - File: upload Word/PDF/TXT → AI extracts

4. **Field Highlight on AI Fill**
   - When AI fills fields, highlight them with a subtle glow/border color
   - User can see which fields were AI-populated vs. manually entered
   - Fields with `missingFields` show a gentle prompt indicator

**Verification:**
- Text input → AI correctly extracts fields for both Write-Up and Injury forms
- Voice input → transcription → field extraction works
- Image of handwritten form → AI vision extracts fields
- Employee Injury: AI auto-calls `search_contacts` to find hospital + regional manager
- Employee Write-Up: AI references manual policies when relevant
- Follow-up questions work: AI asks for missing info, user responds, fields update
- Multi-turn conversation maintains context
- Mobile drawer and desktop docked panel both work

**Files created:**
```
supabase/functions/ask-form/index.ts
src/hooks/use-ask-form.ts
src/components/forms/DockedFormAIPanel.tsx
src/components/forms/FormAIDrawer.tsx
src/components/forms/FormAIFillButton.tsx
```

---

### Phase 4 — Main AI Chat Integration
> Estimated: ~1 session. Edge function update + frontend navigation.

**Goal:** User can say "I need to fill out an injury report" in the main `/ask` chat, and the AI finds the form, shows options, navigates to it, and passes extracted context.

**Deliverables:**

1. **`/ask` Edge Function Enhancement**
   - Add `search_forms` tool to the existing tool-use definitions
   - Tool schema: `{ query: string, match_count?: number }`
   - When AI detects form-filling intent, it calls `search_forms`
   - Response includes: `mode: "form_navigation"`, `forms: [{ slug, title, icon, description }]`
   - AI extracts any context from the user's message for pre-fill passthrough

2. **Frontend: Form Navigation from Chat**
   - When `/ask` returns `mode: "form_navigation"`:
     - Display form card(s) as selectable options in the chat
     - Highlight the most likely match
     - "Is this the form you want to fill out?" confirmation
   - On confirmation:
     - Navigate to `/forms/:slug`
     - Pass extracted context via URL state or context provider
     - Form detail page detects pre-fill context and auto-opens AI panel
     - AI panel auto-sends the extracted context as the first message

3. **Intent Detection Prompt Update**
   - Update the `/ask` system prompt to recognize form-related intents:
     - "fill out a form", "write-up", "incident report", "injury report"
     - "I need to document...", "file a report..."
   - AI learns to route to `search_forms` tool when it detects these patterns

**Verification:**
- "I need to fill out an injury report" → AI finds Employee Injury form → shows confirmation
- "Write up John for being late" → AI finds Employee Write-Up → navigates with context
- Pre-fill passthrough: information from the chat message appears in the form fields
- AI panel auto-opens with context on navigation
- Edge case: ambiguous query → AI shows multiple form options
- Edge case: no matching form → AI says no forms found and suggests alternatives

**Files modified:**
```
supabase/functions/ask/index.ts          (add search_forms tool)
src/pages/Ask.tsx                        (form navigation handler)
src/components/chat/FormNavigationCard.tsx (new: form option cards in chat)
src/pages/FormDetail.tsx                 (accept pre-fill context)
```

---

### Phase 5 — Form Builder (Admin)
> Estimated: ~3 sessions. Admin-only frontend + ingestion.

**Goal:** Admins can create and edit form templates visually, with drag-and-drop field ordering, AI tool configuration, and AI-assisted template creation from voice/image/file.

**Deliverables:**

1. **Form Builder Page (`/admin/forms/new` + `/admin/forms/:id/edit`)**
   - Form metadata: title (EN/ES), description (EN/ES), icon picker, header image upload
   - Field list with drag-and-drop reordering (e.g., `@dnd-kit/sortable`)
   - Add field button → field type picker → configure field (label, type, required, options, hints)
   - Section headers as special field type for visual grouping
   - Edit/delete fields inline
   - Live preview toggle: see the form as users would see it

2. **AI Tools Configuration Panel**
   - Toggle switches for each available AI tool
   - Smart recommendations based on form title + field types (keyword matching)
   - Tool descriptions explaining what each does

3. **Instructions Editor**
   - Rich text / markdown editor for AI instructions (EN/ES)
   - Template snippets: common instruction patterns the admin can insert
   - Preview of how the AI will interpret the instructions

4. **AI-Assisted Template Creation**
   - Same multi-modal ingestion pattern as recipe builder:
     - Voice → transcribe → AI generates template draft
     - Image (photo of paper form) → AI vision → template draft
     - Word/PDF/TXT upload → AI extracts → template draft
     - Text description → AI generates template draft
   - All produce a draft that the admin reviews and edits in the builder

5. **Admin Forms List (`/admin/forms`)**
   - Table view of all templates (draft + published + archived)
   - Status badges, edit links, publish/unpublish toggle
   - Delete with confirmation

**Verification:**
- Create a new form template from scratch using the builder
- Drag-and-drop field reordering works
- AI tool toggles save correctly
- AI-assisted creation: upload photo of a paper form → reasonable template draft
- Edit existing template, publish, verify it appears on `/forms` page
- Preview mode shows the form as users would see it

**Files created:**
```
src/pages/AdminFormBuilder.tsx
src/pages/AdminFormsList.tsx
src/components/forms/builder/FieldConfigurator.tsx
src/components/forms/builder/FieldTypePicker.tsx
src/components/forms/builder/DraggableFieldList.tsx
src/components/forms/builder/AIToolsPanel.tsx
src/components/forms/builder/InstructionsEditor.tsx
src/components/forms/builder/FormPreview.tsx
src/components/forms/builder/TemplateIngestionPanel.tsx
src/hooks/use-form-builder.ts
```

---

### Phase 6 — Contacts Management (Who to Call)
> Estimated: ~1-2 sessions. Frontend viewer + admin CRUD.

**Goal:** Standalone "Who to Call" page for all users, plus admin interface for managing contacts. Contacts are searchable from the main app and usable by AI during form filling.

**Deliverables:**

1. **Contacts Page (`/contacts` or within `/forms`)**
   - Card/list view grouped by category (Emergency, Medical, Management, Vendors, etc.)
   - Search bar with live filtering
   - Priority contacts pinned to top
   - Click-to-call on phone numbers (mobile `tel:` links)
   - Click-to-email on email addresses

2. **Data Hooks**
   - `useContacts(category?)` — fetches contacts from Supabase, optional category filter
   - `useSearchContacts(query)` — calls `search_contacts` RPC for real-time search

3. **Admin Contacts Management**
   - Add/edit/delete contacts (admin only)
   - Category/subcategory assignment
   - Priority toggle
   - Bulk import from CSV (future)

4. **AI-Assisted Contact Ingestion**
   - Same multi-modal pattern: voice/image/file → AI extracts contact details
   - Useful for: "photograph the business card" → AI extracts name, phone, email, company

5. **Navigation**
   - "Who to Call" link in main nav or under Forms section
   - Accessible from AI form filling (search_contacts tool already built in Phase 1)

**Verification:**
- Contacts page renders grouped by category
- Search works across name, category, notes
- Phone numbers are click-to-call on mobile
- Admin can add/edit/delete contacts
- Changes reflect in AI form filling (search_contacts returns updated data)

**Files created:**
```
src/pages/Contacts.tsx
src/hooks/use-contacts.ts
src/hooks/use-search-contacts.ts
src/components/contacts/ContactCard.tsx
src/components/contacts/ContactGrid.tsx
src/components/contacts/ContactEditor.tsx
```

---

### Phase 7 — Polish & Advanced Features
> Estimated: ~2-3 sessions. Cross-cutting enhancements.

**Goal:** Production-quality polish, advanced features, and full bilingual support.

**Deliverables:**

1. **PDF Export**
   - Generate printable PDF from completed form submissions
   - Include: form title, all fields + values, signatures as images, photos as thumbnails
   - Library: `@react-pdf/renderer` or server-side via edge function
   - Download button + email option on submitted forms

2. **Form Submission History & Audit Trail**
   - `/forms/:slug/submissions` page (admin) — list all submissions for a template
   - Sortable by date, status, filled-by
   - View any past submission in read-only mode
   - Audit trail: who created, who edited, when submitted

3. **Signature Pad Enhancements**
   - Typed-name fallback option (for cases where finger signing is impractical)
   - Signature timestamp + IP logging
   - "Employee Refused to Sign" checkbox bypasses signature requirement

4. **Image Annotation**
   - Mark up injury photos: draw circles, arrows, text labels on uploaded images
   - Useful for: "circle where the injury occurred on this body diagram"
   - Library: lightweight canvas overlay

5. **Embeddings for Forms + Contacts**
   - Generate embeddings for form templates (title + description + field labels)
   - Generate embeddings for contacts (name + category + notes)
   - Upgrade `search_forms` and `search_contacts` to hybrid RRF (FTS + vector)
   - Deploy via `embed-products` extension or new `embed-forms` edge function

6. **Bilingual Form Support**
   - Form field labels render in user's selected language (`label_en` / `label_es`)
   - Instructions switch by language
   - AI responds in the user's selected language

7. **Form Template Versioning**
   - When admin edits a published template, create a new version
   - Past submissions reference the version they were filled against
   - Version history viewable in admin

8. **Notification System (stretch)**
   - On submission: notify relevant people (configurable per template)
   - e.g., HR gets notified on write-ups, regional manager on injuries
   - Channels: in-app notification, email (future)

**Verification:**
- PDF exports are readable and include all form data
- Submission history is accurate and searchable
- Bilingual toggle works across all form elements
- Hybrid search returns better results than FTS-only
- Template versioning preserves history correctly

---

## Dependency Graph

```
Phase 1 (DB Foundation)
  ↓
Phase 2 (Form Viewer)  ←→  Phase 6 (Contacts Management)
  ↓
Phase 3 (AI Form Filling)
  ↓
Phase 4 (Main AI Chat Integration)
  ↓
Phase 5 (Form Builder - Admin)
  ↓
Phase 7 (Polish & Advanced)
```

Phase 2 and Phase 6 can run in parallel.
Phase 5 (Builder) comes after the viewer is solid — "use it before you build it."

---

## Technical Patterns (Reuse from Existing Codebase)

| Pattern | Existing Implementation | Reuse For |
|---------|------------------------|-----------|
| Card grid + search + pin | `Recipes.tsx` + `usePinnedRecipes` | Forms list page |
| Card detail view | `RecipeCardView.tsx`, `DishCardView.tsx` | Form detail view |
| Docked AI panel | `DockedProductAIPanel.tsx` + `ProductAIDrawer.tsx` | AI form-fill panel |
| Data hooks | `useSupabaseDishes()`, `useSupabaseRecipes()` | `useFormTemplates()` |
| Viewer hooks | `useRecipeViewer()`, `useDishViewer()` | `useFormViewer()` |
| AI hooks | `useAskProduct()` | `useAskForm()` |
| File upload | `useImageUpload()`, `useFileUpload()` | Form attachments + AI ingestion |
| Voice input | `transcribe` edge function + `VoiceChatInput` | Voice form filling |
| Hybrid search | `search_dishes()`, `search_manual()` | `search_forms()`, `search_contacts()` |
| Edge function auth | `/ask-product` auth pattern | `/ask-form` auth |
| Ingestion chat | `ChatIngestionPanel.tsx` + `useIngestChat` | Form builder AI creation |

---

## Open Questions

### For User Decision

1. **Contacts data**: The current `contact-info` manual section is all placeholders (`[Hospital Name]`, `[Phone Number]`). Do you have real contact data to seed for Alamo Prime, or should we start with example/demo data that's clearly editable?

2. **Who to Call list**: You mentioned a "who to call list below" in your message but it wasn't included. Can you share the actual contact list (hospitals, regional managers, emergency services, vendors) so we can seed the `contacts` table?

3. **Form submissions access**: Should all authenticated users be able to fill forms, or only managers/admins? Should regular employees be able to see their own submitted forms?

4. **PDF export priority**: How important is generating a printable PDF of completed forms? Should this be in the initial build or a later phase?

5. **Signature capture**: **DECIDED** — Full finger/stylus drawing via `react-signature-canvas`. Stored as PNG in private Supabase Storage bucket with signed URLs.

6. **Employee lookup**: Should the AI be able to search employee records (names, departments, hire dates) to auto-fill employee info, or is this manually entered for now?

### Suggestions

1. **Start with viewer, not builder**: I recommend building the form viewer and AI filling first (Phases 1-4), then the builder (Phase 5). This lets you validate the concept with the 2 seed forms before investing in the full builder UI. The seed forms are created via migration SQL initially.

2. **Contacts as a first-class feature**: Instead of just a table that forms query, the `contacts` table could power a standalone "Who to Call" page — useful even outside of forms. Think of it as a structured replacement for the current placeholder manual section.

3. **Form builder recommending tools**: Great idea. We can analyze field labels + form title with simple keyword matching (no AI needed) to suggest tools. The admin gets a one-click toggle for each.

4. **Conditional fields**: The injury form has fields that only appear when certain conditions are met (e.g., "Hospital" only shows if "Transported to Hospital" = Yes). The field schema supports a `condition` property for this.

5. **Notification system (future)**: When a form is submitted, notify relevant people (e.g., HR for write-ups, regional manager for injuries). This is a natural Phase 7+ feature.

---

## File Organization

```
docs/plans/form-builder/
  00-feature-overview.md          ← this file
  01-phase-db-foundation.md
  02-phase-form-viewer.md
  03-phase-ai-form-filling.md
  04-phase-ai-chat-integration.md
  05-phase-form-builder.md
  06-phase-contacts-management.md
  07-phase-polish-advanced.md
```

---

*This document is the living overview for the Form Builder feature. Each phase will get its own detailed plan with exact files, migrations, and verification steps.*
