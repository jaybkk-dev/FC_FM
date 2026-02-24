// ============================================================
// FC FACILITIES MANAGEMENT — FORMAT
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// Sheet formatting, single-row formatting, trim empty rows,
// and MANUAL_INPUT row addition.
// FORMAT spec + COL_WIDTHS + CENTERED_HEADERS are in Config.gs.
// ============================================================


// ======================== FULL SHEET FORMAT ========================

/**
 * Applies full formatting to a single sheet by name.
 */
function formatSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log('Sheet not found: ' + sheetName); return; }

  const lastCol = sheet.getLastColumn() || 1;
  const lastRow = sheet.getLastRow() || 1;

  // Remove trailing empty columns
  const maxCols = sheet.getMaxColumns();
  if (maxCols > lastCol) {
    sheet.deleteColumns(lastCol + 1, maxCols - lastCol);
  }

  // Hide gridlines + freeze header
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(FORMAT.frozenRows);

  // Header row
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange
    .setBackground(FORMAT.headerBg)
    .setFontColor(FORMAT.headerFont)
    .setFontSize(FORMAT.headerSize)
    .setFontWeight(FORMAT.headerWeight)
    .setFontFamily(FORMAT.fontFamily)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, FORMAT.headerRowH);

  // Header vertical borders (thin black)
  headerRange.setBorder(null, null, null, null, true, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Double border under header
  if (lastRow > 1) {
    headerRange.setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.DOUBLE);
  }

  // Read headers for column logic
  const headers = headerRange.getValues()[0];

  // Body formatting
  if (lastRow > 1) {
    const bodyRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    bodyRange
      .setFontColor(FORMAT.bodyFont)
      .setFontSize(FORMAT.bodySize)
      .setFontFamily(FORMAT.fontFamily)
      .setVerticalAlignment('middle');

    // Vertical borders (thin) + horizontal borders (dashed)
    bodyRange.setBorder(null, null, null, null, true, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    bodyRange.setBorder(null, null, null, null, null, true, '#000000', SpreadsheetApp.BorderStyle.DASHED);

    // Alt row colors + row heights
    for (let r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 1, 1, lastCol).setBackground(r % 2 === 0 ? FORMAT.altRowBg : '#FFFFFF');
      sheet.setRowHeight(r, FORMAT.defaultRowH);
    }

    // Column-specific alignment + ASSET_ID bg
    for (let c = 0; c < headers.length; c++) {
      const hName = String(headers[c]).trim().toUpperCase();
      const colBodyRange = sheet.getRange(2, c + 1, lastRow - 1, 1);
      colBodyRange.setHorizontalAlignment(CENTERED_HEADERS.indexOf(hName) >= 0 ? 'center' : 'left');
      if (hName === 'ASSET_ID') colBodyRange.setBackground(FORMAT.assetIdBg);
    }
  }

  // Column widths
  for (let w = 0; w < headers.length; w++) {
    const headerName = String(headers[w]).trim().toUpperCase();
    if (COL_WIDTHS[headerName]) {
      sheet.setColumnWidth(w + 1, COL_WIDTHS[headerName]);
    }
  }

  // REQUESTS/COMPLETED: N-P manual input section
  if (sheetName === 'REQUESTS' || sheetName === 'COMPLETED') {
    formatManualInputColumns_(sheet, lastRow);
  }

  Logger.log('Formatted: ' + sheetName + ' (' + lastRow + ' rows, ' + lastCol + ' cols)');
}


/**
 * Formats ALL operational sheets.
 */
function formatAllSheets() {
  const tabs = ['RAW_INTAKE', 'MANUAL_INPUT', 'REQUESTS', 'COMPLETED'];
  tabs.forEach(function(name) { formatSheet(name); });
  Logger.log('formatAllSheets complete.');
  try { SpreadsheetApp.getUi().alert('All sheets formatted.'); } catch (e) {}
}


/**
 * Special formatting for columns N-P (manual input) in REQUESTS/COMPLETED.
 */
function formatManualInputColumns_(sheet, lastRow) {
  const nCol = 14, pCol = 16;
  if (sheet.getLastColumn() < pCol) return;
  if (lastRow < 2) return;

  const bodyRows = lastRow - 1;

  // Background on body only
  sheet.getRange(2, nCol, bodyRows, pCol - nCol + 1).setBackground(FORMAT.manualInputBg);

  // Left border of N: double black
  sheet.getRange(1, nCol, lastRow, 1).setBorder(null, true, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.DOUBLE);

  // Right border of P: double black
  sheet.getRange(1, pCol, lastRow, 1).setBorder(null, null, null, true, null, null, '#000000', SpreadsheetApp.BorderStyle.DOUBLE);

  // Internal verticals N-P: thin solid
  sheet.getRange(1, nCol, lastRow, pCol - nCol + 1).setBorder(null, null, null, null, true, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
}


// ======================== SINGLE ROW FORMAT ========================

/**
 * Formats a single newly-appended row.
 * Called by submitRequest, import pipeline, archive.
 * Optional: pass headers array to avoid re-reading row 1.
 */
function formatNewRow(sheet, rowNum, headersCache) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  const sheetName = sheet.getName();

  const row = sheet.getRange(rowNum, 1, 1, lastCol);

  // Base formatting
  row.setFontFamily(FORMAT.fontFamily)
     .setFontSize(FORMAT.bodySize)
     .setFontColor(FORMAT.bodyFont)
     .setVerticalAlignment('middle');

  // Alt row color
  row.setBackground(rowNum % 2 === 0 ? FORMAT.altRowBg : '#FFFFFF');
  sheet.setRowHeight(rowNum, FORMAT.defaultRowH);

  // Borders
  row.setBorder(null, null, null, null, true, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  row.setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.DASHED);

  // Column-specific alignment + ASSET_ID bg
  const headers = headersCache || sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let c = 0; c < headers.length; c++) {
    const hName = String(headers[c]).trim().toUpperCase();
    const cell = sheet.getRange(rowNum, c + 1);
    cell.setHorizontalAlignment(CENTERED_HEADERS.indexOf(hName) >= 0 ? 'center' : 'left');
    if (hName === 'ASSET_ID') cell.setBackground(FORMAT.assetIdBg);
  }

  // REQUESTS/COMPLETED: N-P special formatting
  if ((sheetName === 'REQUESTS' || sheetName === 'COMPLETED') && lastCol >= 16) {
    sheet.getRange(rowNum, 14, 1, 3).setBackground(FORMAT.manualInputBg);
    sheet.getRange(rowNum, 14).setBorder(null, true, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.DOUBLE);
    sheet.getRange(rowNum, 16).setBorder(null, null, null, true, null, null, '#000000', SpreadsheetApp.BorderStyle.DOUBLE);
    sheet.getRange(rowNum, 14, 1, 3).setBorder(null, null, null, null, true, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }
}


// ======================== TRIM EMPTY ROWS ========================

/**
 * Deletes all rows after the last row containing actual data.
 * MANUAL_INPUT excluded (uses pre-formatted empty rows by design).
 */
function trimEmptyRows(sheet) {
  if (!sheet) return;
  if (sheet.getName() === 'MANUAL_INPUT') return;

  const maxRows = sheet.getMaxRows();
  if (maxRows <= 1) return;

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;

  const allData = sheet.getRange(1, 1, maxRows, lastCol).getValues();

  let lastDataRow = 1; // keep header at minimum
  for (let r = allData.length - 1; r >= 1; r--) {
    let hasData = false;
    for (let c = 0; c < allData[r].length; c++) {
      const val = allData[r][c];
      if (val !== '' && val !== null && val !== undefined && val !== false) {
        hasData = true;
        break;
      }
    }
    if (hasData) {
      lastDataRow = r + 1;
      break;
    }
  }

  const emptyCount = maxRows - lastDataRow;
  if (emptyCount > 0) {
    sheet.deleteRows(lastDataRow + 1, emptyCount);
    Logger.log('trimEmptyRows: ' + sheet.getName() + ' — deleted ' + emptyCount + ' empty rows');
  }
}


/**
 * Trims empty rows on all operational tabs.
 */
function trimAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabs = ['RAW_INTAKE', 'REQUESTS', 'COMPLETED'];
  tabs.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) trimEmptyRows(sheet);
  });
  Logger.log('trimAllSheets complete.');
  try { SpreadsheetApp.getUi().alert('Empty rows trimmed on RAW_INTAKE, REQUESTS, COMPLETED.'); } catch (e) {}
}


// ======================== ADD MANUAL_INPUT ROWS ========================

/**
 * Adds 50 formatted rows to MANUAL_INPUT with dropdowns + checkboxes.
 * Copies data validation from row 2 (template row).
 */
function addManualInputRows(count) {
  count = count || 50;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('MANUAL_INPUT');
  if (!sheet) throw new Error('MANUAL_INPUT not found');

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getMaxRows();
  const startRow = lastRow + 1;

  // Add blank rows
  sheet.insertRowsAfter(lastRow, count);

  // Copy data validation from row 2
  for (let col = 1; col <= lastCol; col++) {
    const validation = sheet.getRange(2, col).getDataValidation();
    if (validation) {
      sheet.getRange(startRow, col, count, 1).setDataValidation(validation);
    }
  }

  // Format new rows
  const newRange = sheet.getRange(startRow, 1, count, lastCol);
  newRange
    .setFontFamily(FORMAT.fontFamily)
    .setFontSize(FORMAT.bodySize)
    .setFontColor(FORMAT.bodyFont)
    .setVerticalAlignment('middle');

  // Borders
  newRange.setBorder(null, null, null, null, true, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  newRange.setBorder(null, null, null, null, null, true, '#000000', SpreadsheetApp.BorderStyle.DASHED);

  // Alt colors, alignment, ASSET_ID
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let r = startRow; r < startRow + count; r++) {
    sheet.getRange(r, 1, 1, lastCol).setBackground(r % 2 === 0 ? FORMAT.altRowBg : '#FFFFFF');
    sheet.setRowHeight(r, FORMAT.defaultRowH);
  }
  for (let c = 0; c < headers.length; c++) {
    const hName = String(headers[c]).trim().toUpperCase();
    const colRange = sheet.getRange(startRow, c + 1, count, 1);
    colRange.setHorizontalAlignment(CENTERED_HEADERS.indexOf(hName) >= 0 ? 'center' : 'left');
    if (hName === 'ASSET_ID') colRange.setBackground(FORMAT.assetIdBg);
  }

  SpreadsheetApp.flush();
  Logger.log('Added ' + count + ' formatted rows to MANUAL_INPUT (rows ' + startRow + '-' + (startRow + count - 1) + ')');
  try { SpreadsheetApp.getUi().alert('Added ' + count + ' rows to MANUAL_INPUT.'); } catch (e) {}
}
