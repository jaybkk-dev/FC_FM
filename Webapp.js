// ============================================================
// FC FACILITIES MANAGEMENT — WEB APP
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// DEPLOYMENT:
//   Deploy > New deployment > Web app
//   Execute as: Me (jsebag@gmail.com)
//   Who has access: Anyone
// ============================================================
// VENUE_CODE is defined in Config.gs.
// To clone for another venue, change VENUE_CODE in Config.gs.
// ============================================================


function doGet(e) {
  // Read venue name dynamically for the title
  const config = getVenueConfig();
  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle(config.venueName + ' — Facilities')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * Returns venue configuration for the frontend.
 * Reads from REFERENCE file based on VENUE_CODE.
 */
function getVenueConfig() {
  const refSs = SpreadsheetApp.openById(REFERENCE_ID);

  // Venue details
  const venueSheet = refSs.getSheetByName('VENUES');
  const venueData = venueSheet.getRange(2, 1, venueSheet.getLastRow() - 1, 5).getValues();
  let venueName = VENUE_CODE;
  let areas = [];
  let bgHex = '#E6A831';

  for (const row of venueData) {
    if (String(row[1]).trim() === VENUE_CODE) {
      venueName = String(row[0]).trim();
      areas = String(row[3]).split(',').map(function(a) { return a.trim(); }).filter(Boolean);
      bgHex = String(row[4]).trim() || bgHex;
      break;
    }
  }

  // Staff names for this venue
  const userSheet = refSs.getSheetByName('USERS');
  const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
  let userCol = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).trim().toUpperCase();
    if (h === VENUE_CODE || h === venueName.toUpperCase()) { userCol = i; break; }
  }

  let staffNames = [];
  if (userCol >= 0 && userSheet.getLastRow() > 1) {
    const userData = userSheet.getRange(2, userCol + 1, userSheet.getLastRow() - 1, 1).getValues();
    staffNames = userData.flat().map(function(n) { return String(n).trim(); }).filter(Boolean);
  }

  // Logo URL — read from VENUES col F (index 5) if available, else default
  let logoUrl = 'https://lh3.googleusercontent.com/d/1uPDF4O34xITZa26wgvmCGB2lKlO_QqrF';
  for (const row of venueData) {
    if (String(row[1]).trim() === VENUE_CODE && row.length > 5 && String(row[5]).trim()) {
      logoUrl = String(row[5]).trim();
      break;
    }
  }

  return {
    venueCode: VENUE_CODE,
    venueName: venueName,
    bgHex: bgHex,
    areas: areas,
    staffNames: staffNames,
    logoUrl: logoUrl,
  };
}


// ============================================================
// SUBMIT — creates job folder, writes to RAW_INTAKE
// ============================================================

function submitRequest(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('RAW_INTAKE');
  if (!rawSheet) throw new Error('RAW_INTAKE sheet not found');

  const timestamp = new Date();

  // Build folder name and create on Shared Drive
  const folderName = buildJobFolderName_(VENUE_CODE, timestamp);
  let folderUrl = '';
  let folderId = '';
  try {
    const jobFolder = createJobFolder_(VENUE_CODE, timestamp, folderName);
    folderUrl = jobFolder.getUrl();
    folderId = jobFolder.getId();
  } catch (e) {
    Logger.log('Job folder creation failed: ' + e.message + '\n' + e.stack);
  }

  // Capitalize at write time
  const titleUpper = (data.title || '').toUpperCase();
  const detailsLower = (data.details || '').toLowerCase();

  // Write row to RAW_INTAKE (cols A-J)
  rawSheet.appendRow([
    timestamp,                        // A: INTAKE_TS
    VENUE_CODE,                       // B: VENUE
    data.assetId || '',               // C: ASSET_ID
    data.requestType || 'MAINTENANCE',// D: REQUEST_TYPE
    data.area || '',                  // E: AREA
    titleUpper,                       // F: REQUEST_TITLE
    detailsLower,                     // G: REQUEST_DETAILS
    data.author || '',                // H: AUTHOR
    folderUrl,                        // I: MEDIA_LINKS (placeholder, replaced by HYPERLINK below)
    false,                            // J: DONE
  ]);

  const newRow = rawSheet.getLastRow();

  // Generate REQ_ID and write to column K
  const reqId = generateReqId_(VENUE_CODE, timestamp);
  rawSheet.getRange(newRow, 11).setValue(reqId);

  // Checkbox on DONE column
  const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  rawSheet.getRange(newRow, 10).setDataValidation(checkboxRule);

  // Hyperlink with folder name as label
  if (folderUrl) {
    rawSheet.getRange(newRow, 9).setFormula('=HYPERLINK("' + folderUrl + '","📁 ' + folderName + '")');
  }

  // Format + trim
  formatNewRow(rawSheet, newRow);
  trimEmptyRows(rawSheet);

  SpreadsheetApp.flush();
  Logger.log('Row ' + newRow + ': ' + titleUpper + ' by ' + data.author + ' | folder: ' + folderName);

  return {
    success: true,
    reqId: reqId,
    rowNum: newRow,
    folderId: folderId,
    folderUrl: folderUrl,
    folderName: folderName,
    shortUrl: folderUrl,
    timestamp: Utilities.formatDate(timestamp, TZ, 'dd/MM/yyyy HH:mm'),
    venueName: getVenueConfig().venueName,
    venueCode: VENUE_CODE,
    area: data.area || '',
    title: titleUpper,
    details: detailsLower,
    detailsThai: translateToThai_(data.details || ''),
    author: data.author || '',
    requestType: data.requestType || 'MAINTENANCE',
    assetId: data.assetId || '',
    mediaCount: data.fileCount || 0,
  };
}
