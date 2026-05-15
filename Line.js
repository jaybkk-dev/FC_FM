// ============================================================
// FC FACILITIES MANAGEMENT — LINE MESSAGING API
// Sends Flex Messages to LINE group on new submissions
// ============================================================

/**
 * Reads a LINE-related secret from Script Properties.
 * Set these once: Apps Script → Project Settings → Script Properties.
 * Required keys: LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID,
 * LINE_TEST_GROUP_ID, LINE_EXPENSE_GROUP_ID.
 * Throws on missing — never falls back silently.
 */
function getLineProp_(name) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v) {
    throw new Error(
      name + ' is not set. Open Apps Script → Project Settings → ' +
      'Script Properties and add ' + name + '.'
    );
  }
  return v;
}


/**
 * Send a Flex Message notification to the venue LINE group.
 * Called from submitRequest() after the row is written.
 * Fails silently (writes to LINE_LOG) — LINE notification should never block submission.
 */
function notifyLineGroup_(requestData) {
  var groupId;
  try {
    groupId = getLineProp_('LINE_GROUP_ID');
  } catch (e) {
    logLineFailure_(requestData, 'LINE config missing: ' + e.message);
    return;
  }

  try {
    var flex = buildFlexMessage_(requestData);
    sendLineMessage_(groupId, [flex]);
    Logger.log('LINE: notification sent for ' + requestData.reqId);
  } catch (e) {
    logLineFailure_(requestData, e.message + (e.stack ? '\n' + e.stack : ''));
  }
}


/**
 * Append a row to the LINE_LOG sheet so silent LINE failures become visible.
 * Auto-creates the sheet on first failure. Never throws.
 */
function logLineFailure_(requestData, reason) {
  Logger.log('LINE: notification failed — ' + reason);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('LINE_LOG');
    if (!sheet) {
      sheet = ss.insertSheet('LINE_LOG');
      sheet.getRange(1, 1, 1, 5).setValues([['TIMESTAMP', 'REQ_ID', 'TITLE', 'AUTHOR', 'REASON']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#E6A831').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date(),
      (requestData && requestData.reqId) || '',
      (requestData && requestData.title) || '',
      (requestData && requestData.author) || '',
      String(reason || '').substring(0, 500)
    ]);
  } catch (logErr) {
    Logger.log('LINE: logLineFailure_ itself failed — ' + logErr.message);
  }
}


/**
 * Build a LINE Flex Message for a maintenance/event request.
 * Returns a Flex Message object ready for the Messaging API.
 */
function buildFlexMessage_(data) {
  var isEvent = (data.requestType || '').toUpperCase() === 'EVENT SUPPORT';
  var icon = isEvent ? '\uD83C\uDFAA' : '\uD83D\uDD27';  // 🎪 or 🔧
  var headerColor = '#E6A831';
  var textColor = '#514D47';
  var subColor = '#8A8580';

  // Body contents
  var bodyContents = [];

  // Area
  if (data.area) {
    bodyContents.push({
      type: 'text',
      text: '\u2299 ' + data.area,
      size: 'md',
      color: textColor,
      weight: 'bold'
    });
  }

  // Title
  bodyContents.push({
    type: 'text',
    text: icon + ' ' + (data.title || 'NO TITLE'),
    size: 'xl',
    weight: 'bold',
    color: textColor,
    wrap: true
  });

  // Details (Thai if available, else English)
  var details = data.detailsThai || data.details || '';
  if (details) {
    bodyContents.push({
      type: 'text',
      text: details,
      size: 'sm',
      color: subColor,
      wrap: true
    });
  }

  // Images (if available)
  var images = data.imageUrls || [];
  if (images.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'lg' });
    // Show up to 4 images in a 2-column grid (clickable → full size)
    for (var i = 0; i < images.length && i < 4; i += 2) {
      var row = { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [] };
      row.contents.push({
        type: 'image',
        url: images[i].url,
        size: 'full',
        aspectRatio: '1:1',
        aspectMode: 'cover',
        flex: 1,
        action: { type: 'uri', uri: images[i].url }
      });
      if (i + 1 < images.length && i + 1 < 4) {
        row.contents.push({
          type: 'image',
          url: images[i + 1].url,
          size: 'full',
          aspectRatio: '1:1',
          aspectMode: 'cover',
          flex: 1,
          action: { type: 'uri', uri: images[i + 1].url }
        });
      } else {
        row.contents.push({ type: 'filler', flex: 1 });
      }
      bodyContents.push(row);
    }
    if (images.length > 4) {
      bodyContents.push({
        type: 'text',
        text: '+ ' + (images.length - 4) + ' more photo(s) in folder',
        size: 'xs',
        color: subColor,
        align: 'center',
        margin: 'sm'
      });
    }
  }

  // Non-image media indicators
  var mediaLabels = [];
  if (data.hasVideo) mediaLabels.push('\uD83C\uDFAC Video');
  if (data.hasAudio) mediaLabels.push('\uD83D\uDD0A Voice Note');
  if (data.hasPdf) mediaLabels.push('\uD83D\uDCC4 PDF');
  if (mediaLabels.length > 0) {
    if (images.length === 0) bodyContents.push({ type: 'separator', margin: 'lg' });
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      justifyContent: 'center',
      spacing: 'lg',
      contents: mediaLabels.map(function(label) {
        return { type: 'text', text: label, size: 'sm', color: '#6B5955', align: 'center', flex: 0 };
      })
    });
  }

  // Separator + metadata
  bodyContents.push({ type: 'separator', margin: 'lg' });

  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    contents: [
      { type: 'text', text: 'REQUEST BY', size: 'xs', color: subColor, flex: 4 },
      { type: 'text', text: (data.author || '').toUpperCase(), size: 'xs', color: textColor, weight: 'bold', flex: 5 }
    ]
  });

  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: 'SUBMITTED', size: 'xs', color: subColor, flex: 4 },
      { type: 'text', text: data.timestamp || '', size: 'xs', color: textColor, flex: 5 }
    ]
  });

  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: 'ID', size: 'xs', color: subColor, flex: 4 },
      { type: 'text', text: data.reqId || '', size: 'xs', color: headerColor, weight: 'bold', flex: 5 }
    ]
  });

  // Build the Flex container
  var bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerColor,
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: (data.venueName || VENUE_CODE).toUpperCase(),
          color: '#FFFFFF',
          weight: 'bold',
          size: 'lg',
          align: 'center'
        },
        {
          type: 'text',
          text: (isEvent ? 'EVENT SUPPORT' : 'MAINTENANCE') + ' JOB REQUEST',
          color: '#FFFFFF',
          size: 'sm',
          align: 'center'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'xl',
      contents: bodyContents
    }
  };

  // Add footer with folder link button if available
  if (data.folderUrl) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '\uD83D\uDCC1 Photos / Videos',
            uri: data.folderUrl
          },
          style: 'primary',
          color: headerColor,
          height: 'sm'
        }
      ]
    };
  }

  return {
    type: 'flex',
    altText: icon + ' ' + (data.title || 'New Request') + ' — ' + (data.reqId || ''),
    contents: bubble
  };
}


/**
 * Send expense approval Flex Message to the expense LINE group.
 * Includes amount, justification, images, and an APPROVE button.
 */
function sendExpenseFlexMessage_(data, imageUrls) {
  var expGroupId = getLineProp_('LINE_EXPENSE_GROUP_ID');
  if (!expGroupId) {
    Logger.log('LINE: expense group ID not configured');
    return;
  }

  // Brand palette
  var gold = '#E6A831';
  var cinnamon = '#B45D43';
  var taupe = '#6B5955';
  var olive = '#606c38';
  var dark = '#514D47';

  // English details only
  var detailsEn = data.details || '';
  if (!detailsEn && data.detailsThai) {
    try { detailsEn = translateToEnglish_(data.detailsThai); } catch (e) { detailsEn = data.detailsThai; }
  }

  var bodyContents = [];

  if (data.area) {
    bodyContents.push({ type: 'text', text: '\u2299 ' + data.area, size: 'md', color: dark, weight: 'bold' });
  }

  bodyContents.push({ type: 'text', text: '\uD83D\uDD27 ' + (data.title || 'NO TITLE'), size: 'xl', weight: 'bold', color: dark, wrap: true });

  if (detailsEn) {
    bodyContents.push({ type: 'text', text: detailsEn, size: 'sm', color: taupe, wrap: true });
  }

  bodyContents.push({ type: 'separator', margin: 'lg' });

  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'lg', contents: [
      { type: 'text', text: 'AMOUNT', size: 'md', color: taupe, weight: 'bold', flex: 4 },
      { type: 'text', text: '\u0E3F' + (data.expenseAmount || '0'), size: 'xl', color: cinnamon, weight: 'bold', flex: 5, align: 'end' }
    ]
  });

  if (data.expenseText) {
    bodyContents.push({ type: 'text', text: data.expenseText, size: 'sm', color: dark, wrap: true, margin: 'md' });
  }

  if (imageUrls && imageUrls.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'lg' });
    for (var i = 0; i < imageUrls.length && i < 4; i += 2) {
      var row = { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [] };
      row.contents.push({
        type: 'image', url: imageUrls[i].url, size: 'full', aspectRatio: '1:1', aspectMode: 'cover', flex: 1,
        action: { type: 'uri', uri: imageUrls[i].url }
      });
      if (i + 1 < imageUrls.length && i + 1 < 4) {
        row.contents.push({
          type: 'image', url: imageUrls[i + 1].url, size: 'full', aspectRatio: '1:1', aspectMode: 'cover', flex: 1,
          action: { type: 'uri', uri: imageUrls[i + 1].url }
        });
      } else {
        row.contents.push({ type: 'filler', flex: 1 });
      }
      bodyContents.push(row);
    }
  }

  bodyContents.push({ type: 'separator', margin: 'lg' });
  bodyContents.push({ type: 'box', layout: 'horizontal', margin: 'md', contents: [
    { type: 'text', text: 'REQUEST BY', size: 'xs', color: taupe, flex: 4 },
    { type: 'text', text: (data.author || '').toUpperCase(), size: 'xs', color: dark, weight: 'bold', flex: 5 }
  ]});
  bodyContents.push({ type: 'box', layout: 'horizontal', margin: 'sm', contents: [
    { type: 'text', text: 'SUBMITTED', size: 'xs', color: taupe, flex: 4 },
    { type: 'text', text: data.timestamp || '', size: 'xs', color: dark, flex: 5 }
  ]});
  bodyContents.push({ type: 'box', layout: 'horizontal', margin: 'sm', contents: [
    { type: 'text', text: 'ID', size: 'xs', color: taupe, flex: 4 },
    { type: 'text', text: data.reqId || '', size: 'xs', color: gold, weight: 'bold', flex: 5 }
  ]});

  var approveUrl = ScriptApp.getService().getUrl() + '?approve=' + encodeURIComponent(data.reqId) + '&token=' + generateApprovalToken_(data.reqId);

  var bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: gold, paddingAll: 'lg', contents: [
        { type: 'text', text: (data.venueName || VENUE_CODE).toUpperCase(), color: '#FFFFFF', weight: 'bold', size: 'lg', align: 'center' },
        { type: 'text', text: 'EXPENSE APPROVAL REQUEST', color: '#FFFFFF', size: 'sm', align: 'center' }
      ]
    },
    body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'xl', contents: bodyContents },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'lg', contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '✅ APPROVE', uri: approveUrl },
          style: 'primary',
          color: olive,
          height: 'sm'
        },
        {
          type: 'button',
          action: { type: 'uri', label: '\uD83D\uDCC2 FILES', uri: data.expenseFolderUrl || data.folderUrl || approveUrl },
          style: 'secondary',
          height: 'sm'
        }
      ]
    }
  };

  var flex = {
    type: 'flex',
    altText: 'Expense Approval: ' + (data.title || '') + ' \u0E3F' + (data.expenseAmount || '0'),
    contents: bubble
  };

  sendLineMessage_(expGroupId, [flex]);
}


/**
 * Send approval confirmation Flex to the expense group.
 */
function sendApprovalConfirmation_(data) {
  var expGroupId = getLineProp_('LINE_EXPENSE_GROUP_ID');
  if (!expGroupId) return;

  var olive = '#606c38';
  var gold = '#E6A831';
  var taupe = '#6B5955';

  var bodyContents = [
    { type: 'text', text: data.reqId || '', size: 'lg', weight: 'bold', color: gold, align: 'center' },
    { type: 'text', text: data.title || '', size: 'md', color: '#514D47', align: 'center', wrap: true },
    { type: 'text', text: '\u0E3F' + (data.amount || '0'), size: 'xl', weight: 'bold', color: olive, align: 'center', margin: 'md' }
  ];

  if (data.approver) {
    bodyContents.push({ type: 'text', text: 'Approved by ' + data.approver, size: 'sm', weight: 'bold', color: taupe, align: 'center', margin: 'md' });
  }

  bodyContents.push({ type: 'text', text: data.timestamp || '', size: 'xs', color: taupe, align: 'center', margin: 'sm' });

  var bubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: olive, paddingAll: 'lg', contents: [
        { type: 'text', text: '✅ APPROVED', color: '#FFFFFF', weight: 'bold', size: 'xl', align: 'center' }
      ]
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'xl', contents: bodyContents
    }
  };

  var flex = {
    type: 'flex',
    altText: '✅ APPROVED: ' + (data.reqId || '') + ' \u0E3F' + (data.amount || '0'),
    contents: bubble
  };

  sendLineMessage_(expGroupId, [flex]);
}


/**
 * Low-level: send messages to a LINE user/group via the Push API.
 */
function sendLineMessage_(to, messages) {
  var payload = {
    to: to,
    messages: messages
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + getLineProp_('LINE_CHANNEL_ACCESS_TOKEN')
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('LINE API ' + code + ': ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}


// ============================================================
// SETUP HELPERS
// ============================================================

/**
 * Webhook handler — add doPost to capture the GROUP ID.
 *
 * Steps to get your GROUP ID:
 * 1. In LINE Developers Console → Messaging API → Webhook URL,
 *    set it to your GAS web app URL (the /exec URL)
 * 2. Enable "Use webhook"
 * 3. Send any message in the LINE group where the bot is a member
 * 4. Check Logger / Execution log — the group ID will be logged
 * 5. Copy the group ID to LINE_GROUP_ID in Config.gs
 * 6. You can then remove the webhook URL (it's not needed for push messages)
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var events = data.events || [];
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (event.source && event.source.groupId) {
        Logger.log('LINE GROUP ID CAPTURED: ' + event.source.groupId);
        // Auto-save to script properties for easy retrieval
        PropertiesService.getScriptProperties().setProperty('LINE_GROUP_ID', event.source.groupId);
      }
      Logger.log('LINE webhook event: ' + JSON.stringify(event));
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Run this from Script Editor after sending a message in the LINE group.
 * It reads the group ID saved by the webhook.
 */
function getStoredLineGroupId() {
  var groupId = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID');
  if (groupId) {
    Logger.log('LINE_GROUP_ID: ' + groupId);
    try {
      SpreadsheetApp.getUi().alert('LINE Group ID:\n\n' + groupId + '\n\nCopy this to LINE_GROUP_ID in Config.gs');
    } catch (e) {
      // trigger context
    }
  } else {
    Logger.log('No LINE group ID stored yet. Send a message in the group first.');
  }
  return groupId;
}


/**
 * Test: send a test Flex Message to the configured group.
 * Run from Script Editor to verify the integration works.
 */
function testLineFlex() {
  var testData = {
    reqId: 'OSKB260330TEST',
    title: 'TEST — LINE INTEGRATION',
    details: 'This is a test message from the FC FM system.',
    detailsThai: 'นี่คือข้อความทดสอบจากระบบ FC FM',
    area: 'FL1 KITCHEN',
    author: 'SYSTEM TEST',
    timestamp: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'),
    venueName: 'OSKAR BISTRO',
    requestType: 'MAINTENANCE',
    folderUrl: 'https://drive.google.com/drive/folders/example',
  };

  // Test functions always use test group
  var groupId = getLineProp_('LINE_TEST_GROUP_ID');
  if (!groupId) {
    Logger.log('No LINE group ID configured.');
    return;
  }

  var flex = buildFlexMessage_(testData);
  sendLineMessage_(groupId, [flex]);
  Logger.log('Test Flex Message sent to TEST group: ' + groupId);
}


/**
 * Test Flex Message with images — sends to test group.
 * Uses a real folder ID if provided, or sample images.
 * Run from Script Editor.
 */
function testLineFlexWithImages() {
  var groupId = getLineProp_('LINE_TEST_GROUP_ID');
  if (!groupId) { Logger.log('No test group ID'); return; }

  // Read real images from the test folder
  var testFolderId = '1h_UwNcRxR0nZ0SJD71UfeA-DLt7hCudP';
  var imageUrls = [];
  try {
    var folder = DriveApp.getFolderById(testFolderId);
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var mime = file.getMimeType();
      if (mime.indexOf('image/') === 0) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var fileId = file.getId();
        imageUrls.push({
          url: 'https://lh3.googleusercontent.com/d/' + fileId,
          preview: 'https://lh3.googleusercontent.com/d/' + fileId + '=s240'
        });
      }
    }
  } catch (e) {
    Logger.log('Could not read test folder: ' + e.message);
  }

  Logger.log('Found ' + imageUrls.length + ' images in test folder');

  var testData = {
    reqId: 'OSKB260401TEST',
    title: 'TEST — FLEX WITH IMAGES',
    details: 'Testing image thumbnails in Flex Message.',
    detailsThai: 'ทดสอบรูปภาพในข้อความ Flex',
    area: 'FL1 KITCHEN',
    author: 'SYSTEM TEST',
    timestamp: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'),
    venueName: 'OSKAR BISTRO',
    requestType: 'MAINTENANCE',
    folderUrl: 'https://drive.google.com/drive/folders/' + testFolderId,
    imageUrls: imageUrls
  };

  var flex = buildFlexMessage_(testData);
  sendLineMessage_(groupId, [flex]);
  Logger.log('Test Flex with images sent to TEST group');
}


/**
 * Send installation instructions as Flex Messages to the LINE group.
 * Sends two cards: one for iPhone, one for Android.
 * Run from Script Editor.
 */
function sendInstallInstructions() {
  var groupId;
  try { groupId = getLineProp_('LINE_GROUP_ID'); }
  catch (e) { Logger.log('No LINE_GROUP_ID configured.'); return; }

  var appUrl = ScriptApp.getService().getUrl();
  var gold = '#E6A831';
  var dark = '#514D47';
  var sub = '#8A8580';

  var iphoneCard = {
    type: 'flex',
    altText: '🍎 iPhone — How to add app to home screen',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: gold,
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '🍎 iPHONE', color: '#FFFFFF', weight: 'bold', size: 'lg', align: 'center' },
          { type: 'text', text: 'Add to Home Screen', color: '#FFFFFF', size: 'sm', align: 'center' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'xl',
        contents: [
          { type: 'text', text: 'ENGLISH', size: 'xs', color: gold, weight: 'bold' },
          { type: 'text', text: '1. Open the link in Safari (not Chrome)', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '2. Tap the Share button (square with arrow, bottom of screen)', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '3. Scroll down → "Add to Home Screen"', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '4. Name it (e.g. "MAINTENANCE") → Add', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: 'Opens full-screen without Safari toolbar!', size: 'sm', color: gold, weight: 'bold', wrap: true },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: 'ภาษาไทย', size: 'xs', color: gold, weight: 'bold', margin: 'md' },
          { type: 'text', text: '1. เปิดลิงก์ใน Safari (ใช้ Safari เท่านั้น)', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '2. กดปุ่ม แชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น ด้านล่าง)', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '3. เลื่อนลง → "เพิ่มไปยังหน้าจอโฮม"', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '4. ตั้งชื่อ (เช่น "MAINTENANCE") → เพิ่ม', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: 'เปิดแบบเต็มจอโดยไม่มีแถบเครื่องมือ Safari!', size: 'sm', color: gold, weight: 'bold', wrap: true }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'Open App Link', uri: appUrl },
            style: 'primary',
            color: gold,
            height: 'sm'
          }
        ]
      }
    }
  };

  var androidCard = {
    type: 'flex',
    altText: '🤖 Android — How to add app to home screen',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#4CAF50',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '🤖 ANDROID', color: '#FFFFFF', weight: 'bold', size: 'lg', align: 'center' },
          { type: 'text', text: 'Add to Home Screen', color: '#FFFFFF', size: 'sm', align: 'center' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'xl',
        contents: [
          { type: 'text', text: 'ENGLISH', size: 'xs', color: '#4CAF50', weight: 'bold' },
          { type: 'text', text: '1. Open the link in Chrome', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '2. Tap the three dots (top right)', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '3. Tap "Add to Home screen"', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '4. Name it (e.g. "MAINTENANCE") → Add', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: 'Opens in Chrome as an app icon!', size: 'sm', color: '#4CAF50', weight: 'bold', wrap: true },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: 'ภาษาไทย', size: 'xs', color: '#4CAF50', weight: 'bold', margin: 'md' },
          { type: 'text', text: '1. เปิดลิงก์ใน Chrome', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '2. กดจุดสามจุดที่มุมขวาบน', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '3. กด "เพิ่มไปยังหน้าจอหลัก"', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: '4. ตั้งชื่อ (เช่น "MAINTENANCE") → เพิ่ม', size: 'sm', color: dark, wrap: true },
          { type: 'text', text: 'ไอคอนจะปรากฏบนหน้าจอโฮมเหมือนแอป!', size: 'sm', color: '#4CAF50', weight: 'bold', wrap: true }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'Open App Link', uri: appUrl },
            style: 'primary',
            color: '#4CAF50',
            height: 'sm'
          }
        ]
      }
    }
  };

  sendLineMessage_(groupId, [iphoneCard, androidCard]);
  Logger.log('Installation instructions sent to LINE group');
}

// ============================================================
// DIAGNOSTICS — run from Script Editor when LINE notifications go missing
// ============================================================

/**
 * Health check: verifies the bot is still a member of LINE_GROUP_ID
 * (the production OSKAR MAINTENANCE group). Sends NO message — uses the
 * /group/{id}/summary endpoint, which 200s only if the bot is in the group.
 *
 * Result is logged AND alerted (when run from the editor) so you cannot miss it.
 */
function lineHealthCheck() {
  var groupId = getLineProp_('LINE_GROUP_ID');
  var url = 'https://api.line.me/v2/bot/group/' + groupId + '/summary';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + getLineProp_('LINE_CHANNEL_ACCESS_TOKEN') },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  var msg;
  if (code === 200) {
    var info = JSON.parse(body);
    msg = 'OK — bot is in production group "' + info.groupName + '" (' + groupId + ')';
  } else {
    msg = 'FAIL — HTTP ' + code + ' on group ' + groupId + '\n' + body +
          '\n\nLikely cause: bot was removed from the OSKAR MAINTENANCE group, ' +
          'or LINE_GROUP_ID in Config.js is stale. Re-invite the FC MAINTENANCE bot ' +
          'to that group, then re-capture the group ID via the webhook.';
  }
  Logger.log('lineHealthCheck: ' + msg);
  // No alert — would hang from Script Editor. Result is in the execution log + return value.
  return msg;
}


/**
 * Replays sendLineAfterUpload for the most recent RAW_INTAKE row,
 * but routes the Flex to LINE_TEST_GROUP_ID (NOT to staff) so we can
 * verify the full pipeline end-to-end without spamming the maintenance group.
 *
 * If this succeeds → the bot is missing from the production group (run lineHealthCheck).
 * If this fails → the bug is inside sendLineAfterUpload / buildFlexMessage_ for real data.
 */
function diagnoseLastSubmission() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var raw = ss.getSheetByName('RAW_INTAKE');
  var lastRow = raw.getLastRow();
  if (lastRow < 2) { Logger.log('No RAW_INTAKE rows.'); return; }

  var row = raw.getRange(lastRow, 1, 1, 11).getValues()[0];
  var ts = row[0], venue = row[1], reqType = row[3], area = row[4],
      title = row[5], details = row[6], author = row[7], reqId = row[10];

  var requestData = {
    reqId: reqId,
    title: title,
    details: details,
    detailsThai: translateToThai_(details || ''),
    area: area,
    author: author,
    timestamp: Utilities.formatDate(ts instanceof Date ? ts : new Date(ts), TZ, 'dd/MM/yyyy HH:mm'),
    venueName: getVenueConfig().venueName,
    requestType: reqType,
    folderUrl: '',
    imageUrls: [],
    hasVideo: false, hasAudio: false, hasPdf: false
  };

  try {
    var flex = buildFlexMessage_(requestData);
    sendLineMessage_(getLineProp_('LINE_TEST_GROUP_ID'), [flex]);
    var msg = 'OK — last submission (' + reqId + ') replayed to TEST group. ' +
              'Pipeline is healthy. Production group is the issue — run lineHealthCheck.';
    Logger.log(msg);
  } catch (err) {
    var fmsg = 'FAIL — ' + err.message + '\n\nThe bug is inside buildFlexMessage_ / sendLineAfterUpload, ' +
               'not in the LINE channel itself.';
    Logger.log(fmsg);
  }
}


// pushed 1777826500 // remove blocking alerts
