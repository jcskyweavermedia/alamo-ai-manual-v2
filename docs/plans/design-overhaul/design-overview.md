complete UI system specification, audited against all three screenshots.

This will cover:

Background + elevation system

Food recommendation cards (square image + metadata row)

Table/list recipe view

Navbar

Two-line title styling (regular + bold split)

Large feature cards (emoji centered)

Small stat cards with emoji tiles

Tile + emoji treatment system

This is now a proper component-level design system.

1️⃣ GLOBAL SURFACE SYSTEM
Page Background

The app background is NOT white.

It is a very soft neutral grey:

--bg-page: #F3F4F6; /* Tailwind gray-100 */

This is important:

Cards sit on grey.

White cards feel elevated because of contrast.

Shadows are subtle because contrast already provides separation.

2️⃣ CARD FOUNDATION SYSTEM

All cards share this base:

background: #FFFFFF;
border-radius: 16px;
border: 1px solid #E5E7EB; /* gray-200 */
box-shadow: 0 1px 2px rgba(0,0,0,0.04);

Key observation:

The shadow is extremely soft.
It’s almost flat UI.
Elevation comes more from white-on-grey than from shadow.

Hover state (very subtle):

box-shadow: 0 4px 12px rgba(0,0,0,0.06);
3️⃣ FOOD RECOMMENDATION CARDS (Square Tile + Metadata Row)

This is the most important one.

Layout Structure

Vertical stack:

[ Square Image Tile ]
[ Title ]
[ Subtitle ]
[ Metadata Row: 3 icon groups ]
Square Image Tile

Size: 80px × 80px

Border radius: 16px

Overflow: hidden

Shadow:

box-shadow: 0 6px 16px rgba(0,0,0,0.08);

Important detail:
The image tile has slightly stronger shadow than the card itself.

This creates a layered depth effect:
Grey background → white card → elevated image tile.

Card Spacing

Padding: 20–24px

Vertical gap between elements: 8px–12px

Title
font-weight: 600;
font-size: 16px;
color: #111827;
Subtitle (Cuisine Type)
font-weight: 400;
font-size: 14px;
color: #6B7280;
Metadata Row (3 Small Icon Groups)

Horizontal layout:

[ ⏱ 20 min ]  [ 📊 Beginner ]  [ 🔥 240 cal ]

Spacing between groups: 16px–20px

Icon size:

14px–16px

Colored (red clock, blue level bars, orange flame)

Text:

font-size: 13px;
font-weight: 500;
color: #6B7280;

Icons are slightly more saturated than text.

This gives visual rhythm.

4️⃣ TABLE / LIST RECIPE VIEW

This is under “Popular recipe”.

Structure

Horizontal row layout:

[ 40px Square Image ]
[ Recipe Name ]
[ Level ]
[ Portion ]
[ Duration ]
[ Action Icon ]
Row Style

Background: white

Border bottom: 1px solid #E5E7EB

Row height: 64px–72px

Vertical padding: 12px–16px

Hover:
Very subtle grey tint:

background: #F9FAFB;
Square Thumbnail in Table

Size: 40px–44px

Border radius: 8px–10px

No heavy shadow

Just clipped image

Column Text

Recipe name:

font-weight: 500;
font-size: 14px;
color: #111827;

Other columns:

font-weight: 400;
font-size: 14px;
color: #6B7280;
Action Button (Circle with Arrow)

32px circle

Background: #F97316 (orange)

White arrow icon

Shadow: 0 4px 10px rgba(249,115,22,0.3)

This is the only high-saturation floating element.

5️⃣ NAVBAR SPEC

Height: 72px

Background: white
Border bottom: 1px solid #E5E7EB

Layout:

[ Logo + Name ]
[ Search bar ]
[ Settings Icon ]
[ Bell Icon ]
[ Avatar + Dropdown ]
Logo

Small emoji-style icon + wordmark

Typography:

Font weight: 600

Size: 18px

Subtext under logo (in some screens):

12px

Gray-500

Search Bar

Height: 40px

Background: #F3F4F6

Border radius: 20px

No visible border

Icon inside left

Placeholder: gray-400

Icons (Settings, Bell)

20px–22px

Stroke: 1.5–2px

Color: #6B7280

Avatar

36px circle

Subtle shadow

Dropdown caret

6️⃣ TWO-LINE TITLE SYSTEM (Regular + Bold Split)

Example:

Recipe from your
kitchen ingredients

Implementation:

Line 1:

font-weight: 400;
font-size: 40px;
color: #6B7280;

Line 2:

font-weight: 700;
font-size: 40px;
color: #111827;

Key design pattern:
They visually emphasize second line through weight contrast, not color change.

Emoji placed inline at end.

Spacing between lines: 4px–6px.

This creates hierarchy without increasing size.

7️⃣ LARGE FEATURE CARDS (Second Image)

These are the 3 centered cards.

Structure:

[ Emoji inside soft circular background ]
[ Title ]
[ Paragraph ]
[ Learn More link ]
Card Surface

Background: white

Border: 1px solid #E5E7EB

Radius: 20px

Padding: 40px

No strong shadow

Emoji Badge

Circle:

64px–72px diameter

Background: #F3F4F6

Emoji centered

No border

No shadow

Title
font-size: 20px;
font-weight: 600;
color: #111827;
Paragraph
font-size: 15px;
line-height: 1.6;
color: #6B7280;
Learn More Link

Green text:

color: #22C55E;
font-weight: 500;

Arrow inline.

8️⃣ SMALL STAT CARDS (Third Image)

These are the small rounded metric tiles.

Structure:

[ Large number ]
[ Label ]
[ Emoji icon on right ]
Card

Background: white

Border: 1px solid #E5E7EB

Radius: 14px

Padding: 16px 20px

No heavy shadow

Size:
~200px wide

Number
font-size: 24px;
font-weight: 700;
color: #111827;
Label
font-size: 14px;
color: #6B7280;
Emoji

Placed right side:

28px–32px

No background

Slight vertical centering

9️⃣ TILE + EMOJI SYSTEM

There are 3 tile types:

Image tile (food square)

Emoji circle tile (feature cards)

Emoji inline tile (stats)

Rules:

Emoji always slightly oversized for friendliness

Rounded containers

Never sharp corners

No heavy gradients

Soft neutral background behind emoji

This keeps visual warmth.

🔟 DEPTH HIERARCHY

Layer stack:

Page grey background

White card

Elevated image tile

Floating action button (orange)

Depth increases subtly.

Nothing extreme.

🎯 COMPLETE SYSTEM SUMMARY

Visual Language:

Soft grey background

White cards

16px–20px radius everywhere

Minimal shadow

Subtle border

Tailwind-like color palette

Weight contrast hierarchy

Emoji for warmth

Square food image tile with stronger shadow

Metadata row with 3 micro icon groups

Clean horizontal table rows

Balanced navbar with rounded search