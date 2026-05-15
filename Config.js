// ============================================================
// FC FACILITIES MANAGEMENT — CONFIG
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// All shared constants in one place.
// When cloning to a new venue, update VENUE_CODE and logoUrl.
// ============================================================

// --- VENUE (change per deployment) ------------------------------
const VENUE_CODE = 'OSKB';

// --- EXTERNAL IDS -----------------------------------------------
const REFERENCE_ID   = '1FExzbsxkJKdIp4tRvN5WRwqiVcYbMKYMbprrUIu-Psc';
const SHARED_DRIVE_ID = '0ADtrX772uxBkUk9PVA';

// --- PEOPLE -----------------------------------------------------
const OWNER_EMAIL     = 'jsebag@gmail.com';
const ASSISTANT_EMAIL = 'pao@gigibangkok.com';

// --- OPENAI -----------------------------------------------------
// The API key lives in Script Properties (Apps Script → Project Settings →
// Script Properties → `OPENAI_API_KEY`), NOT in source. Read it via
// `getOpenAIKey_()` defined in AI.js.
const OPENAI_MODEL   = 'gpt-4o-mini';
const OPENAI_URL     = 'https://api.openai.com/v1/chat/completions';

// --- TEST MODE --------------------------------------------------
// Set to true to route all LINE messages to the test group.
// Set to false for production. Always false before go-live.
const TEST_MODE = false;

// --- LINE MESSAGING API -----------------------------------------
// All LINE secrets live in Script Properties (Apps Script → Project Settings →
// Script Properties), NOT in source. Read via `getLineProp_()` in Line.js.
// Required property names:
//   LINE_CHANNEL_ACCESS_TOKEN  — long-lived channel access token
//   LINE_GROUP_ID              — production OSKAR MAINTENANCE group
//   LINE_TEST_GROUP_ID         — test group (LINE FLEX TESTS, Jay only)
//   LINE_EXPENSE_GROUP_ID      — OSKAR MAINTENANCE EXPENSES group

// --- TIMEZONE ---------------------------------------------------
const TZ = 'Asia/Bangkok';

// --- FORMAT SPEC ------------------------------------------------
const FORMAT = {
  headerBg:      '#E6A831',
  headerFont:    '#FFFFFF',
  headerSize:    11,
  headerWeight:  'bold',
  bodyFont:      '#000000',
  bodySize:      10,
  altRowBg:      '#FFF8E7',
  frozenRows:    1,
  defaultRowH:   28,
  headerRowH:    36,
  fontFamily:    'Arial',
  assetIdBg:     '#f4ca77',
  manualInputBg: '#ffe1a4',
};

// --- CENTERED HEADERS -------------------------------------------
const CENTERED_HEADERS = [
  'VENUE', 'REQUEST_TYPE', 'AUTHOR', 'REQUESTED_BY', 'PRIORITY',
  'PRIORITY_LEVEL', 'ASSIGNED_TO', 'DONE', 'STATUS',
];

// --- COLUMN WIDTHS ----------------------------------------------
const COL_WIDTHS = {
  'INTAKE_TS':          160,
  'INPUT_TS':           160,
  'REQ_ID':             140,
  'TIMESTAMP':          160,
  'VENUE':              70,
  'ASSET_ID':           100,
  'REQUEST_TYPE':       130,
  'AREA':               140,
  'REQUEST_TITLE':      220,
  'REQUEST_DETAILS':    300,
  'REQUEST_DETAILS_EN': 250,
  'REQUEST_DETAILS_TH': 250,
  'AUTHOR':             100,
  'REQUESTED_BY':       120,
  'MEDIA_LINKS':        160,
  'DESTINATION_FOLDER': 160,
  'TASK_CATEGORY':      180,
  'PRIORITY_LEVEL':     120,
  'ASSIGNED_TO':        130,
  'APPOINTMENT_TS':     160,
  'DISPATCH_NOTES':     200,
  'LAST_UPDATED_TS':    160,
  'DONE':               70,
  'COMPLETED_TS':       160,
  'CLOSURE_NOTES':      200,
};


// pushed 1777827200 // dedup + client fallback
