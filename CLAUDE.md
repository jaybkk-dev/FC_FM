# FC Facilities Management System — CLAUDE.md

## Project Overview

Google Apps Script web app for restaurant facilities management. Built for **Fat Chili Group** (Bangkok restaurant group). Pilot venue: **OSKAR BISTRO (OSKB)**.

Staff submit maintenance requests or event support requests via a mobile web form. Submissions land in a Google Sheet, get AI-translated (EN/TH) and auto-classified, then dispatched to technicians/contractors.

## Architecture

- **Platform:** Google Apps Script (GAS), container-bound to a Google Sheets spreadsheet
- **Frontend:** Single-file `WebApp.html` served by `doGet()` via `HtmlService`
- **Backend:** 9 `.gs` files sharing a flat namespace (no modules/imports)
- **AI:** OpenAI GPT-4o-mini for translation (EN↔TH) and request classification
- **Storage:** Google Sheets (data) + Shared Drive (media folders)
- **Deployment:** Apps Script Editor → Deploy → Web app (Execute as: owner, Access: Anyone)

### Critical GAS Constraint
All `.gs` files share the **same global namespace**. Duplicate function names silently overwrite each other. Never create a function with a name that already exists in another file.

## File Structure

```
CURRENT/
├── WebApp.html              ← Frontend (HTML/CSS/JS, single file)
└── NEW_SCRIPTS/             ← All backend .gs files
    ├── Config.gs            ← All constants: VENUE_CODE, IDs, API key, FORMAT spec
    ├── Menu.gs              ← Single onOpen(), operations menu only
    ├── AI.gs                ← OpenAI: callAI_(), translateText_(), classifyRequest_()
    ├── Drive.gs             ← Shared Drive: folder creation, file upload
    ├── Format.gs            ← Sheet formatting, trimEmptyRows, addManualInputRows
    ├── WebApp.gs            ← doGet(), getVenueConfig(), submitRequest(), addUser(), removeUser()
    ├── Pipeline.gs          ← Import engine, archive, REQ_ID gen, dropdowns, triggers
    ├── EditTrigger.gs       ← Installable onEdit: instant archive, auto-timestamps
    ├── Line.gs              ← LINE Messaging API: Flex Messages, doPost webhook, push notifications
    └── Setup.gs             ← One-time setup: protections, filtered views, checkboxes
```

## Key External Resources

| Resource | ID / Value |
|----------|-----------|
| Master Spreadsheet | `15g8iMPGPMJougY3CwQAozqKtXKWrEUMOxCs8-VT0v0g` |
| Reference Spreadsheet | `1FExzbsxkJKdIp4tRvN5WRwqiVcYbMKYMbprrUIu-Psc` |
| Shared Drive Root | `0ADtrX772uxBkUk9PVA` |
| Venue Code (pilot) | `OSKB` |
| Owner Email | `jsebag@gmail.com` |

All IDs live in `Config.gs`. To clone for another venue, change `VENUE_CODE` there.

## Brand Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Cinnamon Wood | `#B45D43` | Expense approval headers, alerts |
| Pacific Cyan | `#228299` | Secondary accent (future) |
| Oskar Gold | `#E6A831` | Primary brand, headers, buttons, highlights |
| Taupe Grey | `#6B5955` | Secondary text, labels |
| Olive Leaf | `#606c38` | Approval/success states |

Use only these colors for UI elements, Flex Messages, and cards. Gold should dominate.

## Spreadsheet Tabs

| Tab | Purpose | Key Columns |
|-----|---------|-------------|
| RAW_INTAKE | Web app submissions land here | A-K (INTAKE_TS → REQ_ID) |
| MANUAL_INPUT | Staff enter requests directly in the sheet | A-J (INPUT_TS → DONE) |
| REQUESTS | Active jobs (imported from above two) | A-R (REQ_ID → DONE) |
| COMPLETED | Archived jobs (DONE=TRUE) | A-T (same as REQUESTS + COMPLETED_TS, CLOSURE_NOTES) |

## Conventions

### REQ_ID Format
`VENUE_CODE` + `YYMMDD` + 3-digit monthly ordinal. Example: `OSKB260223001`

### Folder Naming
`VENUE_CODE` + `_` + `YYMMDD` + `_` + 3-digit daily ordinal. Example: `OSKB_260223_001`
Daily counter uses `PropertiesService` (not folder scanning).

### Drive Hierarchy
`SHARED_DRIVE_ROOT / VENUE_CODE / YEAR / MONTH / JOB_FOLDER`

### Function Naming
- Public/menu functions: `camelCase()` (e.g., `importFromAllSources`)
- Private helpers: `camelCase_()` with trailing underscore (e.g., `classifyRequest_()`)
- Installable trigger handlers: `onEditMaster(e)` — must match trigger registration

### JavaScript Style
- `const`/`let` only (no `var` except legacy)
- No ES modules (GAS doesn't support them)
- `function` declarations only (no arrow functions in .gs files — arrow functions are fine in WebApp.html)
- Use `Logger.log()` for server-side logging
- Wrap UI alerts in `try/catch` — they fail silently in trigger context

## Important Patterns

### AI Functions Accept Caches
`classifyRequest_()` and `formatNewRow()` accept optional cache parameters to avoid repeated reads during batch operations. Always pass caches when calling in a loop:
```javascript
const catData = catSheet.getRange(...).getValues();  // load once
for (...) {
  classifyRequest_(title, details, links, catData);  // pass cache
}
```

### Cross-Wired Media Buttons (WebApp.html)
On mobile, `capture="environment"` paradoxically opens the file picker (not camera). The labels are intentionally cross-wired:
- "Take Photo/Video" label → `for="fileInput"` (input WITHOUT capture) → opens camera
- "Upload File" label → `for="cameraInput"` (input WITH capture) → opens file picker

This is tested and confirmed. **Do NOT "fix" this — it is correct.**

### HYPERLINK Formula Preservation
During import, media link columns may contain `=HYPERLINK(...)` formulas. Use `getFormulas()` alongside `getValues()` and re-apply with `setFormula()` after `appendRow()`.

### Edit Trigger (Installable)
`onEditMaster(e)` is an installable trigger (not simple `onEdit`). It must be registered once via `installEditTrigger()` from the Script Editor. It handles:
- REQUESTS: instant archive on DONE checkbox, ASSIGNED_TO dropdown, LAST_UPDATED_TS
- MANUAL_INPUT: auto-timestamp, AREA dropdown, auto-create destination folder

## What NOT To Do

- **Never duplicate function names** across .gs files (GAS shared namespace)
- **Never put setup functions in the menu** — they run from Script Editor only
- **Never hardcode 'OSKB'** — use `VENUE_CODE` from Config.gs
- **Never use `var`** in new code
- **Never call OpenAI in a tight loop without caching** — pre-load reference data
- **Never use `appendRow` in a batch loop** without good reason — it's slow but acceptable for small batches (<50 rows)
- **Never skip the `try/catch` around `SpreadsheetApp.getUi()`** — it throws in trigger context

## Testing Workflow

1. Edit files locally in VS Code
2. `clasp push` runs automatically after every file edit (via PostToolUse hook)
3. For WebApp.html changes: user must also redeploy (Deploy → Manage deployments → Edit → New version → Deploy)
4. For .gs changes: Just push — no redeployment needed for server-side code
5. Test on the deployed web app URL (refresh browser)

### Testing Rules — CRITICAL

**Never use TEST_MODE or toggles that intercept real submissions.** The app is live. Real staff use it in real time. Routing their submissions to a test group means their requests silently disappear — they think the app is broken.

**All testing must be done via dedicated test functions** stored in a test file (e.g., `Test.gs` or within `Setup.gs`). These functions:
- Run manually from Script Editor (never triggered by real submissions)
- Use `LINE_TEST_GROUP_ID` explicitly (hardcoded, not toggled)
- Write to clearly marked test rows (title prefixed `[TEST]`) that are cleaned up after
- Never touch production LINE groups, never intercept real user submissions
- Cover the full submission lifecycle: folder creation, sheet write, AI translation, LINE Flex, expense approval, file upload

**Required test functions (to be built and maintained in the codebase):**

| Function | What it tests |
|----------|--------------|
| `testSubmitMaintenance()` | Full maintenance submission: row in RAW_INTAKE, folder on Drive, LINE Flex to test group |
| `testSubmitExpenseApproval()` | Expense submission: row in RAW_INTAKE + EXPENSE_APPROVAL, expense folder, expense Flex to test group |
| `testApprovalFlow()` | Marks a test expense as approved, sends confirmation Flex to test group |
| `testLineFlex()` | Sends a sample Flex card to test group (already exists) |
| `testLineFlexWithImages()` | Sends Flex with real images to test group (already exists) |
| `testAITranslation()` | Translates sample text EN→TH and TH→EN, logs results |
| `testDriveAccess()` | Creates and deletes a test folder on Shared Drive |
| `testUserManagement()` | Adds and removes a test user from Reference sheet |
| `runSystemCheck()` | Full 10-point system health check (already exists) |

**After every feature is built, the corresponding test function must be created or updated before asking the user to test.** The user should never be the first person to trigger a new feature in a production context.

**Clasp sync warning:** Editing files in the Script Editor while using clasp causes sync conflicts. Always edit locally. If a file was edited in the Script Editor, run `clasp pull` first to sync, then make changes locally and push.

## Hooks (automatic actions — configured in .claude/settings.json)

- **Auto-push:** Every time a `.gs` or `.html` file is written/edited, `clasp push` runs automatically. No manual step needed.
- **Auto-update status:** When a conversation ends, Claude is prompted to update the "Current Status" section of this CLAUDE.md file with what was done and what's still pending. This is how session memory is preserved.

## Dependencies

- **Advanced Sheets API** must be enabled in Script Editor (Services → + → Google Sheets API) — used for filtered views
- **OpenAI API** key in Config.gs — used for translation and classification
- **Shared Drive** access — script owner must have write access to the shared drive

## Current Status (updated 8 Apr 2026)

### LINE Integration (fully working)
- **LINE Official Account:** "FC MAINTENANCE" (one account for all venues)
- **Channel Access Token:** stored in `Config.js`
- **Three LINE groups configured:**
  - `LINE_GROUP_ID` — OSKAR MAINTENANCE (13 members, production)
  - `LINE_TEST_GROUP_ID` — LINE FLEX TESTS (Jay only, for testing)
  - `LINE_EXPENSE_GROUP_ID` — OSKAR MAINTENANCE EXPENSES (private, expense approvals)
- **Maintenance Flex:** auto-pushed on every submission — venue header, area, title, Thai translation, images (clickable), video/audio/PDF indicators, requester, timestamp, REQ_ID, "Photos / Videos" button
- **Expense Flex:** sent to expense group only — gold header, English only, amount in Cinnamon Wood, expense details, APPROVE button (Olive Leaf), FILES button pointing to expense media folder
- **Approval flow:** APPROVE button → two-step confirmation page (enter name → confirm) → marks APPROVED in sheet → sends "APPROVED by [NAME]" Flex to expense group
- **Image thumbnails in Flex:** `sendLineAfterUpload()` reads Drive folder after uploads complete, includes up to 4 clickable images in the Flex card
- **Non-image media:** video/audio/PDF indicators shown as text labels when non-image files are attached
- **Test functions** (`testLineFlex`, `testLineFlexWithImages`): always route to test group, never production

### Expense Approval Feature
- **ADMIN users** (JANE for OSKB) see "EXPENSE APPROVAL" section on Page 2A
- Fields: expense details (free text), total amount (฿), quotation/PDF upload
- Data written to RAW_INTAKE cols L-N + EXPENSE_APPROVAL sheet (A-L)
- Expense media folder created in dedicated `EXPENSE_APPROVAL` Drive folder
- Folder naming: `OSKB_260401_EXP1` (flat, no year/month subfolders)
- Expense files upload to expense folder (separate from job folder)
- `doGet()` handles approval links: `?approve=REQID&token=HASH&approver=NAME`

### User Management
- ADMIN + SENIOR users see "MANAGE STAFF" button on Page 1
- Single alphabetically sorted list, seniors/admins marked with ⭐, regulars removable with ✕
- Add new users (always REGULAR, forced uppercase)
- `getVenueConfig()` returns `staffNames`, `seniorUsers`, `adminUsers` — all sorted A-Z

### Other Recent Changes
- **Attachments now mandatory** — form requires title + at least one file
- **Media buttons fixed** — tested on real device, "Take Photo/Video" opens camera, "Upload File" opens file picker
- **Two buttons only** — "Photo / Video / File" + "Voice Note" (removed three-button layout)
- **Confirmation page simplified** — request summary + "Shared to LINE group" message, no card
- **Desktop banner** — "This app works best on phones" (dismissable)
- **Brand color palette** — Cinnamon Wood, Pacific Cyan, Oskar Gold, Taupe Grey, Olive Leaf (saved in CLAUDE.md)
- **Border style** — DOTTED (not DASHED) for all horizontal row borders
- **EXPENSE_APPROVAL sheet** — added to `formatAllSheets()` and `setupMasterProtections()`
- **`translateToEnglish_()`** — new function in AI.js for expense Flex (English only)
- **Demo page** — `https://jaybkk-dev.github.io/FC_FM/WebApp_Demo.html`

### Setup already completed
- All `.gs` files deployed (AI, Config, Drive, EditTrigger, Format, Line, Menu, Pipeline, Setup, Webapp)
- `WebApp.html` served via deployed web app
- `runFullSetup()` and `installEditTrigger()` have been run
- Clasp auto-push hook active
- Git initialized, GitHub remote (`jaybkk-dev/FC_FM`), commits at milestones
- Spreadsheet timezone: Asia/Bangkok ✅
- LINE webhook: verified via webhook.site, all Group IDs captured
- MCP server available for reading spreadsheet data (`LA PATIS - MCP/server.py`)

### Workflow note
When using Python/Bash to modify files directly, the PostToolUse hook does NOT auto-push. Run `clasp push --force` manually after such operations.

### Pending / Not Yet Done
1. **Expense approval section UI** — white card background not rendering correctly, needs styling fix
2. **Voice-to-text** — approach TBD (client-side Speech API vs server-side Whisper)
3. **Dedicated test functions** — most test functions in the CLAUDE.md table not yet built (only `testLineFlex`, `testLineFlexWithImages`, `runSystemCheck` exist)
4. **Cleanup test data** — delete test rows from RAW_INTAKE/REQUESTS/EXPENSE_APPROVAL, reset counters
5. **Asset Registry** — Phase 2 (see Roadmap)
6. **Manager dispatch app** — separate frontend for Jay + assistant to assign/track/close jobs from phone
7. **Clone to other venues** — change `VENUE_CODE` in Config.gs and repeat setup

### Known working features
- Web form submission (maintenance + event support)
- Job folder creation on Shared Drive with PropertiesService counter
- REQ_ID generation (VENUE + YYMMDD + monthly ordinal)
- Base64 file upload (photos, videos, voice notes, PDFs) — mandatory
- HYPERLINK formula preservation during import
- AI translation (EN↔TH, TH→EN) and request classification
- Instant archive (DONE checkbox → COMPLETED)
- Edit trigger: auto-timestamps, ASSIGNED_TO dropdown, AREA dropdown
- Custom menu (Import, Archive, Quick Add Contractor, Refresh Dropdowns, Auto Import, Create Folder)
- Warning-only protections with dispatch columns unprotected
- Filtered views on Master + Reference spreadsheets
- **LINE Flex Messages** — maintenance group (Thai, images, media indicators) + expense group (English, approval flow)
- **Expense approval** — ADMIN form section, EXPENSE_APPROVAL sheet, dedicated Drive folder, two-step approval via LINE
- **User management** — ADMIN/SENIOR can add/remove staff from the app
- **Simplified confirmation page** — request summary + LINE notification
- Desktop banner ("works best on phones")

### Known issues
- **Expense section UI** — styling doesn't match mockup (white card not rendering properly on gold background)
- **Clasp push reliability** — clasp sometimes says "up to date" when it hasn't pushed. Workaround: append a comment to force a diff, then push.

## Development Roadmap

### Phase 1 — OSKB Pilot (Current)
**Goal:** Prove the system works end-to-end at one venue before expanding.

**What staff can do:**
- Submit maintenance requests from any phone, no app install needed
- Attach photos, videos, voice notes, or PDFs
- Receive a shareable confirmation card with a unique job ID (REQ_ID)
- Submit event support requests with date/time/type

**What the operations team gets:**
- All requests land in a central Google Sheet (REQUESTS tab) within 5 minutes of submission
- Each request is auto-translated (EN↔TH), auto-classified by trade category, and assigned a priority level
- A job folder is automatically created on the Shared Drive for each request
- Dispatch columns (ASSIGNED_TO, APPOINTMENT, NOTES) are editable without protection
- Completed jobs are archived to COMPLETED tab with one checkbox click
- Full audit trail: submission timestamp, who submitted, what area, what was reported

**Pending before go-live:**
- Redeploy to production URL (new version — includes LINE, QR code, admin panel)
- Clean up test data + reset counters
- Mobile test by Jay (submit request, verify LINE Flex Message, test admin panel)

---

### Phase 2 — Asset Registry + Notifications (Next 4-8 weeks)
**Goal:** Tie every maintenance request to a physical asset and add proactive notifications.

#### Asset Registry (`FC_FM_ASSETS` per venue)
This is a **core long-term feature**, not a nice-to-have. Each venue gets its own Asset Registry spreadsheet (e.g., `OSKB_FM_ASSETS`). Key design:

- Every physical asset (AC unit, fryer, dishwasher, hood fan, grease trap, etc.) has a unique **ASSET_ID** (e.g., `OSKB-AC-001`)
- Each asset gets a **printed QR code** — staff scan the code on the broken equipment, which opens the web form with the ASSET_ID pre-filled (currently in v1: staff type the ID manually; QR scan is the Phase 2 target)
- When a request is submitted with an ASSET_ID, it logs to **two places**: the Master Request Sheet (REQUESTS tab) AND the asset's record in the Asset Registry
- After a job is completed, the venue admin updates the asset record: spare part cost, part warranty, contractor used, resolution notes
- Over time this builds a **real maintenance database per asset**: full history, cumulative cost, failure frequency, warranty tracking
- Enables financial reporting: cost per asset, cost per venue, depreciation visibility, capex planning
- Sample file: `OSKB_FM_ASSETS.xlsx` — see `C:\Users\Jay\Documents\FC_FM\OSKB_FM_ASSETS.xlsx`

#### Notifications
- **LINE Messaging API** — auto-push to maintenance team LINE group on submission (REQ_ID, title, area, asset ID, requester, folder link)
- **Auto-save confirmation card** — card image automatically saved to the job folder

---

### Phase 3 — Multi-Venue Expansion (Next 3-6 months)
**Goal:** Roll out to all Fat Chili Group venues with the same system.

- Clone for each venue by changing `VENUE_CODE` in Config.gs and running `runFullSetup()` — one command does everything
- Each venue gets: its own Master Spreadsheet, its own Asset Registry (`VENUE_FM_ASSETS`), its own Shared Drive folder hierarchy
- All venues share one Reference spreadsheet (VENUES, USERS, TASK_CATEGORIES, TECHNICIANS, CONTRACTORS)
- **Per-venue read-only IMPORTRANGE views** (flagged by Jay as important, not just nice-to-have) — each venue manager gets a read-only file with:
  - Tab 1: Open jobs (filtered from REQUESTS via IMPORTRANGE)
  - Tab 2: Completed jobs (filtered from COMPLETED via IMPORTRANGE)
- **Weekly calendar view** — technician/contractor assignment schedule (desired)
- **Training materials in Thai** — for venue staff, covering how to use the app

---

### Phase 4 — Group Admin View (Future)
**Goal:** Jay and senior staff get a cross-venue operations dashboard.

- Admin page in the web app with a venue picker at the top (Jay + assistant only)
- View open jobs across all venues in one place
- Group-level reporting: requests by venue, by category, by priority, by month
- SLA tracking: time from submission to assignment, time to completion
- Asset cost reporting: maintenance spend per asset, per venue, group total

---

## Owner / Contact

**Jay Sebag** — Director, Fat Chili Group
- Email: jsebag@gmail.com
- Project started: Feb 2025
- Current phase: OSKB pilot deployment
