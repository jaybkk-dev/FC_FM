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
  // Handle approval links: /exec?approve=REQID&token=HASH
  if (e && e.parameter && e.parameter.approve) {
    return handleApproval_(e);
  }

  // Normal web app
  const config = getVenueConfig();
  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle(config.venueName + ' — Facilities')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * Handle expense approval from a URL click.
 * Marks APPROVED=TRUE in EXPENSE_APPROVAL sheet, sends confirmation to LINE expense group.
 */
function handleApproval_(e) {
  var reqId = e.parameter.approve;
  var token = e.parameter.token || '';
  // Verify token
  var expectedToken = generateApprovalToken_(reqId);
  if (token !== expectedToken) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:Prompt,sans-serif;text-align:center;padding:60px 20px;">' +
      '<h2 style="color:#C0392B;">Invalid approval link</h2>' +
      '<p>This link is not valid or has expired.</p></body></html>'
    ).setTitle('Invalid Link');
  }

  // Find the row in EXPENSE_APPROVAL
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EXPENSE_APPROVAL');
  if (!sheet) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:Prompt,sans-serif;text-align:center;padding:60px 20px;">' +
      '<h2 style="color:#C0392B;">Sheet not found</h2>' +
      '<p>EXPENSE_APPROVAL sheet does not exist.</p></body></html>'
    ).setTitle('Error');
  }

  var data = sheet.getDataRange().getValues();
  var approvedRow = -1;
  var rowData = null;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim() === reqId) {
      if (String(data[r][11]).toUpperCase() === 'TRUE' || data[r][11] === true) {
        // Already approved
        return HtmlService.createHtmlOutput(
          '<html><body style="font-family:Prompt,sans-serif;text-align:center;padding:60px 20px;">' +
          '<div style="font-size:48px;margin-bottom:16px;">✅</div>' +
          '<h2 style="color:#E6A831;">Already Approved</h2>' +
          '<p><strong>' + reqId + '</strong> was already approved.</p></body></html>'
        ).setTitle('Already Approved');
      }
      approvedRow = r + 1; // 1-based for sheet
      rowData = data[r];
      break;
    }
  }

  if (approvedRow < 0) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:Prompt,sans-serif;text-align:center;padding:60px 20px;">' +
      '<h2 style="color:#C0392B;">Request not found</h2>' +
      '<p>No expense approval request found for ' + reqId + '</p></body></html>'
    ).setTitle('Not Found');
  }

  // Check if this is the confirmation step (with approver name)
  var approver = e.parameter.approver || '';

  if (!approver) {
    // Step 1: show confirmation page with name input
    return HtmlService.createHtmlOutput(
      '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet"></head>' +
      '<body style="font-family:Prompt,sans-serif;text-align:center;padding:40px 20px;background:#E6A831;min-height:100vh;">' +
      '<div style="background:#fff;border-radius:20px;padding:28px;max-width:400px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.1);">' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:4px;">EXPENSE APPROVAL</div>' +
      '<div style="font-size:32px;font-weight:700;color:#E6A831;margin:12px 0;">' + reqId + '</div>' +
      '<div style="font-size:16px;color:#514D47;margin-bottom:4px;">' + String(rowData[6] || '') + '</div>' +
      '<div style="font-size:14px;color:#6B5955;margin-bottom:16px;">' + String(rowData[3] || '') + '</div>' +
      '<div style="font-size:28px;font-weight:700;color:#B45D43;margin:16px 0;">\u0E3F' + (rowData[10] || '0') + '</div>' +
      '<hr style="border:1px solid #E6A831;margin:20px 0;">' +
      '<div style="font-size:14px;color:#6B5955;margin-bottom:8px;">YOUR NAME</div>' +
      '<input id="approverName" type="text" placeholder="Type your name" style="width:100%;padding:12px;font-size:16px;border:2px solid #E6A831;border-radius:12px;text-align:center;font-family:Prompt;text-transform:uppercase;box-sizing:border-box;">' +
      '<button onclick="doApprove()" style="margin-top:16px;width:100%;padding:14px;background:#606c38;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:Prompt;">✅ CONFIRM APPROVAL</button>' +
      '</div>' +
      '<script>' +
      'function doApprove(){' +
      '  var name=document.getElementById("approverName").value.trim().toUpperCase();' +
      '  if(!name){alert("Please enter your name");return;}' +
      '  window.location.href="' + ScriptApp.getService().getUrl() + '?approve=' + encodeURIComponent(reqId) + '&token=' + token + '&approver="+encodeURIComponent(name);' +
      '}' +
      '</script></body></html>'
    ).setTitle('Approve Expense');
  }

  // Step 2: process approval
  sheet.getRange(approvedRow, 12).setValue(true); // Column L: APPROVED
  var checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(approvedRow, 12).setDataValidation(checkboxRule);
  SpreadsheetApp.flush();

  // Send confirmation Flex to expense group
  try {
    var approvalData = {
      reqId: reqId,
      area: String(rowData[3] || ''),
      title: String(rowData[6] || ''),
      amount: String(rowData[10] || ''),
      approver: approver,
      timestamp: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'),
    };
    sendApprovalConfirmation_(approvalData);
  } catch (e) {
    Logger.log('Approval LINE notification failed: ' + e.message);
  }

  // Return success page
  return HtmlService.createHtmlOutput(
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet"></head>' +
    '<body style="font-family:Prompt,sans-serif;text-align:center;padding:40px 20px;background:#E6A831;min-height:100vh;">' +
    '<div style="background:#fff;border-radius:20px;padding:28px;max-width:400px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.1);">' +
    '<div style="font-size:64px;margin-bottom:12px;">✅</div>' +
    '<h2 style="color:#606c38;margin:0;">Approved</h2>' +
    '<p style="font-size:22px;font-weight:700;color:#E6A831;margin:12px 0;">' + reqId + '</p>' +
    '<p style="color:#6B5955;">\u0E3F' + (rowData[10] || '0') + '</p>' +
    '<p style="color:#6B5955;font-size:13px;margin-top:16px;">Approved by <strong>' + approver + '</strong></p>' +
    '<p style="color:#999;margin-top:24px;font-size:13px;">You can close this page.</p>' +
    '</div></body></html>'
  ).setTitle('Approved');
}


/**
 * Generate a secure token for approval links.
 * Simple HMAC-like hash using reqId + secret.
 */
function generateApprovalToken_(reqId) {
  var secret = OPENAI_API_KEY.substring(0, 16); // use first 16 chars of API key as secret
  var raw = reqId + ':' + secret;
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return hash.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('').substring(0, 16);
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

  // Staff names for this venue (with SENIOR/REGULAR distinction)
  const userSheet = refSs.getSheetByName('USERS');
  const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
  let userCol = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).trim().toUpperCase();
    if (h === VENUE_CODE || h === venueName.toUpperCase()) { userCol = i; break; }
  }

  let staffNames = [];
  let seniorUsers = [];
  let adminUsers = [];
  if (userCol >= 0 && userSheet.getLastRow() > 1) {
    const allData = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, userCol + 1).getValues();
    for (var r = 0; r < allData.length; r++) {
      var role = String(allData[r][0]).trim().toUpperCase();
      var name = String(allData[r][userCol]).trim();
      if (name) {
        staffNames.push(name);
        if (role === 'SENIOR' || role === 'ADMIN') seniorUsers.push(name);
        if (role === 'ADMIN') adminUsers.push(name);
      }
    }
    staffNames.sort();
    seniorUsers.sort();
    adminUsers.sort();
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
    seniorUsers: seniorUsers,
    adminUsers: adminUsers,
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

  // Expense approval data (cols L, M, N) — only for approval requests
  var hasExpense = !!(data.expenseText || data.expenseAmount);
  var expenseFolderId = '';
  var expenseFolderUrl = '';
  var expenseFolderName = '';
  if (hasExpense) {
    rawSheet.getRange(newRow, 12).setValue(data.expenseText || '');   // L: EXPENSE_DETAILS
    rawSheet.getRange(newRow, 14).setValue(data.expenseAmount || ''); // N: TOTAL_AMOUNT

    // Create expense media folder
    try {
      var expFolder = createExpenseFolder_(VENUE_CODE, timestamp);
      expenseFolderId = expFolder.getId();
      expenseFolderUrl = expFolder.getUrl();
      expenseFolderName = expFolder.getName();
      // M: APPROVAL_MEDIA — HYPERLINK to expense folder
      rawSheet.getRange(newRow, 13).setFormula('=HYPERLINK("' + expenseFolderUrl + '","📁 ' + expenseFolderName + '")');
    } catch (e) {
      Logger.log('Expense folder creation failed: ' + e.message);
    }
  }

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

  var formattedTs = Utilities.formatDate(timestamp, TZ, 'dd/MM/yyyy HH:mm');

  var result = {
    success: true,
    reqId: reqId,
    rowNum: newRow,
    folderId: folderId,
    folderUrl: folderUrl,
    folderName: folderName,
    timestamp: formattedTs,
    venueCode: VENUE_CODE,
    area: data.area || '',
    title: titleUpper,
    details: detailsLower,
    author: data.author || '',
    requestType: data.requestType || 'MAINTENANCE',
    assetId: data.assetId || '',
    mediaCount: data.fileCount || 0,
    hasExpense: hasExpense,
    expenseText: data.expenseText || '',
    expenseAmount: data.expenseAmount || '',
    expenseFolderId: expenseFolderId,
    expenseFolderUrl: expenseFolderUrl,
    expenseFolderName: expenseFolderName,
  };

  return result;
}


// ============================================================
// LINE NOTIFICATION — called after file uploads complete
// ============================================================

/**
 * Send LINE Flex Message with image thumbnails from the job folder.
 * Called from client after all uploads finish (or immediately if no files).
 * @param {string} folderId - Drive folder ID containing uploaded files
 * @param {Object} requestData - submission result from submitRequest()
 */
function sendLineAfterUpload(folderId, requestData) {
  // Dedup: server-side trigger (from uploadSingleFile) and client-side fallback both call this.
  // Cache the reqId for 5 minutes — second call within window short-circuits.
  try {
    var cache = CacheService.getScriptCache();
    var key = 'lineSent_' + (requestData && requestData.reqId);
    if (requestData && requestData.reqId && cache.get(key)) {
      Logger.log('LINE: dedup — already sent for ' + requestData.reqId);
      return;
    }
    if (requestData && requestData.reqId) cache.put(key, '1', 300);
  } catch (cacheErr) {
    Logger.log('LINE dedup cache failed (continuing): ' + cacheErr.message);
  }

  // Translate details
  requestData.detailsThai = translateToThai_(requestData.details || '');
  requestData.venueName = getVenueConfig().venueName;

  // Get media from the Drive folder
  var imageUrls = [];
  var hasVideo = false;
  var hasAudio = false;
  var hasPdf = false;
  if (folderId) {
    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType();
        if (mime.indexOf('image/') === 0) {
          var fileId = file.getId();
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          imageUrls.push({
            url: 'https://lh3.googleusercontent.com/d/' + fileId,
            preview: 'https://lh3.googleusercontent.com/d/' + fileId + '=s240'
          });
        } else if (mime.indexOf('video/') === 0) {
          hasVideo = true;
        } else if (mime.indexOf('audio/') === 0) {
          hasAudio = true;
        } else if (mime === 'application/pdf') {
          hasPdf = true;
        }
      }
    } catch (e) {
      Logger.log('Failed to read media from folder: ' + e.message);
    }
  }

  requestData.imageUrls = imageUrls;
  requestData.hasVideo = hasVideo;
  requestData.hasAudio = hasAudio;
  requestData.hasPdf = hasPdf;

  // Always send maintenance card to maintenance group
  notifyLineGroup_(requestData);
  Logger.log('LINE notification sent with ' + imageUrls.length + ' image(s)');

  // If expense request → also send expense card to expense group + write to sheet
  if (requestData.hasExpense) {
    try {
      writeExpenseApproval_(requestData);
      sendExpenseFlexMessage_(requestData, imageUrls);
      Logger.log('Expense approval Flex sent for ' + requestData.reqId);
    } catch (e) {
      Logger.log('Expense processing failed: ' + e.message);
    }
  }
}


/**
 * Write a row to the EXPENSE_APPROVAL sheet.
 */
function writeExpenseApproval_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EXPENSE_APPROVAL');
  if (!sheet) {
    Logger.log('EXPENSE_APPROVAL sheet not found — skipping');
    return;
  }

  sheet.appendRow([
    data.reqId || '',                    // A: REQ_ID
    data.timestamp || '',                // B: TIMESTAMP
    data.venueCode || VENUE_CODE,        // C: VENUE
    data.area || '',                     // D: AREA
    data.assetId || '',                  // E: ASSET_ID
    data.requestType || 'MAINTENANCE',   // F: REQUEST_TYPE
    data.title || '',                    // G: REQUEST_TITLE
    data.details || '',                  // H: REQUEST_DETAILS_EN
    data.expenseText || '',              // I: EXPENSE_DETAILS
    data.expenseFolderUrl || '',         // J: APPROVAL_MEDIA
    data.expenseAmount || '',            // K: TOTAL_AMOUNT
    false                                // L: APPROVED
  ]);

  // Checkbox on APPROVED column (L = col 12)
  var newRow = sheet.getLastRow();
  var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(newRow, 12).setDataValidation(cbRule);

  // HYPERLINK for expense media folder
  if (data.expenseFolderUrl) {
    sheet.getRange(newRow, 10).setFormula('=HYPERLINK("' + data.expenseFolderUrl + '","📁 ' + (data.expenseFolderName || 'Expense') + '")');
  }

  SpreadsheetApp.flush();
}


// ============================================================
// USER MANAGEMENT — add/remove staff from USERS tab
// ============================================================

/**
 * Find the venue's column index in the USERS sheet.
 * Checks both VENUE_CODE and venue name.
 */
function findVenueUserCol_(userSheet) {
  var headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
  var venueNameUpper = getVenueConfig().venueName.toUpperCase();
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim().toUpperCase();
    if (h === VENUE_CODE || h === venueNameUpper) return i;
  }
  return -1;
}


/**
 * Add a user to the venue's column in the USERS sheet.
 * Always adds as REGULAR.
 * @param {string} name - The name to add
 * @returns {Object} Updated venue config
 */
function addUser(name) {
  name = String(name).trim().toUpperCase();
  if (!name) throw new Error('Name is required');

  var refSs = SpreadsheetApp.openById(REFERENCE_ID);
  var userSheet = refSs.getSheetByName('USERS');

  var userCol = findVenueUserCol_(userSheet);
  if (userCol < 0) throw new Error('Venue column not found in USERS sheet');

  // Read all data
  var lastRow = userSheet.getLastRow();
  var allData = userSheet.getRange(2, 1, lastRow - 1, userCol + 1).getValues();

  // Check if name already exists for this venue
  for (var r = 0; r < allData.length; r++) {
    if (String(allData[r][userCol]).trim().toUpperCase() === name.toUpperCase()) {
      throw new Error(name + ' already exists');
    }
  }

  // Find the first empty row in the REGULAR section
  var targetRow = -1;
  for (var r = 0; r < allData.length; r++) {
    var rowRole = String(allData[r][0]).trim().toUpperCase();
    if (rowRole === 'REGULAR' && !String(allData[r][userCol]).trim()) {
      targetRow = r + 2; // +2 for header offset
      break;
    }
  }

  if (targetRow < 0) throw new Error('No empty slot available. Add more rows to the USERS sheet.');

  userSheet.getRange(targetRow, userCol + 1).setValue(name);
  SpreadsheetApp.flush();
  Logger.log('User added: ' + name + ' (REGULAR) at row ' + targetRow);

  return getVenueConfig();
}


/**
 * Remove a user from the venue's column in the USERS sheet.
 * @param {string} name - The name to remove
 * @returns {Object} Updated staffNames and seniorUsers arrays
 */
function removeUser(name) {
  name = String(name).trim();
  if (!name) throw new Error('Name is required');

  var refSs = SpreadsheetApp.openById(REFERENCE_ID);
  var userSheet = refSs.getSheetByName('USERS');

  var userCol = findVenueUserCol_(userSheet);
  if (userCol < 0) throw new Error('Venue column not found in USERS sheet');

  // Find and clear the name
  var lastRow = userSheet.getLastRow();
  var allData = userSheet.getRange(2, 1, lastRow - 1, userCol + 1).getValues();
  var found = false;

  for (var r = 0; r < allData.length; r++) {
    if (String(allData[r][userCol]).trim().toUpperCase() === name.toUpperCase()) {
      userSheet.getRange(r + 2, userCol + 1).clearContent();
      found = true;
      break;
    }
  }

  if (!found) throw new Error(name + ' not found');

  SpreadsheetApp.flush();
  Logger.log('User removed: ' + name);

  return getVenueConfig();
}
// clasp-sync 1775090634
// sync 1775590367
