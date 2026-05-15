# Fat Chili — Web App Design System

Authoritative brand reference for all Fat Chili Group web applications. Light theme only. Do not deviate without Group approval. Venue-specific palettes (Lily Fu's, OSKAR, Gigi, The Parlour, Felix) are **not** permitted in FC Group apps.

---

## 1. Color Palette

Only three brand hexes are authorized. All neutrals are derived from FC Black.

### Brand colors

| Token    | Hex       | Usage                                                          |
| -------- | --------- | -------------------------------------------------------------- |
| FC Red   | `#D81F26` | Primary action, brand accent, active state, error, focus ring  |
| FC Black | `#231F20` | Text, icons, borders, destructive action, dark surfaces        |
| FC Cream | `#EEE7DC` | Default page background                                        |

### Derived neutrals

| Token       | Value                       | Usage                                          |
| ----------- | --------------------------- | ---------------------------------------------- |
| Ink 100     | `#231F20`                   | Primary text, headings                         |
| Ink 70      | `rgba(35, 31, 32, 0.70)`    | Secondary text, labels, subtle icons           |
| Ink 40      | `rgba(35, 31, 32, 0.40)`    | Placeholder text, disabled text                |
| Line        | `rgba(35, 31, 32, 0.15)`    | Borders, dividers, input outlines              |
| Line soft   | `rgba(35, 31, 32, 0.08)`    | Row separators, subtle backgrounds             |
| Surface     | `#FFFFFF`                   | Cards, modals, inputs on cream page background |

### State colors

| State   | Value     | Notes                           |
| ------- | --------- | ------------------------------- |
| Success | `#2E7D32` | Confirmation only               |
| Warning | `#C77700` | Caution / non-blocking issues   |
| Error   | `#D81F26` | Uses FC Red                     |
| Info    | `#231F20` | Uses FC Black                   |

### Rules

- FC Red is an accent, not a background. Keep red coverage under ~10% of any screen.
- FC Cream is the canvas. White is for elevation (cards, modals, inputs).
- FC Black is for ink, not panels. Avoid large solid black blocks.
- Do not introduce additional brand colors.

---

## 2. Typography

All fonts via Google Fonts.

### Families

| Role       | Family        | Weights         | Purpose                                          |
| ---------- | ------------- | --------------- | ------------------------------------------------ |
| Display    | `Jost`        | 200, 300, 400   | Wordmark echo, splash, large brand moments       |
| Heading    | `Roboto Slab` | 500, 700        | Page titles, section headers                     |
| UI / Body  | `Inter`       | 400, 500, 600   | All UI chrome, body copy, forms, tables          |
| Editorial  | `Lora`        | 400 italic      | Taglines, empty-state copy, quotes (sparing use) |

### Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Jost:wght@200;300;400&family=Roboto+Slab:wght@500;700&family=Lora:ital@1&display=swap" rel="stylesheet">
```

### Hierarchy

| Level    | Family      | Size | Weight | Line height | Tracking          | Use                         |
| -------- | ----------- | ---- | ------ | ----------- | ----------------- | --------------------------- |
| Display  | Jost        | 48px | 300    | 1.1         | +0.15em           | Logo lockups, splash        |
| H1       | Roboto Slab | 32px | 700    | 1.2         | 0                 | Page title                  |
| H2       | Roboto Slab | 24px | 700    | 1.25        | 0                 | Section header              |
| H3       | Inter       | 18px | 600    | 1.3         | 0                 | Subsection                  |
| Body     | Inter       | 15px | 400    | 1.5         | 0                 | Default paragraph           |
| Small    | Inter       | 13px | 400    | 1.45        | 0                 | Help text, captions         |
| Label    | Inter       | 12px | 600    | 1.2         | +0.08em UPPERCASE | Form labels, table headers  |
| Tagline  | Lora italic | 20px | 400    | 1.3         | 0                 | Editorial moments only      |

### Rules

- Headings always in FC Black. Never in FC Red.
- FC Red for text is reserved for links, active states, and short accent words.
- Uppercase is only used with tracking ≥ 0.08em.
- Pair Roboto Slab (headings) with Inter (body). Do not mix Roboto Slab and Jost in the same block.

---

## 3. Logos & Stamp

Three authorized marks. Use the correct one for context.

### 3.1 Primary logo (stacked)

Chili illustration + `FATCHILI` wordmark + `RESTAURANTS & BARS` sublabel.
Source: `Logo_Fat_Chili_final.pdf`

- **Use for**: login / splash, document headers, public pages.
- **Minimum width**: 160px.
- **Clear space**: at least the height of the word `FATCHILI` on all sides.
- **Backgrounds**: FC Cream or white only.

### 3.2 Chili only (icon)

Chili illustration without wordmark.
Source: `CHILI_ONLY-01.png`

- **Use for**: favicons, app icons, loading states, tight navigation, empty states.
- **Minimum width**: 24px.
- Do not add typography beneath it — that is reserved for the primary logo.

### 3.3 FC Stamp

Red rectangle with hand-drawn `FC`, intentionally rotated.
Source: `stamp_FC-01.png`

- **Use for**: approval / confirmation states ("Submitted", "Approved", "Paid", "Done"), success badges, completion markers. It is a visual rubber stamp — use it as one.
- Do not use as a primary brand mark or logo replacement.
- Do not straighten the rotation.
- **Size**: 32–64px square.

### Logo don'ts (all three)

- Do not recolor the chili. Red body + brown stem only.
- Do not stretch, skew, or apply drop shadows / glows.
- Do not place on photographic or busy backgrounds.
- Do not re-typeset `FATCHILI` — always use supplied artwork.

---

## 4. Components

Editorial-print feel: squared corners, thin borders, minimal ornament. No pill shapes, no heavy shadows, no gradients.

### 4.1 Buttons

| Variant      | Background                  | Text       | Border              | Use                            |
| ------------ | --------------------------- | ---------- | ------------------- | ------------------------------ |
| Primary      | `#D81F26`                   | `#EEE7DC`  | none                | Main CTA (one per screen)      |
| Secondary    | transparent                 | `#231F20`  | 1px `#231F20`       | Supporting actions             |
| Tertiary     | transparent                 | `#231F20`  | none                | Inline / low emphasis          |
| Destructive  | `#231F20`                   | `#EEE7DC`  | none                | Delete / irreversible          |
| Disabled     | `rgba(35,31,32,0.08)`       | Ink 40     | none                | Not available                  |

- Height: 40px default, 32px compact, 48px prominent.
- Horizontal padding: 16px.
- Font: Inter 500, 14px, sentence case (no uppercase).
- Corner radius: 2px.
- Hover: darken background 8%, no transform.
- Focus: 2px FC Red outline, 2px offset.

### 4.2 Text inputs

| Property         | Value                                               |
| ---------------- | --------------------------------------------------- |
| Background       | `#FFFFFF`                                           |
| Border           | 1px Line (`rgba(35,31,32,0.15)`)                    |
| Border radius    | 2px                                                 |
| Padding          | 10px 12px                                           |
| Height           | 40px                                                |
| Font             | Inter 400, 15px                                     |
| Text color       | `#231F20`                                           |
| Placeholder      | Ink 40                                              |
| Focus border     | 1.5px FC Red                                        |
| Error border     | 1.5px FC Red + helper text in FC Red below          |
| Disabled         | bg `rgba(35,31,32,0.04)`, text Ink 40               |

- Labels: above input. Inter 600, 12px, uppercase, +0.08em tracking, Ink 70. Always visible — no float-label pattern.
- Helper text: below input. Inter 400, 13px, Ink 70.

### 4.3 Select / dropdown / date & time pickers

- Match text-input visuals (same background, border, radius, height).
- Chevron icon: 16px, Ink 70, 12px right padding.
- Opened menu: white, 1px Line border, 2px radius, 8px 12px item padding. Hover row `rgba(35,31,32,0.04)`. Selected row text in FC Red.
- Date picker:
  - Today marker: FC Red 1px underline on the day number.
  - Selected date: FC Red fill, cream text.
  - Range fill: `rgba(216,31,38,0.12)`.
  - Disabled dates: Ink 40.
- Time picker: same input visual; dropdown or scroll wheel uses FC Red for selected value.

### 4.4 Checkboxes / radios

- 18px square (checkbox) / circle (radio).
- Unchecked: 1.5px border Ink 40, transparent fill.
- Checked: FC Red fill, cream checkmark/dot.
- Focus: 2px FC Red outline, 2px offset.

### 4.5 Cards / panels

- Background: `#FFFFFF` on cream page.
- Border radius: 4px.
- Choose one per app (do not mix):
  - 1px border `rgba(35,31,32,0.10)`, no shadow; **or**
  - No border, shadow `0 1px 3px rgba(35,31,32,0.08)`.
- Padding: 20px compact, 24px default.

### 4.6 Tables

- Header: Inter 600, 12px, uppercase, +0.08em tracking, Ink 70. Bottom border 1px Line.
- Row: 48px height, Inter 400, 14px, FC Black text.
- Row separator: 1px Line soft.
- Hover: row background `rgba(35,31,32,0.03)`.
- No zebra striping.

### 4.7 Modals

- Background: white.
- Overlay: `rgba(35,31,32,0.50)`.
- Border radius: 4px.
- Max width: 560px default.
- Close icon: top-right, 24px, Ink 70.

### 4.8 Toasts / notifications

- Background: FC Black.
- Text: FC Cream.
- Border radius: 4px.
- 4px left accent border by type: Success `#2E7D32`, Warning `#C77700`, Error `#D81F26`, Info none.

### 4.9 Navigation

- Top bar or sidebar background: FC Cream or white.
- Active item: FC Black text + 2px FC Red bottom border (top nav) or 3px FC Red left border (sidebar).
- Inactive item: Ink 70.
- Font: Inter 500, 14px.

---

## 5. Spacing & Layout

4px base unit. Use only: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96.

- Page padding: 24px mobile, 48px desktop.
- Max content width: 1280px.
- Section spacing: 48px between major sections.

---

## 6. Iconography

- Library: **Lucide** (thin, line-based, matches editorial feel).
- Stroke: 1.5px.
- Color: inherits current text color.
- Sizes: 16px inline, 20px inside buttons, 24px standalone.
- Do not use filled icon styles.

---

## 7. CSS Variables

Copy into the app's base stylesheet.

```css
:root {
  /* Brand */
  --fc-red: #D81F26;
  --fc-black: #231F20;
  --fc-cream: #EEE7DC;
  --fc-white: #FFFFFF;

  /* Ink / lines */
  --ink-100: #231F20;
  --ink-70: rgba(35, 31, 32, 0.70);
  --ink-40: rgba(35, 31, 32, 0.40);
  --line: rgba(35, 31, 32, 0.15);
  --line-soft: rgba(35, 31, 32, 0.08);

  /* States */
  --success: #2E7D32;
  --warning: #C77700;
  --error: #D81F26;

  /* Fonts */
  --font-display: 'Jost', sans-serif;
  --font-heading: 'Roboto Slab', serif;
  --font-ui: 'Inter', sans-serif;
  --font-editorial: 'Lora', serif;

  /* Radius */
  --radius-sm: 2px;
  --radius-md: 4px;

  /* Spacing (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
}
```
