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
├── WebApp.html              ← Frontend — staff submission form (HTML/CSS/JS, single file)
├── FM_Dispatch.html         ← Frontend — mobile manager app (UI mock, ~1300 lines; not yet wired into doGet)
└── NEW_SCRIPTS/             ← All backend .gs files
    ├── Config.gs            ← All constants: VENUE_CODE, IDs, API key, FORMAT spec
    ├── Menu.gs              ← Single onOpen(), operations menu only
    ├── AI.gs                ← OpenAI: callAI_(), translateText_(), classifyRequest_()
    ├── Drive.gs             ← Shared Drive: folder creation, file upload (server-side LINE trigger)
    ├── Format.gs            ← Sheet formatting, trimEmptyRows, addManualInputRows
    ├── WebApp.gs            ← doGet(), getVenueConfig(), submitRequest(), addUser(), removeUser(), sendLineAfterUpload (with dedup)
    ├── Pipeline.gs          ← Import engine, archive, REQ_ID gen, dropdowns, triggers
    ├── EditTrigger.gs       ← Installable onEdit: instant archive, auto-timestamps
    ├── Line.gs              ← LINE Messaging API: Flex Messages, doPost webhook, push notifications, LINE_LOG sink, lineHealthCheck, diagnoseLastSubmission
    └── Setup.gs             ← One-time setup: protections, filtered views, checkboxes
```

## Key External Resources

| Resource | ID / Value |
|----------|-----------|
| Master Spreadsheet | `15g8iMPGPMJougY3CwQAozqKtXKWrEUMOxCs8-VT0v0g` (current name `OSKB_FM_MASTER_REQUESTS`; rename to `FC_FM_MASTER_REQUESTS` pending) |
| Reference Spreadsheet | `1FExzbsxkJKdIp4tRvN5WRwqiVcYbMKYMbprrUIu-Psc` (`FC_FM_REFERENCE`) |
| Shared Drive Root | `0ADtrX772uxBkUk9PVA` |
| Venue Code (pilot) | `OSKB` |
| Owner Email | `jsebag@gmail.com` |
| Public source repo | https://github.com/jaybkk-dev/FC_FM (blocked from new pushes — OpenAI key in history) |
| FM Dispatch preview repo | https://github.com/jaybkk-dev/fm-dispatch-preview |
| FM Dispatch phone URL | https://jaybkk-dev.github.io/fm-dispatch-preview/FM_Dispatch.html |
| MCP server (Sheets+Drive) | `C:\Users\Jay\Documents\LA PATIS - MCP\server.py` (registered in `.mcp.json`) |

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

- **PostToolUse — auto-push:** Every time a `.gs` or `.html` file is written/edited, `clasp push --force` runs automatically. No manual step needed for code changes. Note: only fires for Edit/Write tool calls; direct Python/Bash file writes do NOT trigger it — run `clasp push --force` manually after such operations.
- **SessionStart — clasp auth check:** Runs `clasp deployments` silently at the start of each Claude Code session. If clasp can't reach Apps Script (expired OAuth / `invalid_grant` / `invalid_rapt`), injects a "Run `clasp.cmd login`" warning into context. Closes a feedback loop where the auto-push had been failing silently for hours due to expired tokens. (Does NOT catch mid-session expirations.)
- **Stop hook — removed.** Previously prompted Claude to update CLAUDE.md's Current Status at conversation end. Was re-arguing the same point relentlessly. Status is now updated on explicit request.

## Git Workflow

### Repo

- **Local path:** `c:\Users\Jay\Documents\FC_FM`
- **Remote:** `jaybkk-dev/FC_FM` on GitHub (public)
- **Default branch:** `master` (PRs target `main` — see git instructions in environment)
- **History scrubbed 16 May 2026 (two passes).** First pass removed the rotated-out OpenAI key from `885f70a` / `eaf575b` and moved the live key to Script Properties. Second pass (same day, after a GitGuardian alert) removed the LINE channel access token + all three group IDs and moved them to Script Properties too. All commits were force-pushed under new SHAs. Going forward, every secret reaches Apps Script through a `get*Prop_()` helper that reads from `PropertiesService.getScriptProperties()`. Source is safe to push.

### What IS tracked

- All `.js` / `.gs` source files at the repo root
- `WebApp.html` and `FM_Dispatch.html`
- `CLAUDE.md`, `DESIGN.md`, `SESSION_SUMMARY.txt`, `Asset Registry - design notes.txt`
- `DESIGN/` brand assets (logos, hex art, brochure PDFs — these are reference materials, not screenshots)
- `.claude/settings.json` (shared hook + permission config)
- `.mcp.json` (MCP server registration)
- `.gitignore`

### What is NOT tracked (see `.gitignore`)

- `.claude/settings.local.json` — per-machine permission overrides
- Root-level `*.png`, `*.jpg`, `*.jpeg` — ad-hoc screenshots and reference images. `DESIGN/` images are exempt (only root-level images are ignored).
- `VISUAL HELP/` — screenshot folder
- `OSKB_FM_ASSETS.xlsx` and `*_md_table.txt` — sample data and data exports, not source of truth
- Personal notes: `FM_Dispatch.txt`, `FUTURE DEVELOPMENTS FROM OLDER HANDOFFS.txt`, `Handling App.md`, `New APPROVAL REQUEST feature.txt`
- `desktop.ini`, `.DS_Store`, `Thumbs.db`

### Commit conventions

- **Commit only when explicitly asked.** Claude does not auto-commit. The auto-push hook pushes to Apps Script (clasp), not to git. Git commits are intentional checkpoints.
- **One commit per logical change.** If a session touches multiple unrelated areas (e.g. LINE work + a UI fix + tooling), split into separate commits so `git log` reads cleanly. For interleaved-file changes, temporarily revert the unrelated hunks, commit, then re-apply — never bundle "all current changes" into one commit when they belong to distinct themes.
- **Message style** — short title (≤70 chars), then a body that explains the WHY (not the what — diff already shows that). Body lines wrap at ~78 chars. End every commit message with the Co-Authored-By trailer.
- **Use HEREDOC for multi-line messages** to preserve formatting:
  ```bash
  git commit -m "$(cat <<'EOF'
  Short title here

  Why this change. What problem it solves. Any decisions worth recording.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```
- **Stage by filename**, not `git add -A` or `git add .` — avoids accidentally committing secrets, .env files, or ignored noise that slipped through.
- **Never `git push` without explicit user request.** GitHub push protection will likely reject anyway until the OpenAI-key history scrub is done.
- **Never use `--no-verify`, `--no-gpg-sign`, or `--amend`** on commits unless explicitly asked. New commits are always preferable to amended ones — pre-commit hooks that fail mean the commit didn't happen, and `--amend` would modify the previous (unrelated) commit instead.

### Pre-commit checklist

When the user asks for a commit:
1. `git status --short` — sanity-check what's staged and what's not.
2. `git diff --stat HEAD` — confirm the scope matches the intent.
3. Inspect any newly-added file paths before staging (no secrets, no .env, no large binaries unless intentional).
4. Stage by filename. Split into multiple commits if scope is mixed.
5. Commit with HEREDOC message.
6. `git log --oneline -5` to verify.

## Dependencies

- **Advanced Sheets API** must be enabled in Script Editor (Services → + → Google Sheets API) — used for filtered views
- **All third-party secrets live in Script Properties**, never in source. Apps Script → Project Settings → Script Properties. Required keys:
  - `OPENAI_API_KEY` — read via `getOpenAIKey_()` in AI.js (translation, classification, approval-token signing)
  - `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_GROUP_ID`, `LINE_TEST_GROUP_ID`, `LINE_EXPENSE_GROUP_ID` — read via `getLineProp_(name)` in Line.js (Flex Messages, expense approvals, diagnostics)
  
  Both helpers throw with a setup-instruction message if their property is unset. **Never reintroduce literal secrets in `Config.js`** — every push will hit GitHub push protection or GitGuardian.
- **Shared Drive** access — script owner must have write access to the shared drive

## Current Status (updated 16 May 2026)

### Session 16 May 2026 — Asset Registry design (Phase 2)
- Reviewed sample `OSKB_FM_ASSETS.xlsx` and existing form wiring (`data.assetId` already threads through `Webapp.js` into RAW_INTAKE col C / MANUAL_INPUT col E, but nothing reads from a registry yet)
- **Decided: one spreadsheet, two tabs — not two files.** Avoids cross-file `IMPORTRANGE` drift when assets are renamed or deleted.
  - Tab 1 `ASSETS` — registry + ID generator. Adding a row creates an asset.
    Columns: `ASSET_ID, CATEGORY, AREA, DISPLAY_LABEL, SERIAL_NO, MODEL, INSTALL_DATE, WARRANTY_END, QR_URL, QR_IMAGE, NOTES, ACTIVE`
  - Tab 2 `MAINTENANCE_LOG` — auto-populated from COMPLETED when the request carries an ASSET_ID.
    Columns: `ASSET_ID, REQ_ID, DATE, CATEGORY, COST, PARTS, CONTRACTOR, WARRANTY_CLAIMED, NOTES`
- **Decided: QR codes are URLs, not images.** Encode `https://<webapp>/exec?asset=OSKB-AC-001`. `QR_URL` is a formula from `ASSET_ID`; `QR_IMAGE` is `=IMAGE("https://quickchart.io/qr?text="&ENCODEURL(QR_URL))` for in-sheet preview. Menu function `generateQRLabels()` will render high-res PNGs to `OSKB/ASSETS/QR_LABELS/` for printing.
- **Decided: canonical venue code stays `OSKB`** (sample file's `OSK_…` was inconsistent with Config.js / RAW_INTAKE / REQ_IDs).
- **ID format still open.** Jay will paste a real appliance list; the candidate schemes (`OSKB-AC-001`, `OSKB-F1BH-AC-001`, etc.) get rendered side-by-side and the most readable one is locked. No code written until format is fixed.
- Design notes saved at `c:\Users\Jay\Documents\FC_FM\Asset Registry - design notes.txt` (full open-decision list there for next-session reference)

### Sessions late Apr → early May 2026 — FM Dispatch app, MCP, hooks, security
- **FM Dispatch app (`FM_Dispatch.html`) built** as a mobile manager UI mock. Single-file HTML/CSS/JS, ~1300 lines. Phone-previewed via GitHub Pages.
  - 7 dispatch venues (FLIX, GIGA, GIGR, LLFU, MRGO, OSKB, SNGS — FCHQ excluded)
  - 9 screens: Home (KPI tiles + recent activity), Jobs (filter chips + priority-strip cards), Job Detail (assign / schedule / notes / mark done / reopen / request purchase / EN-TH toggle), Calendar (Week default + Month toggle, fixed 68px cells, leave chips), Purchases (New / Approval / Payment / Paid + FC stamp graphic), Overtime (4 techs, OT entry mirroring Google Form, mark-paid with slip), Directory (Techs / Contractors / Suppliers, `tel:` + LINE buttons), Settings, Audit log
  - Login: simple name picker (Pao, Jay), no passwords. Global venue filter chip in top bar.
  - Mobile UI fixes applied during real-device testing: `#app` switched to `100dvh` (Chrome Android URL bar was pushing bottom nav off-screen with `100vh`); `.bottom-nav` set to `position: fixed`; Calendar month view refactored to fixed 68px rows + `overflow: hidden` + `+N` overflow indicators.
  - Mock data populated via MCP from real `FC_FM_REFERENCE` sheets (7 venues, 4 technicians, contractors + 5 suppliers, 25 sample jobs from REQUESTS, 4 purchase requests, 7 OT entries, 4 leave entries).
  - **`?app=dispatch` routing in `doGet()` is NOT yet wired** — UI lives on the preview repo only. ~10-line backend change deferred until UI settles.
- **Phone preview infrastructure:** new public repo `jaybkk-dev/fm-dispatch-preview` (Pages enabled). Cannot push to `jaybkk-dev/FC_FM` because the old OpenAI key is in commit history. Iteration loop: edit `FC_FM/FM_Dispatch.html` (master) → copy to `fm-dispatch-preview/FM_Dispatch.html` → git push → Pages redeploys in 30–60s → hard-refresh on phone.
  - Preview URL: https://jaybkk-dev.github.io/fm-dispatch-preview/FM_Dispatch.html
  - Preview working copy: `C:\Users\Jay\Documents\fm-dispatch-preview\`
- **Security incident: OpenAI API key was committed to public `jaybkk-dev/FC_FM`.** Hardcoded in `Config.js` in commits `885f70a` and `eaf575b`. GitHub push protection blocked a later commit, surfacing the issue.
  - **Action taken:** Jay rotated to `FC_FM_MASTER_REQUESTS_v2`, updated `Config.js`, verified translations still work, deleted the old key.
  - **Still pending:** scrubbing the old key from commits `885f70a` / `eaf575b` via `git filter-repo` + force-push. Cosmetic at this point (exposure already happened) but worth doing for hygiene.
- **MCP server registered for Claude Code** via new `.mcp.json` in repo root pointing at Jay's general-purpose Sheets+Drive server (`LA PATIS - MCP/server.py`). 13 tools available: `list_spreadsheets, get_sheet_metadata, read_range, read_full_sheet, read_multiple_ranges, search_in_sheet, get_named_ranges, write_range, append_rows, create_spreadsheet, get_file_info, list_folders, search_files`. Used to pull real venue / technician / contractor / OT data for the dispatch mock.
- **SessionStart hook added** to `.claude/settings.json`: runs `clasp deployments` silently at session start; if clasp can't reach Apps Script (expired OAuth / `invalid_grant` / `invalid_rapt`), injects a "Run `clasp.cmd login`" warning into context. Closes a feedback loop where the auto-push PostToolUse hook had been failing silently for hours due to expired OAuth, costing ~2 hours of misdiagnosis. (Cannot catch mid-session auth expirations.)
- **Stop hook removed** from `.claude/settings.json` — was firing relentlessly and re-arguing the same point. PostToolUse auto-push hook unchanged.
- **PowerShell gotcha:** `clasp login` fails with "running scripts is disabled" on default execution policy. Workaround: `clasp.cmd login` or Git Bash terminal profile.
- **Files changed:** `FM_Dispatch.html` (NEW, ~1300 lines), `.mcp.json` (NEW), `.claude/settings.json` (SessionStart hook + allowlists), `Config.js` (rotated OpenAI key)

### Session 29 Apr 2026 — LINE monthly quota exhausted; silent failures now surfaced
- Staff reported requests not reaching the LINE maintenance group. RAW_INTAKE rows were being written and files uploaded, but no Flex Message arrived
- **Root cause:** the LINE Official Account hit its monthly push quota. Thailand free Communication plan = **300 messages/month**; dashboard showed 291/300 and the actual usage had already crossed 300. LINE API returned `429 {"message":"You have reached your monthly limit."}` on every push
- `notifyLineGroup_` was wrapping `sendLineMessage_` in `try { ... } catch (e) { Logger.log(...) }` — a deliberate "never block a submission for a LINE failure" pattern. Consequence: zero visibility when LINE quota / token / membership failed. No error surfaced in the execution log, no row written anywhere
- **Changes made (Line.js, Webapp.js, Drive.js, WebApp.html):**
  - `notifyLineGroup_` now writes every LINE failure to a new auto-created `LINE_LOG` sheet (cols: TIMESTAMP, REQ_ID, TITLE, AUTHOR, REASON) via new helper `logLineFailure_()`. Silent failures impossible going forward.
  - Added `lineHealthCheck()` — pings `GET /v2/bot/group/{id}/summary` to verify the bot is still in the production OSKAR MAINTENANCE group. No message sent.
  - Added `diagnoseLastSubmission()` — replays the last RAW_INTAKE row through `buildFlexMessage_` + `sendLineMessage_` to `LINE_TEST_GROUP_ID` so staff are never bothered.
  - `sendLineAfterUpload` now dedups via `CacheService` (5 min TTL on `reqId`) — server-side trigger and client-side fallback both call it safely.
  - `uploadFilesBackground` / `uploadEventFilesBackground` in `WebApp.html` now ALSO call `sendLineAfterUpload` client-side when the chain completes, as a fallback if the server-side `triggerLine` path drops. Dedup ensures no double-send.
  - `uploadSingleFile` (Drive.js) now logs `triggerLine=YES (reqId=...)` or `triggerLine=no` for every upload, so the next failing submission tells us whether the deployed HTML is sending the trigger.
- **Decision:** stay on the free 300/msg/month plan. Real production demand at OSKB is ~30–40 messages/month (April had ~20 real submissions; the bulk of the 291 was Jay's own testing). Light plan (~₿1,200/month) deferred until rollout to a second venue.
- **Quota reset:** midnight 1 May JST (≈22:00 30 Apr Bangkok). Until then, no LINE pushes will succeed regardless of code state.
- **Files changed:** `Line.js` (notifyLineGroup_, logLineFailure_, lineHealthCheck, diagnoseLastSubmission), `Webapp.js` (CacheService dedup at top of sendLineAfterUpload), `Drive.js` (triggerLine log line), `WebApp.html` (client-side fallback in both upload chains)

### Session 25 Apr 2026 — Fixed LINE notification race condition
- Jay flagged 3 RAW_INTAKE rows from 24 Apr (REQ 053, 054, 057, all from JANE) where only row 057 produced a LINE Flex in the maintenance group
- Execution logs confirmed: `submitRequest` + `uploadSingleFile` ran for all three, but `sendLineAfterUpload` only fired for 057
- **Root cause — client-side race in `WebApp.html`:** the upload chains in `uploadFilesBackground()` and `uploadEventFilesBackground()` read globals `attachedFiles` / `eventFiles`, `submissionData`, and `uploadFailures`. `resetApp()` (triggered by "Submit Another Request") zeroes those globals. When the user tapped that button before the async upload chain finished, the success callback fired with `length === 0` and `submissionData === null`, so the "all done" branch returned without calling `sendLineAfterUpload`
- **Fix applied:** `onSubmitSuccess` and the event-submit handler now snapshot `attachedFiles` / `eventFiles` and create a local `failures` array at chain start. `uploadFilesBackground` / `uploadEventFilesBackground` now take `(folderId, idx, files, submission, failures)` as params and no longer read globals. `resetApp()` can no longer wipe an in-flight chain
- **Files changed:** `WebApp.html` (L1206-1227, L1237-1261, L2135-2153, L2160-2184). Clasp auto-push fired on each edit
- **Deployed:** Jay redeployed on 25 Apr 2026 — fix now live on production URL

### Session 25 Apr 2026 (cont.) — LINE unsend: removed dead code
- Checked whether the bot can delete Flex messages from a LINE group. **It cannot.**
- `unsendLineMessage()` was targeting `https://api.line.me/v2/bot/message/{id}/cancel` — not a real LINE Messaging API endpoint (would return 404). The LINE Messaging API has no bot-side delete endpoint for group messages; "unsend" in the LINE app is client-side UI, personal chats only, 24h window
- Also no code ever captured `messageId` from push responses, so the function had no valid input anyway
- **Removed `unsendLineMessage()` and `unsendTestMessage()` from `Line.js`** along with their doc comments

### Session 20 Apr 2026 — Asset Registry kickoff (analysis only)
- Inspected sample file `OSKB_FM_ASSETS.xlsx` — 4 sheets: `CONFIG` (areas), `ID_GENERATOR` (VENUE+AREA+GROUP+TYPE → ID), `APPLIANCES`, `HVAC` (columns: ASSET_ID, VENUE_CODE, AREA_CODE, GROUP_CODE, TYPE_CODE, DISPLAY_LABEL, SERIAL_NO, MODEL, INSTALL_DATE, WARRANTY_END, NOTES, ACTIVE)
- Confirmed form already passes `data.assetId` through `Webapp.js` (cols C/E writes) but nothing reads from a registry yet
- **Open design questions, awaiting Jay's direction:**
  1. ASSET_ID format — sample uses `OSK_F1KC_FZ001` vs CLAUDE.md's `OSKB-AC-001`. Need canonical pick.
  2. One flat `ASSETS` sheet (CATEGORY column) vs per-category tabs (sample style)
  3. First slice — schema finalization, form dropdown wiring, data population, or QR generation
- No code changed this session


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
1. **LINE notification race condition** — **FIXED 25 Apr 2026** (patched + redeployed). Closure-local snapshots added to `onSubmitSuccess` and the event-support handler; `uploadFilesBackground` / `uploadEventFilesBackground` no longer read globals
2. **LINE silent failures** — **FIXED 29 Apr 2026.** All failures now write to `LINE_LOG` sheet via `logLineFailure_`. Diagnostics (`lineHealthCheck`, `diagnoseLastSubmission`) added. Dedup + client-side fallback added.
3. **Redeploy WebApp.html** — required to make the 29 Apr client-side fallback live. .gs changes already active (Apps Script always runs Head).
4. **Verify post-reset (1 May 2026)** — first staff submission after midnight 1 May JST should arrive in LINE. If not, check `LINE_LOG` for the new failure reason.
5. **Asset Registry — provide real OSKB appliance list.** Jay to paste a list (what / where / quantity). Candidate ID schemes get rendered side-by-side. Once format is locked, build `OSKB_FM_ASSETS` spreadsheet with `ASSETS` tab + auto-generated `QR_URL` / `QR_IMAGE` columns + menu function for high-res QR export. `MAINTENANCE_LOG` and form integration follow in a second pass.
6. **FM Dispatch `?app=dispatch` routing** — wire `FM_Dispatch.html` into `doGet()` so the production URL serves either submission form or dispatch app based on query param. ~10-line change in `Webapp.js`. Deferred until UI settles.
7. **FM Dispatch backend wiring** — incremental after UI settles: AUDIT_LOG sheet, PURCHASE_REQUESTS sheet, OT tracker integration, real Drive photo reads, LINE Flex on approval / payment / completion.
8. **FM Dispatch UI tweaks** — Jay has a batch of edits to apply in one revision pass.
9. **Master spreadsheet rename** — `OSKB_FM_MASTER_REQUESTS` → `FC_FM_MASTER_REQUESTS` (File → Rename in the sheet UI). Code already references the unified name.
10. **Scrub OpenAI key from FC_FM git history** — **DONE 16 May 2026.** `git filter-repo` removed old and new keys from all commits; key migrated to Script Properties; force-pushed to origin.
11. **Expense approval section UI** — white card background not rendering correctly, needs styling fix
12. **Voice-to-text** — approach TBD (client-side Speech API vs server-side Whisper)
13. **Dedicated test functions** — most test functions in the CLAUDE.md table not yet built (only `testLineFlex`, `testLineFlexWithImages`, `runSystemCheck`, `lineHealthCheck`, `diagnoseLastSubmission` exist)
14. **Cleanup test data** — delete test rows from RAW_INTAKE / REQUESTS / EXPENSE_APPROVAL, reset counters. Testing burns LINE quota 1:1 with real submissions, so heavy testing is what exhausted April's cap.
15. **Manager dispatch app rollout** — after UI settles + backend wired
16. **Clone to other venues** — change `VENUE_CODE` in Config.gs and repeat setup

### LINE failure surfacing (added 29 Apr 2026)
- New `LINE_LOG` sheet auto-creates on first failure. One row per failed push: `TIMESTAMP, REQ_ID, TITLE, AUTHOR, REASON` (full stack)
- `lineHealthCheck()` — verifies bot is still in the OSKAR MAINTENANCE production group via `/v2/bot/group/{id}/summary`. No message sent.
- `diagnoseLastSubmission()` — replays the last RAW_INTAKE row through the Flex pipeline to `LINE_TEST_GROUP_ID` (not production). Distinguishes "Flex builder broken" from "production group / quota broken".
- `sendLineAfterUpload` dedupes via `CacheService` (key = `lineSent_<reqId>`, TTL 300s). Both server-side trigger and client-side fallback may call it; only the first wins.
- Client-side fallback: after the upload chain finishes, `WebApp.html` calls `sendLineAfterUpload` even if server-side `triggerLine` didn't run. Belt-and-suspenders.

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
- **LINE quota constraint** — free Thailand Communication plan caps at **300 push messages/month**. Resets midnight 1st of each month JST. Tests count against the same budget as real submissions because they share the same bot/channel/token. Real production demand at one venue is well under 300/month; heavy testing is what exhausts it.
- **Expense section UI** — styling doesn't match mockup (white card not rendering properly on gold background)
- **Clasp push reliability** — clasp sometimes says "up to date" when it hasn't pushed. Workaround: append a comment to force a diff, then push. Verify via `clasp pull` (file count should match) and grep the local file after.

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
