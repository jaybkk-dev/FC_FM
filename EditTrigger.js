// ============================================================
// FC FACILITIES MANAGEMENT — EDIT TRIGGER
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// Combined installable onEdit handler.
// Run installEditTrigger() once from Script Editor to activate.
// ============================================================
// Handles:
//   1. REQUESTS col R (DONE=18) → instant archive to COMPLETED
//   2. REQUESTS col L (TASK_CATEGORY=12) → update ASSIGNED_TO dropdown
//   3. REQUESTS cols N-R (14-18) → auto-update LAST_UPDATED_TS
//   4. MANUAL_INPUT col B (VENUE=2) → update AREA dropdown
//   5. MANUAL_INPUT cols B-I (2-9) → auto-timestamp in col A
//   6. MANUAL_INPUT col F (REQUEST_TITLE=6) → auto-create destination folder
// ============================================================


function onEditMaster(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  if (sheetName === 'REQUESTS') {
    handleRequestsEdit_(e);
  } else if (sheetName === 'MANUAL_INPUT') {
    handleManualInputEdit_(e);
  }
}


// ======================== REQUESTS HANDLERS ========================

function handleRequestsEdit_(e) {
  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < 2) return;
  const sheet = e.range.getSheet();

  // Col R (18) = DONE checkbox checked → instant archive
  if (col === 18 && e.range.getValue() === true) {
    archiveRowToCompleted_(e);
  }

  // Col L (12) = TASK_CATEGORY changed → update ASSIGNED_TO
  if (col === 12) {
    updateAssignedToDropdown_(sheet, row);
  }

  // Cols N-R (14-18) edited → update LAST_UPDATED_TS
  if (col >= 14 && col <= 18) {
    sheet.getRange(row, 17).setValue(new Date());
  }
}


/**
 * Instantly archives a single row when DONE checkbox is checked.
 */
function archiveRowToCompleted_(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requestsSheet = ss.getSheetByName('REQUESTS');
  const completedSheet = ss.getSheetByName('COMPLETED');
  if (!completedSheet) return;

  const row = e.range.getRow();
  const lastCol = requestsSheet.getLastColumn();
  const rowData = requestsSheet.getRange(row, 1, 1, lastCol).getValues()[0];

  // Build COMPLETED row: 18 cols from REQUESTS + COMPLETED_TS (S) + CLOSURE_NOTES (T)
  const archiveRow = Array.prototype.slice.call(rowData);
  while (archiveRow.length < 18) archiveRow.push('');
  archiveRow.push(new Date());             // S: COMPLETED_TS
  archiveRow.push(rowData[15] || '');       // T: CLOSURE_NOTES (from DISPATCH_NOTES, col P index 15)

  completedSheet.appendRow(archiveRow);
  const newRow = completedSheet.getLastRow();

  // Re-apply checkbox on DONE col
  const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  completedSheet.getRange(newRow, 18).setDataValidation(cbRule);

  // Format and trim
  formatNewRow(completedSheet, newRow);
  trimEmptyRows(completedSheet);

  // Delete source row from REQUESTS
  requestsSheet.deleteRow(row);
  trimEmptyRows(requestsSheet);
}


// ======================== MANUAL_INPUT HANDLERS ========================

function handleManualInputEdit_(e) {
  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < 2) return;
  const sheet = e.range.getSheet();

  // Auto-timestamp in col A when cols B-I edited
  if (col >= 2 && col <= 9) {
    const tsCell = sheet.getRange(row, 1);
    if (!tsCell.getValue()) {
      tsCell.setValue(new Date());
    }
  }

  // Venue changed (col B=2) → update AREA dropdown in col E
  if (col === 2) {
    updateAreaDropdownForRow_(sheet, row, e.range.getValue());
  }

  // Request title entered (col F=6) → auto-create destination folder
  if (col === 6) {
    const venue = sheet.getRange(row, 2).getValue();
    const title = e.range.getValue();
    if (venue && title) {
      autoCreateDestinationFolder_(sheet, row, String(venue).trim());
    }
  }
}


/**
 * Updates AREA dropdown (col E) for a row based on venue selection.
 */
function updateAreaDropdownForRow_(sheet, row, venueCode) {
  const vc = String(venueCode).trim();
  const areaCell = sheet.getRange(row, 5);

  if (!vc) {
    areaCell.clearDataValidations();
    areaCell.clearContent();
    return;
  }

  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const venueSheet = refSs.getSheetByName('VENUES');
  const venueData = venueSheet.getRange(2, 1, venueSheet.getLastRow() - 1, 4).getValues();

  let areas = null;
  for (let i = 0; i < venueData.length; i++) {
    if (String(venueData[i][1]).trim() === vc) {
      areas = String(venueData[i][3]).split(',').map(function(a) { return a.trim(); }).filter(Boolean);
      break;
    }
  }

  if (areas && areas.length > 0) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(areas, true)
      .setAllowInvalid(false)
      .setHelpText('Areas for ' + vc)
      .build();
    areaCell.setDataValidation(rule);
  } else {
    areaCell.clearDataValidations();
  }

  // Clear previous area selection since venue changed
  areaCell.clearContent();
}


/**
 * Auto-creates a destination folder when MANUAL_INPUT title is filled.
 */
function autoCreateDestinationFolder_(sheet, row, venueCode) {
  const title = String(sheet.getRange(row, 6).getValue()).trim();
  const existingFolder = String(sheet.getRange(row, 9).getValue()).trim();

  // Only create if title exists, venue exists, and folder is empty
  if (!title || !venueCode || existingFolder) return;

  try {
    const timestamp = new Date();
    const folderName = buildJobFolderName_(venueCode, timestamp);
    const jobFolder = createJobFolder_(venueCode, timestamp, folderName);
    const folderUrl = jobFolder.getUrl();

    // Set hyperlink in col I (DESTINATION_FOLDER)
    sheet.getRange(row, 9).setFormula('=HYPERLINK("' + folderUrl + '","📁 ' + folderName + '")');

    Logger.log('MANUAL_INPUT row ' + row + ': created folder ' + folderName);
  } catch (e) {
    Logger.log('Auto folder creation failed row ' + row + ': ' + e.message);
  }
}


// ======================== TRIGGER MANAGEMENT ========================

/**
 * Run this ONCE from Script Editor to install the edit trigger.
 */
function installEditTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getUserTriggers(ss);

  // Remove ALL old edit triggers
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getEventType() === ScriptApp.EventType.ON_EDIT) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('onEditMaster')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert('Done. Combined edit trigger (onEditMaster) is active.');
}
