// ============================================================
// FC FACILITIES MANAGEMENT — PIPELINE
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// Import engine, archive, REQ_ID generation,
// Quick Add Contractor, and scheduled triggers.
// ============================================================


// =====================================================================
// REQUEST ID GENERATOR
// =====================================================================

/**
 * Generates REQ_ID: VENUE + YYMMDD + 3-digit monthly ordinal.
 * E.g., OSKB260223001. Scans REQUESTS, COMPLETED, and RAW_INTAKE.
 */
function generateReqId_(venueCode, timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = yy + mm + dd;
  const monthPrefix = venueCode + yy + mm;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let count = 0;

  // Check REQUESTS col A
  const requestsSheet = ss.getSheetByName('REQUESTS');
  if (requestsSheet && requestsSheet.getLastRow() > 1) {
    const reqIds = requestsSheet.getRange('A2:A' + requestsSheet.getLastRow()).getValues().flat();
    count += reqIds.filter(function(id) { return String(id).startsWith(monthPrefix); }).length;
  }

  // Check COMPLETED col A
  const completedSheet = ss.getSheetByName('COMPLETED');
  if (completedSheet && completedSheet.getLastRow() > 1) {
    const compIds = completedSheet.getRange('A2:A' + completedSheet.getLastRow()).getValues().flat();
    count += compIds.filter(function(id) { return String(id).startsWith(monthPrefix); }).length;
  }

  // Check RAW_INTAKE col K for pre-generated IDs
  const rawSheet = ss.getSheetByName('RAW_INTAKE');
  if (rawSheet && rawSheet.getLastRow() > 1 && rawSheet.getLastColumn() >= 11) {
    const rawIds = rawSheet.getRange(2, 11, rawSheet.getLastRow() - 1, 1).getValues().flat();
    count += rawIds.filter(function(id) { return String(id).startsWith(monthPrefix); }).length;
  }

  return venueCode + dateStr + String(count + 1).padStart(3, '0');
}


// =====================================================================
// IMPORT PIPELINE
// =====================================================================

/**
 * Master import — processes both RAW_INTAKE and MANUAL_INPUT.
 */
function importFromAllSources() {
  let rawCount = 0;
  let manualCount = 0;
  let rawError = '';
  let manualError = '';

  try { rawCount = importFromRawIntake_(); }
  catch (e) { rawError = e.message; Logger.log('RAW_INTAKE import error: ' + e.message); }

  try { manualCount = importFromManualInput_(); }
  catch (e) { manualError = e.message; Logger.log('MANUAL_INPUT import error: ' + e.message); }

  const total = rawCount + manualCount;
  Logger.log('Import complete: ' + rawCount + ' from RAW_INTAKE, ' + manualCount + ' from MANUAL_INPUT');

  try {
    let msg = total > 0
      ? total + ' request(s) imported:\n- ' + rawCount + ' from web app\n- ' + manualCount + ' from manual input'
      : 'No new unprocessed requests found.';
    if (rawError) msg += '\n\n⚠️ RAW_INTAKE error: ' + rawError;
    if (manualError) msg += '\n\n⚠️ MANUAL_INPUT error: ' + manualError;
    SpreadsheetApp.getUi().alert('Import Results', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* trigger context — no UI */ }

  return total;
}


/**
 * Imports unprocessed rows from RAW_INTAKE into REQUESTS.
 */
function importFromRawIntake_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('RAW_INTAKE');
  const reqSheet = ss.getSheetByName('REQUESTS');
  if (!rawSheet || !reqSheet) throw new Error('Required sheets not found');

  const lastRow = rawSheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = rawSheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const mediaFormulas = rawSheet.getRange(2, 9, lastRow - 1, 1).getFormulas();

  // Pre-load categories for batch efficiency
  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const catSheet = refSs.getSheetByName('TASK_CATEGORIES');
  const catData = catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 2).getValues();

  // Cache REQUESTS headers for formatNewRow
  const reqHeaders = reqSheet.getRange(1, 1, 1, reqSheet.getLastColumn()).getValues()[0];

  let importCount = 0;
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const processed = row[9]; // J: DONE
    const venueCode = String(row[1]).trim();

    if (processed === true || processed === 'TRUE' || !venueCode) continue;

    try {
      const timestamp = row[0] || new Date();
      const requestType = String(row[3]).trim();
      const area = String(row[4]).trim();
      const title = String(row[5]).trim();
      const details = String(row[6]).trim();
      const author = String(row[7]).trim();
      const mediaLinks = String(row[8]).trim();

      // Reuse existing REQ_ID from col K if present
      const existingReqId = String(row[10]).trim();
      const reqId = existingReqId || generateReqId_(venueCode, timestamp);

      // AI: translate + classify (with cached categories)
      let enTitle = title;
      try { enTitle = translateTitle_(title) || title; }
      catch (e) { Logger.log('Title translation failed row ' + (i + 2) + ': ' + e.message); }

      let translated = { en: details, th: details };
      try { translated = translateText_(details); }
      catch (e) { Logger.log('Details translation failed row ' + (i + 2) + ': ' + e.message); }

      let classification = { category: 'GENERAL MAINTENANCE', priority: 'MODERATE' };
      try { classification = classifyRequest_(enTitle, translated.en || details, mediaLinks, catData); }
      catch (e) { Logger.log('Classification failed row ' + (i + 2) + ': ' + e.message); }

      const newRow = [
        reqId,                          // A: REQ_ID
        timestamp,                      // B: TIMESTAMP
        venueCode,                      // C: VENUE
        area,                           // D: AREA
        String(row[2]).trim(),          // E: ASSET_ID
        requestType,                    // F: REQUEST_TYPE
        enTitle,                        // G: REQUEST_TITLE
        translated.en || details,       // H: REQUEST_DETAILS_EN
        translated.th || details,       // I: REQUEST_DETAILS_TH
        author,                         // J: AUTHOR
        mediaLinks,                     // K: MEDIA_LINKS
        classification.category,        // L: TASK_CATEGORY
        classification.priority,        // M: PRIORITY_LEVEL
        '',                             // N: ASSIGNED_TO
        '',                             // O: APPOINTMENT_TS
        '',                             // P: DISPATCH_NOTES
        new Date(),                     // Q: LAST_UPDATED_TS
        false,                          // R: DONE
      ];

      reqSheet.appendRow(newRow);
      const newReqRow = reqSheet.getLastRow();
      formatNewRow(reqSheet, newReqRow, reqHeaders);

      // Preserve HYPERLINK formula from MEDIA_LINKS
      if (mediaFormulas[i][0]) {
        reqSheet.getRange(newReqRow, 11).setFormula(mediaFormulas[i][0]);
      }

      // Mark as processed in RAW_INTAKE
      rawSheet.getRange(i + 2, 10).setValue(true);

      importCount++;
      Logger.log('Imported from RAW_INTAKE row ' + (i + 2) + ': ' + reqId);

    } catch (rowError) {
      errors.push('Row ' + (i + 2) + ': ' + rowError.message);
      Logger.log('RAW_INTAKE row ' + (i + 2) + ' FAILED: ' + rowError.message);
    }
  }

  SpreadsheetApp.flush();
  if (errors.length > 0) Logger.log('RAW_INTAKE errors:\n' + errors.join('\n'));
  trimEmptyRows(reqSheet);
  return importCount;
}


/**
 * Imports unprocessed rows from MANUAL_INPUT into REQUESTS.
 */
function importFromManualInput_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manualSheet = ss.getSheetByName('MANUAL_INPUT');
  const reqSheet = ss.getSheetByName('REQUESTS');
  if (!manualSheet || !reqSheet) throw new Error('Required sheets not found');

  const lastRow = manualSheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = manualSheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const mediaFormulas = manualSheet.getRange(2, 9, lastRow - 1, 1).getFormulas();

  // Pre-load categories
  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const catSheet = refSs.getSheetByName('TASK_CATEGORIES');
  const catData = catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 2).getValues();

  const reqHeaders = reqSheet.getRange(1, 1, 1, reqSheet.getLastColumn()).getValues()[0];

  let importCount = 0;
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const processed = row[9]; // J: DONE
    const venueCode = String(row[1]).trim();

    if (processed === true || processed === 'TRUE' || !venueCode) continue;

    try {
      const timestamp = row[0] || new Date();
      const requestType = String(row[3]).trim();
      const area = String(row[4]).trim();
      const title = String(row[5]).trim();
      const details = String(row[6]).trim();
      const requestedBy = String(row[7]).trim();
      const mediaLinks = String(row[8]).trim();

      if (!title) {
        Logger.log('MANUAL_INPUT row ' + (i + 2) + ' skipped: no title');
        continue;
      }

      const reqId = generateReqId_(venueCode, timestamp);

      let enTitle = title;
      try { enTitle = translateTitle_(title) || title; }
      catch (e) { Logger.log('Title translation failed row ' + (i + 2) + ': ' + e.message); }

      let translated = { en: details, th: details };
      if (details) {
        try { translated = translateText_(details); }
        catch (e) { Logger.log('Details translation failed row ' + (i + 2) + ': ' + e.message); }
      }

      let classification = { category: 'GENERAL MAINTENANCE', priority: 'MODERATE' };
      try { classification = classifyRequest_(enTitle, translated.en || details, mediaLinks, catData); }
      catch (e) { Logger.log('Classification failed row ' + (i + 2) + ': ' + e.message); }

      const newRow = [
        reqId,                                              // A: REQ_ID
        timestamp instanceof Date ? timestamp : new Date(), // B: TIMESTAMP
        venueCode,                                          // C: VENUE
        area,                                               // D: AREA
        String(row[2]).trim(),                              // E: ASSET_ID
        requestType || 'MAINTENANCE',                       // F: REQUEST_TYPE
        enTitle,                                            // G: REQUEST_TITLE
        translated.en || details,                           // H: REQUEST_DETAILS_EN
        translated.th || details,                           // I: REQUEST_DETAILS_TH
        requestedBy,                                        // J: AUTHOR
        mediaLinks,                                         // K: MEDIA_LINKS
        classification.category,                            // L: TASK_CATEGORY
        classification.priority,                            // M: PRIORITY_LEVEL
        '',                                                 // N: ASSIGNED_TO
        '',                                                 // O: APPOINTMENT_TS
        '',                                                 // P: DISPATCH_NOTES
        new Date(),                                         // Q: LAST_UPDATED_TS
        false,                                              // R: DONE
      ];

      reqSheet.appendRow(newRow);
      const newReqRow = reqSheet.getLastRow();
      formatNewRow(reqSheet, newReqRow, reqHeaders);

      // Preserve HYPERLINK formula from DESTINATION_FOLDER
      if (mediaFormulas[i][0]) {
        reqSheet.getRange(newReqRow, 11).setFormula(mediaFormulas[i][0]);
      }

      // Auto-timestamp if missing
      if (!row[0]) {
        manualSheet.getRange(i + 2, 1).setValue(new Date());
      }

      // Mark as processed
      manualSheet.getRange(i + 2, 10).setValue(true);

      importCount++;
      Logger.log('Imported from MANUAL_INPUT row ' + (i + 2) + ': ' + reqId + ' (' + venueCode + ')');

    } catch (rowError) {
      errors.push('Row ' + (i + 2) + ': ' + rowError.message);
      Logger.log('MANUAL_INPUT row ' + (i + 2) + ' FAILED: ' + rowError.message);
    }
  }

  SpreadsheetApp.flush();
  if (errors.length > 0) Logger.log('MANUAL_INPUT errors:\n' + errors.join('\n'));
  trimEmptyRows(reqSheet);
  return importCount;
}


// =====================================================================
// ARCHIVE — REQUESTS → COMPLETED
// =====================================================================

/**
 * Batch-moves rows with DONE=TRUE from REQUESTS to COMPLETED.
 * Called from menu. (Single-row instant archive is in EditTrigger.gs.)
 */
function archiveCompleted() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reqSheet = ss.getSheetByName('REQUESTS');
  const compSheet = ss.getSheetByName('COMPLETED');
  if (!reqSheet || !compSheet) throw new Error('Required sheets not found');

  const lastRow = reqSheet.getLastRow();
  if (lastRow < 2) {
    try { SpreadsheetApp.getUi().alert('No requests to archive.'); } catch (e) {}
    return;
  }

  const data = reqSheet.getRange(2, 1, lastRow - 1, 18).getValues();
  const rowsToArchive = [];
  const rowIndicesToDelete = [];

  for (let i = 0; i < data.length; i++) {
    const done = data[i][17]; // R: DONE
    if (done === true || done === 'TRUE') {
      const archiveRow = Array.prototype.slice.call(data[i]);
      while (archiveRow.length < 18) archiveRow.push('');
      archiveRow.push(new Date());               // S: COMPLETED_TS
      archiveRow.push(data[i][15] || '');         // T: CLOSURE_NOTES (from DISPATCH_NOTES)
      rowsToArchive.push(archiveRow);
      rowIndicesToDelete.push(i);
    }
  }

  if (rowsToArchive.length === 0) {
    try { SpreadsheetApp.getUi().alert('No completed jobs to archive. Mark DONE checkbox (col R) first.'); } catch (e) {}
    return;
  }

  // Cache COMPLETED headers
  const compHeaders = compSheet.getRange(1, 1, 1, compSheet.getLastColumn()).getValues()[0];
  const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  rowsToArchive.forEach(function(row) {
    compSheet.appendRow(row);
    const newRow = compSheet.getLastRow();
    compSheet.getRange(newRow, 18).setDataValidation(cbRule);
    formatNewRow(compSheet, newRow, compHeaders);
  });

  // Delete from REQUESTS (bottom-up to preserve indices)
  rowIndicesToDelete.reverse().forEach(function(i) {
    reqSheet.deleteRow(i + 2);
  });

  trimEmptyRows(reqSheet);
  trimEmptyRows(compSheet);
  SpreadsheetApp.flush();

  const msg = rowsToArchive.length + ' job(s) archived to COMPLETED.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Archive Complete', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
}


// =====================================================================
// QUICK ADD CONTRACTOR
// =====================================================================

function showQuickAddContractor() {
  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const catSheet = refSs.getSheetByName('TASK_CATEGORIES');
  const catData = catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 1).getValues();
  const categories = catData.map(function(row) { return row[0]; }).filter(Boolean);

  const html = HtmlService.createHtmlOutput(getQuickAddHtml_(categories))
    .setWidth(420)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, '➕ Quick Add Contractor');
}

function getQuickAddHtml_(categories) {
  const optionsHtml = categories.map(function(c) {
    return '<option value="' + c + '">' + c + '</option>';
  }).join('\n');

  return '<!DOCTYPE html>\n<html>\n<head>\n  <style>\n' +
    '    body { font-family: Arial, sans-serif; padding: 16px; color: #2D2D2D; }\n' +
    '    label { display: block; font-weight: bold; margin: 12px 0 4px; font-size: 13px; }\n' +
    '    input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; }\n' +
    '    select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; height: 120px; }\n' +
    '    .hint { font-size: 11px; color: #888; margin-top: 2px; }\n' +
    '    .btn-row { margin-top: 20px; text-align: right; }\n' +
    '    .btn { padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: bold; }\n' +
    '    .btn-submit { background: #E6A831; color: white; }\n' +
    '    .btn-submit:hover { background: #d49a2a; }\n' +
    '    .btn-cancel { background: #eee; color: #555; margin-right: 8px; }\n' +
    '    .btn-cancel:hover { background: #ddd; }\n' +
    '    #status { margin-top: 12px; font-size: 13px; }\n' +
    '    .error { color: #c0392b; }\n' +
    '    .success { color: #27ae60; }\n' +
    '  </style>\n</head>\n<body>\n' +
    '  <label>CONTRACTOR NAME</label>\n' +
    '  <input type="text" id="contractorName" placeholder="Type contractor name" autofocus>\n\n' +
    '  <label>CATEGORIES (select up to 3)</label>\n' +
    '  <select id="contractorCategories" multiple>\n    ' + optionsHtml + '\n  </select>\n' +
    '  <div class="hint">Hold Ctrl/Cmd to select multiple (max 3)</div>\n\n' +
    '  <div id="status"></div>\n\n' +
    '  <div class="btn-row">\n' +
    '    <button class="btn btn-cancel" onclick="google.script.host.close()">Cancel</button>\n' +
    '    <button class="btn btn-submit" onclick="submitContractor()">Add Contractor</button>\n' +
    '  </div>\n\n' +
    '  <script>\n' +
    '    function submitContractor() {\n' +
    '      var name = document.getElementById("contractorName").value.trim().toUpperCase();\n' +
    '      var select = document.getElementById("contractorCategories");\n' +
    '      var selected = Array.from(select.selectedOptions).map(function(o){return o.value;});\n' +
    '      var status = document.getElementById("status");\n' +
    '      if (!name) { status.innerHTML = \'<span class="error">Please enter a contractor name.</span>\'; return; }\n' +
    '      if (selected.length === 0) { status.innerHTML = \'<span class="error">Please select at least one category.</span>\'; return; }\n' +
    '      if (selected.length > 3) { status.innerHTML = \'<span class="error">Maximum 3 categories allowed.</span>\'; return; }\n' +
    '      status.innerHTML = "Adding contractor...";\n' +
    '      google.script.run\n' +
    '        .withSuccessHandler(function(result) { status.innerHTML = \'<span class="success">\' + result + "</span>"; setTimeout(function(){google.script.host.close();},1500); })\n' +
    '        .withFailureHandler(function(error) { status.innerHTML = \'<span class="error">Error: \' + error.message + "</span>"; })\n' +
    '        .processQuickAddContractor(name, selected);\n' +
    '    }\n' +
    '  </script>\n</body>\n</html>';
}

function processQuickAddContractor(name, categories) {
  const categoriesStr = categories.join(', ');

  const refSs = SpreadsheetApp.openById(REFERENCE_ID);
  const conSheet = refSs.getSheetByName('CONTRACTORS');

  // Check for duplicates
  const existingNames = conSheet.getRange(2, 2, Math.max(conSheet.getLastRow() - 1, 1), 1)
    .getValues().flat().map(function(n) { return String(n).trim().toUpperCase(); });
  if (existingNames.indexOf(name.toUpperCase()) >= 0) {
    throw new Error('Contractor "' + name + '" already exists.');
  }

  // Generate ID
  const prefix = getContractorPrefix_(name);
  const existingIds = conSheet.getRange(2, 1, Math.max(conSheet.getLastRow() - 1, 1), 1)
    .getValues().flat().map(String);
  let maxNum = 0;
  existingIds.forEach(function(id) {
    if (id.startsWith(prefix)) {
      const num = parseInt(id.substring(3), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  const newId = prefix + String(maxNum + 1).padStart(3, '0');

  conSheet.appendRow([newId, name, categoriesStr, '', '', '', '', '']);
  SpreadsheetApp.flush();

  Logger.log('Quick Add Contractor: ' + newId + ' — ' + name + ' (' + categoriesStr + ')');
  return '✅ Added: ' + name + ' (ID: ' + newId + ')';
}


// =====================================================================
// ASSIGNED_TO DROPDOWNS
// =====================================================================

/**
 * Updates ASSIGNED_TO dropdown (col N=14) based on TASK_CATEGORY (col L=12).
 */
function updateAssignedToDropdown_(sheet, row) {
  const category = String(sheet.getRange(row, 12).getValue()).trim();
  const assignedCell = sheet.getRange(row, 14);

  if (!category) {
    assignedCell.clearDataValidations();
    return;
  }

  const refSs = SpreadsheetApp.openById(REFERENCE_ID);

  // Look up task type
  const catSheet = refSs.getSheetByName('TASK_CATEGORIES');
  const catData = catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 3).getValues();
  let taskType = '';
  for (let i = 0; i < catData.length; i++) {
    if (String(catData[i][0]).trim() === category) {
      taskType = String(catData[i][2]).trim().toUpperCase();
      break;
    }
  }

  const names = [];

  // INTERNAL or MIXED → include technicians
  if (taskType === 'INTERNAL' || taskType === 'MIXED') {
    const techSheet = refSs.getSheetByName('TECHNICIANS');
    const techData = techSheet.getRange(2, 1, techSheet.getLastRow() - 1, 4).getValues();
    techData.forEach(function(r) {
      if (r[1] && (r[3] === true || r[3] === 'TRUE')) names.push(String(r[1]).trim());
    });
  }

  // EXTERNAL or MIXED → include matching contractors
  if (taskType === 'EXTERNAL' || taskType === 'MIXED') {
    const conSheet = refSs.getSheetByName('CONTRACTORS');
    const conData = conSheet.getRange(2, 1, conSheet.getLastRow() - 1, 3).getValues();
    conData.forEach(function(r) {
      const cName = String(r[1]).trim();
      if (!cName) return;
      const conCats = String(r[2]).split(',').map(function(c) { return c.trim(); });
      if (conCats.indexOf(category) >= 0) names.push(cName);
    });
  }

  const allOptions = names.filter(function(v, i, a) { return a.indexOf(v) === i; }); // dedupe

  // Fallback: show all if no matches
  if (allOptions.length === 0) {
    const techSheet = refSs.getSheetByName('TECHNICIANS');
    const techData = techSheet.getRange(2, 1, techSheet.getLastRow() - 1, 4).getValues();
    techData.forEach(function(r) {
      if (r[1] && (r[3] === true || r[3] === 'TRUE')) allOptions.push(String(r[1]).trim());
    });
    const conSheet = refSs.getSheetByName('CONTRACTORS');
    const conData = conSheet.getRange(2, 1, conSheet.getLastRow() - 1, 2).getValues();
    conData.forEach(function(r) { if (r[1]) allOptions.push(String(r[1]).trim()); });
  }

  if (allOptions.length > 0) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(allOptions, true)
      .setAllowInvalid(true)
      .setHelpText('Assign to: ' + taskType)
      .build();
    assignedCell.setDataValidation(rule);
  } else {
    assignedCell.clearDataValidations();
  }
}


/**
 * Refreshes all ASSIGNED_TO dropdowns in REQUESTS.
 */
function refreshAllDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('REQUESTS');
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (let row = 2; row <= lastRow; row++) {
    const category = sheet.getRange(row, 12).getValue();
    if (category) updateAssignedToDropdown_(sheet, row);
  }
  Logger.log('All dropdowns refreshed');
  try { SpreadsheetApp.getUi().alert('All ASSIGNED_TO dropdowns refreshed.'); } catch (e) {}
}


// =====================================================================
// SCHEDULED TRIGGERS
// =====================================================================

function enableAutoImport() {
  disableAutoImport_();
  ScriptApp.newTrigger('importFromAllSources')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Auto import enabled (every 5 minutes)');
  try {
    SpreadsheetApp.getUi().alert(
      'Auto Import Enabled',
      'New requests will be imported every 5 minutes.\nYou can still use the manual import button anytime.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

function disableAutoImport() {
  disableAutoImport_();
  try { SpreadsheetApp.getUi().alert('Auto Import Disabled', 'Automatic import has been turned off.', SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
}

function disableAutoImport_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'importFromAllSources') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
