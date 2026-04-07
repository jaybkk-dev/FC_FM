// ============================================================
// FC FACILITIES MANAGEMENT — SETUP
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// One-time and rarely-used functions.
// Run from Script Editor ONLY — not in the custom menu.
// ============================================================
// REQUIRES: Advanced Sheets API enabled
//   → Apps Script editor → Services → + → Google Sheets API → Add
// ============================================================


// =====================================================================
// MASTER SETUP RUNNER
// =====================================================================

/**
 * Full setup: format, protect, dropdowns, checkboxes, filtered views, contractor IDs.
 * Run from Script Editor after pasting scripts into a new spreadsheet.
 */
function runFullSetup() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Full Setup',
    'This will:\n' +
    '• Format all sheets\n' +
    '• Set protections on Master + Reference\n' +
    '• Create filtered views\n' +
    '• Setup dropdowns + checkboxes\n' +
    '• Add 50 rows to MANUAL_INPUT\n' +
    '• Generate contractor IDs\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const log = [];

  try { formatAllSheets(); log.push('✅ All sheets formatted'); }
  catch (e) { log.push('❌ Format failed: ' + e.message); }

  try { setupMasterProtections(); log.push('✅ Master protections set'); }
  catch (e) { log.push('❌ Master protections failed: ' + e.message); }

  try { setupReferenceProtections(); log.push('✅ Reference protections set'); }
  catch (e) { log.push('❌ Reference protections failed: ' + e.message); }

  try { createMasterFilteredViews(); log.push('✅ Master filtered views created'); }
  catch (e) { log.push('❌ Master filtered views failed: ' + e.message); }

  try { createReferenceFilteredViews(); log.push('✅ Reference filtered views created'); }
  catch (e) { log.push('❌ Reference filtered views failed: ' + e.message); }

  try { setupManualInputDropdowns(); log.push('✅ MANUAL_INPUT dropdowns set'); }
  catch (e) { log.push('❌ MANUAL_INPUT dropdowns failed: ' + e.message); }

  try { setupManualInputCheckboxes(); log.push('✅ MANUAL_INPUT checkboxes set'); }
  catch (e) { log.push('❌ MANUAL_INPUT checkboxes failed: ' + e.message); }

  try { setupRequestsCheckboxes(); log.push('✅ REQUESTS checkboxes set'); }
  catch (e) { log.push('❌ REQUESTS checkboxes failed: ' + e.message); }

  try { addManualInputRows(50); log.push('✅ 50 rows added to MANUAL_INPUT'); }
  catch (e) { log.push('❌ MANUAL_INPUT rows failed: ' + e.message); }

  try { generateContractorIds(); log.push('✅ Contractor IDs generated'); }
  catch (e) { log.push('❌ Contractor IDs failed: ' + e.message); }

  ui.alert('Full Setup — Results', log.join('\n'), ui.ButtonSet.OK);
}


// =====================================================================
// PROTECTIONS — MASTER
// =====================================================================

function setupMasterProtections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ['RAW_INTAKE', 'MANUAL_INPUT', 'REQUESTS', 'COMPLETED'];

  // Clear ALL existing protections
  sheetNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) { p.remove(); });
    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) { p.remove(); });
  });

  // RAW_INTAKE: warning-only
  const rawIntake = ss.getSheetByName('RAW_INTAKE');
  if (rawIntake) {
    rawIntake.getRange('1:1').protect().setDescription('RAW_INTAKE — header row').setWarningOnly(true);
    rawIntake.protect().setDescription('RAW_INTAKE — warning before editing').setWarningOnly(true);
  }

  // MANUAL_INPUT: header row only
  const manualInput = ss.getSheetByName('MANUAL_INPUT');
  if (manualInput) {
    manualInput.getRange('1:1').protect().setDescription('MANUAL_INPUT — header row').setWarningOnly(true);
  }

  // REQUESTS: warning-only, dispatch columns unprotected
  const requests = ss.getSheetByName('REQUESTS');
  if (requests) {
    requests.getRange('1:1').protect().setDescription('REQUESTS — header row').setWarningOnly(true);
    const reqProtection = requests.protect().setDescription('REQUESTS — warning before editing');
    reqProtection.setWarningOnly(true);
    reqProtection.setUnprotectedRanges([
      requests.getRange('N:N'),
      requests.getRange('O:O'),
      requests.getRange('P:P'),
      requests.getRange('R:R'),
    ]);
  }

  // COMPLETED: warning-only
  const completed = ss.getSheetByName('COMPLETED');
  if (completed) {
    completed.getRange('1:1').protect().setDescription('COMPLETED — header row').setWarningOnly(true);
    completed.protect().setDescription('COMPLETED — warning before editing').setWarningOnly(true);
  }

  // EXPENSE_APPROVAL: warning-only
  const expApproval = ss.getSheetByName('EXPENSE_APPROVAL');
  if (expApproval) {
    expApproval.getRange('1:1').protect().setDescription('EXPENSE_APPROVAL — header row').setWarningOnly(true);
    expApproval.protect().setDescription('EXPENSE_APPROVAL — warning before editing').setWarningOnly(true);
  }

  SpreadsheetApp.flush();
  Logger.log('Master protections complete');
}


// =====================================================================
// PROTECTIONS — REFERENCE
// =====================================================================

/**
 * Helper: clear + protect a sheet, return Protection object.
 */
function protectSheet_(sheet, description) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) { p.remove(); });
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) { p.remove(); });
  return sheet.protect().setDescription(description);
}

function ownerOnly_(protection) {
  protection.addEditor(OWNER_EMAIL);
  const editors = protection.getEditors();
  const toRemove = editors.filter(function(e) { return e.getEmail() !== OWNER_EMAIL; });
  if (toRemove.length > 0) protection.removeEditors(toRemove);
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
  return protection;
}

function setupReferenceProtections() {
  const ss = SpreadsheetApp.openById(REFERENCE_ID);

  const venues = ss.getSheetByName('VENUES');
  if (venues) ownerOnly_(protectSheet_(venues, 'VENUES — Jay only'));

  // USERS — open (clear existing protections)
  const users = ss.getSheetByName('USERS');
  if (users) {
    users.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) { p.remove(); });
    users.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) { p.remove(); });
  }

  const taskCat = ss.getSheetByName('TASK_CATEGORIES');
  if (taskCat) ownerOnly_(protectSheet_(taskCat, 'TASK_CATEGORIES — Jay only'));

  const techs = ss.getSheetByName('TECHNICIANS');
  if (techs) ownerOnly_(protectSheet_(techs, 'TECHNICIANS — Jay only'));

  const contractors = ss.getSheetByName('CONTRACTORS');
  if (contractors) ownerOnly_(protectSheet_(contractors, 'CONTRACTORS — Jay only (script writes via Quick Add)'));

  SpreadsheetApp.flush();
  Logger.log('Reference protections complete');
}


// =====================================================================
// FILTERED VIEWS
// =====================================================================

function getSheetId_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet.getSheetId();
}

function clearFilterViews_(spreadsheetId) {
  try {
    const resp = Sheets.Spreadsheets.get(spreadsheetId, { fields: 'sheets.filterViews' });
    const requests = [];
    resp.sheets.forEach(function(sheet) {
      if (sheet.filterViews) {
        sheet.filterViews.forEach(function(fv) {
          requests.push({ deleteFilterView: { filterId: fv.filterViewId } });
        });
      }
    });
    if (requests.length > 0) {
      Sheets.Spreadsheets.batchUpdate({ requests: requests }, spreadsheetId);
    }
  } catch (e) {
    Logger.log('clearFilterViews_ warning: ' + e.message);
  }
}

function createFilterView_(spreadsheetId, filterSpec) {
  const filterView = {
    title: filterSpec.title,
    range: {
      sheetId: filterSpec.sheetId,
      startRowIndex: filterSpec.startRow || 0,
      startColumnIndex: filterSpec.startCol || 0,
    },
    criteria: filterSpec.criteria || {},
  };
  if (filterSpec.endCol !== undefined) {
    filterView.range.endColumnIndex = filterSpec.endCol;
  }
  Sheets.Spreadsheets.batchUpdate({
    requests: [{ addFilterView: { filter: filterView } }]
  }, spreadsheetId);
}

function createReferenceFilteredViews() {
  const ssId = REFERENCE_ID;
  const ss = SpreadsheetApp.openById(ssId);
  clearFilterViews_(ssId);

  // VENUES
  const venuesId = getSheetId_(ss, 'VENUES');
  createFilterView_(ssId, { title: 'VENUES — Active Only', sheetId: venuesId, criteria: { 7: { hiddenValues: ['FALSE', ''] } } });
  createFilterView_(ssId, { title: 'VENUES — LARGE Only', sheetId: venuesId, criteria: { 2: { hiddenValues: ['SMALL'] }, 7: { hiddenValues: ['FALSE', ''] } } });
  createFilterView_(ssId, { title: 'VENUES — SMALL Only', sheetId: venuesId, criteria: { 2: { hiddenValues: ['LARGE'] }, 7: { hiddenValues: ['FALSE', ''] } } });

  // TASK_CATEGORIES
  const taskCatId = getSheetId_(ss, 'TASK_CATEGORIES');
  createFilterView_(ssId, { title: 'CATEGORIES — Active Only', sheetId: taskCatId, criteria: { 4: { hiddenValues: ['FALSE', ''] } } });
  createFilterView_(ssId, { title: 'CATEGORIES — Internal', sheetId: taskCatId, criteria: { 2: { hiddenValues: ['EXTERNAL', 'MIXED'] }, 4: { hiddenValues: ['FALSE', ''] } } });
  createFilterView_(ssId, { title: 'CATEGORIES — External', sheetId: taskCatId, criteria: { 2: { hiddenValues: ['INTERNAL', 'MIXED'] }, 4: { hiddenValues: ['FALSE', ''] } } });
  createFilterView_(ssId, { title: 'CATEGORIES — Mixed', sheetId: taskCatId, criteria: { 2: { hiddenValues: ['INTERNAL', 'EXTERNAL'] }, 4: { hiddenValues: ['FALSE', ''] } } });

  // TECHNICIANS
  const techsId = getSheetId_(ss, 'TECHNICIANS');
  createFilterView_(ssId, { title: 'TECHNICIANS — Active Only', sheetId: techsId, criteria: { 3: { hiddenValues: ['FALSE', ''] } } });

  // CONTRACTORS
  const contractorsId = getSheetId_(ss, 'CONTRACTORS');
  createFilterView_(ssId, { title: 'CONTRACTORS — All Active', sheetId: contractorsId, criteria: { 1: { hiddenValues: [''] } } });

  Logger.log('Reference filtered views created');
}

function createMasterFilteredViews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssId = ss.getId();
  clearFilterViews_(ssId);

  // Get venue codes
  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const venueSheet = refSs.getSheetByName('VENUES');
  const venueCodes = venueSheet.getRange('B2:B' + venueSheet.getLastRow()).getValues().flat().filter(String);

  // RAW_INTAKE
  const rawId = getSheetId_(ss, 'RAW_INTAKE');
  createFilterView_(ssId, { title: 'RAW_INTAKE — Unprocessed', sheetId: rawId, criteria: { 9: { hiddenValues: ['TRUE'] } } });
  venueCodes.forEach(function(code) {
    createFilterView_(ssId, { title: 'RAW_INTAKE — ' + code, sheetId: rawId, criteria: { 1: { hiddenValues: venueCodes.filter(function(c) { return c !== code; }) } } });
  });

  // MANUAL_INPUT
  const manualId = getSheetId_(ss, 'MANUAL_INPUT');
  createFilterView_(ssId, { title: 'MANUAL_INPUT — Unprocessed', sheetId: manualId, criteria: { 9: { hiddenValues: ['TRUE'] } } });

  // REQUESTS
  const reqId = getSheetId_(ss, 'REQUESTS');
  createFilterView_(ssId, { title: 'REQUESTS — Open Jobs', sheetId: reqId, criteria: { 17: { hiddenValues: ['TRUE'] } } });
  venueCodes.forEach(function(code) {
    createFilterView_(ssId, { title: 'REQUESTS — ' + code + ' (Open)', sheetId: reqId, criteria: { 2: { hiddenValues: venueCodes.filter(function(c) { return c !== code; }) }, 17: { hiddenValues: ['TRUE'] } } });
  });
  ['CRITICAL', 'URGENT', 'MODERATE', 'LOW'].forEach(function(priority) {
    createFilterView_(ssId, { title: 'REQUESTS — ' + priority, sheetId: reqId, criteria: { 12: { hiddenValues: ['CRITICAL', 'URGENT', 'MODERATE', 'LOW'].filter(function(p) { return p !== priority; }) }, 17: { hiddenValues: ['TRUE'] } } });
  });

  // COMPLETED
  const compId = getSheetId_(ss, 'COMPLETED');
  venueCodes.forEach(function(code) {
    createFilterView_(ssId, { title: 'COMPLETED — ' + code, sheetId: compId, criteria: { 2: { hiddenValues: venueCodes.filter(function(c) { return c !== code; }) } } });
  });

  Logger.log('Master filtered views created');
}


// =====================================================================
// DROPDOWN & CHECKBOX SETUP
// =====================================================================

function setupManualInputDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('MANUAL_INPUT');
  if (!sheet) throw new Error('MANUAL_INPUT sheet not found');

  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const lastRow = Math.max(sheet.getMaxRows(), 100);

  // Col A: Date picker
  const dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Select or enter date').build();
  sheet.getRange('A2:A' + lastRow).setDataValidation(dateRule);

  // Col B: VENUE dropdown
  const venueSheet = refSs.getSheetByName('VENUES');
  const venueCodes = venueSheet.getRange(2, 2, venueSheet.getLastRow() - 1, 1).getValues().flat().filter(String);
  const venueRule = SpreadsheetApp.newDataValidation().requireValueInList(venueCodes, true).setAllowInvalid(false).setHelpText('Select venue code').build();
  sheet.getRange('B2:B' + lastRow).setDataValidation(venueRule);

  // Col D: REQUEST_TYPE
  const typeRule = SpreadsheetApp.newDataValidation().requireValueInList(['MAINTENANCE', 'EVENT SUPPORT'], true).setAllowInvalid(false).setHelpText('Select request type').build();
  sheet.getRange('D2:D' + lastRow).setDataValidation(typeRule);

  // Col E: AREA — dependent on venue
  sheet.getRange('E2:E' + lastRow).clearDataValidations();
  const venueData = venueSheet.getRange(2, 1, venueSheet.getLastRow() - 1, 4).getValues();
  const venueAreasMap = {};
  venueData.forEach(function(row) {
    const code = String(row[1]).trim();
    if (code && row[3]) {
      venueAreasMap[code] = String(row[3]).split(',').map(function(a) { return a.trim(); }).filter(Boolean);
    }
  });
  const existingVenues = sheet.getRange('B2:B' + lastRow).getValues();
  for (let r = 0; r < existingVenues.length; r++) {
    const vc = String(existingVenues[r][0]).trim();
    if (vc && venueAreasMap[vc]) {
      const areaRule = SpreadsheetApp.newDataValidation().requireValueInList(venueAreasMap[vc], true).setAllowInvalid(false).setHelpText('Areas for ' + vc).build();
      sheet.getRange(r + 2, 5).setDataValidation(areaRule);
    }
  }

  SpreadsheetApp.flush();
  Logger.log('MANUAL_INPUT dropdowns set up');
  try { SpreadsheetApp.getUi().alert('MANUAL_INPUT dropdowns configured:\n- A: Date picker\n- B: VENUE\n- D: REQUEST_TYPE\n- E: AREA (venue-dependent)'); } catch (e) {}
}

function setupManualInputCheckboxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('MANUAL_INPUT');
  if (!sheet) return;
  const lastRow = Math.max(sheet.getMaxRows(), 100);
  sheet.getRange('J2:J' + lastRow).insertCheckboxes();
  SpreadsheetApp.flush();
  Logger.log('MANUAL_INPUT checkboxes set');
  try { SpreadsheetApp.getUi().alert('MANUAL_INPUT: Checkboxes added to column J (DONE)'); } catch (e) {}
}

function setupRequestsCheckboxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('REQUESTS');
  if (!sheet) return;
  const lastRow = Math.max(sheet.getMaxRows(), 500);
  sheet.getRange('R2:R' + lastRow).insertCheckboxes();
  SpreadsheetApp.flush();
  Logger.log('REQUESTS checkboxes set');
  try { SpreadsheetApp.getUi().alert('REQUESTS: Checkboxes added to column R (DONE)'); } catch (e) {}
}


// =====================================================================
// CONTRACTOR ID GENERATOR
// =====================================================================

function getContractorPrefix_(name) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  if (letters.length >= 3) return letters.substring(0, 3);
  return (letters + 'XXX').substring(0, 3);
}

function generateContractorIds() {
  const ss = SpreadsheetApp.openById(REFERENCE_ID);
  const sheet = ss.getSheetByName('CONTRACTORS');
  if (!sheet) throw new Error('CONTRACTORS sheet not found in REFERENCE file');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('No contractors to process'); return; }

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const prefixCounters = {};

  // First pass: scan existing IDs
  data.forEach(function(row) {
    const id = String(row[0]).trim();
    if (id && id.length === 6) {
      const prefix = id.substring(0, 3);
      const num = parseInt(id.substring(3), 10);
      if (!isNaN(num)) {
        prefixCounters[prefix] = Math.max(prefixCounters[prefix] || 0, num);
      }
    }
  });

  // Second pass: generate missing IDs
  let updatedCount = 0;
  const updatedIds = [];

  data.forEach(function(row) {
    const existingId = String(row[0]).trim();
    const name = String(row[1]).trim();

    if (!name) { updatedIds.push([existingId]); return; }
    if (existingId) { updatedIds.push([existingId]); return; }

    const prefix = getContractorPrefix_(name);
    const nextNum = (prefixCounters[prefix] || 0) + 1;
    prefixCounters[prefix] = nextNum;
    const newId = prefix + String(nextNum).padStart(3, '0');

    updatedIds.push([newId]);
    updatedCount++;
    Logger.log('Generated ID: ' + newId + ' for ' + name);
  });

  if (updatedCount > 0) {
    sheet.getRange(2, 1, updatedIds.length, 1).setValues(updatedIds);
    SpreadsheetApp.flush();
  }

  Logger.log('Contractor IDs: ' + updatedCount + ' generated');
  try {
    SpreadsheetApp.getUi().alert('Contractor IDs Generated', updatedCount + ' new ID(s) generated.\nCheck CONTRACTORS tab in FC_FM_REFERENCE.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}


// =====================================================================
// HEADER RENAMES (run if migrating from old column names)
// =====================================================================

function renameHeaders() {
  const globalRenames = { 'VENUE_CODE': 'VENUE', 'PROCESSED': 'DONE' };
  const manualRenames = { 'MEDIA_LINKS': 'DESTINATION_FOLDER' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c]).trim();
      if (globalRenames[h]) {
        sheet.getRange(1, c + 1).setValue(globalRenames[h]);
        Logger.log(name + ': ' + h + ' → ' + globalRenames[h]);
      }
      if (name === 'MANUAL_INPUT' && manualRenames[h]) {
        sheet.getRange(1, c + 1).setValue(manualRenames[h]);
        Logger.log(name + ': ' + h + ' → ' + manualRenames[h]);
      }
    }
  });
  Logger.log('Header renames complete.');
}


// =====================================================================
// CHECKBOX FIX (all sheets)
// =====================================================================

function fixAllCheckboxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targets = [
    { sheet: 'RAW_INTAKE',   col: 10 },
    { sheet: 'MANUAL_INPUT', col: 10 },
    { sheet: 'REQUESTS',     col: 18 },
    { sheet: 'COMPLETED',    col: 18 },
  ];
  const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  targets.forEach(function(t) {
    const sheet = ss.getSheetByName(t.sheet);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    sheet.getRange(2, t.col, lastRow - 1, 1).setDataValidation(cbRule);
    Logger.log('Checkboxes fixed: ' + t.sheet + ' col ' + t.col);
  });
}


// =====================================================================
// SHARED DRIVE AUTH TEST
// =====================================================================

function authorizeDrive() {
  const root = DriveApp.getFolderById(SHARED_DRIVE_ID);
  Logger.log('Shared Drive access OK: ' + root.getName());
  const test = root.createFolder('_test_delete_me');
  Logger.log('Write access OK');
  test.setTrashed(true);
  Logger.log('Cleanup OK — all permissions verified.');
}


// =====================================================================
// PROPERTY COUNTER RESET
// =====================================================================

/**
 * Clears all PropertiesService folder counters.
 * Run after deleting test folders from Shared Drive.
 */
function resetPropertyCounters() {
  const props = PropertiesService.getScriptProperties();
  const allKeys = props.getKeys();
  let count = 0;
  allKeys.forEach(function(key) {
    if (key.startsWith('folderCount_')) {
      props.deleteProperty(key);
      count++;
    }
  });
  Logger.log('Cleared ' + count + ' folder counter(s) from PropertiesService.');
  try {
    SpreadsheetApp.getUi().alert('Reset Complete', count + ' folder counter(s) cleared.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}
