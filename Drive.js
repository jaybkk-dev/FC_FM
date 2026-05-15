// ============================================================
// FC FACILITIES MANAGEMENT — DRIVE HELPERS
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// Shared Drive folder creation, naming, and file utilities.
// Used by WebApp.gs (submitRequest) and EditTrigger.gs (auto-folder).
// ============================================================


/**
 * Builds folder name: VENUE_YYMMDD_XXX using PropertiesService counter.
 * Counter resets daily per venue. No folder scanning needed.
 */
function buildJobFolderName_(venueCode, timestamp) {
  const yy = Utilities.formatDate(timestamp, TZ, 'yy');
  const mm = Utilities.formatDate(timestamp, TZ, 'MM');
  const dd = Utilities.formatDate(timestamp, TZ, 'dd');
  const dayPrefix = venueCode + '_' + yy + mm + dd + '_';
  const propKey = 'folderCount_' + dayPrefix;

  const props = PropertiesService.getScriptProperties();
  let count = parseInt(props.getProperty(propKey) || '0', 10);
  count++;
  props.setProperty(propKey, String(count));

  return dayPrefix + String(count).padStart(3, '0');
}


/**
 * Creates a job folder on Shared Drive under: ROOT / VENUE / YEAR / MONTH / FOLDER
 * Sets sharing to anyone-with-link can view.
 */
function createJobFolder_(venueCode, timestamp, jobFolderName) {
  const root = DriveApp.getFolderById(SHARED_DRIVE_ID);
  const venueFolder = getOrCreateSub_(root, venueCode);
  const year = Utilities.formatDate(timestamp, TZ, 'yyyy');
  const yearFolder = getOrCreateSub_(venueFolder, year);
  const month = Utilities.formatDate(timestamp, TZ, 'MM');
  const monthFolder = getOrCreateSub_(yearFolder, month);
  const jobFolder = monthFolder.createFolder(jobFolderName);
  jobFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return jobFolder;
}


/**
 * Gets an existing subfolder by name, or creates it.
 */
function getOrCreateSub_(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}


/**
 * Creates an expense media folder in the EXPENSE_APPROVAL Drive folder.
 * Flat structure (no year/month subfolders).
 * Naming: OSKB_260401_EXP1 (EXP + ordinal 1-9)
 * @param {string} venueCode - e.g. 'OSKB'
 * @param {Date} timestamp
 * @returns {Object} folder object
 */
function createExpenseFolder_(venueCode, timestamp) {
  var expenseRootId = '1qW6c95-El1wqOAUUbPIf_7mTTifC6Xu5';
  var root = DriveApp.getFolderById(expenseRootId);

  var yy = Utilities.formatDate(timestamp, TZ, 'yy');
  var mm = Utilities.formatDate(timestamp, TZ, 'MM');
  var dd = Utilities.formatDate(timestamp, TZ, 'dd');
  var dayPrefix = venueCode + '_' + yy + mm + dd + '_EXP';
  var propKey = 'expFolderCount_' + venueCode + '_' + yy + mm + dd;

  var props = PropertiesService.getScriptProperties();
  var count = parseInt(props.getProperty(propKey) || '0', 10);
  count++;
  props.setProperty(propKey, String(count));

  var folderName = dayPrefix + count;
  var folder = root.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}


/**
 * Uploads a single base64-encoded file to a job folder.
 * Files are named sequentially: 01.jpg, 02.mp4, etc.
 */
function uploadSingleFile(data) {
  try {
    if (!data || !data.base64) throw new Error('No file data received (base64 is empty).');
    if (!data.folderId) throw new Error('No folderId provided.');

    Logger.log('uploadSingleFile: folder=' + data.folderId + ', file=' + (data.name || '?') +
               ', mimeType=' + (data.mimeType || '?') + ', base64Len=' + data.base64.length +
               ', triggerLine=' + (data.triggerLine ? 'YES (reqId=' + (data.triggerLine.submission && data.triggerLine.submission.reqId) + ')' : 'no'));

    const folder = DriveApp.getFolderById(data.folderId);

    // Count existing files for sequential naming
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext()) { files.next(); count++; }

    const seq = String(count + 1).padStart(2, '0');
    const ext = getExtension_(data.name || 'file', data.mimeType || 'image/jpeg');
    const safeName = seq + ext;

    const decoded = Utilities.base64Decode(data.base64);
    const blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', safeName);
    folder.createFile(blob);

    Logger.log('Uploaded ' + safeName + ' to folder ' + data.folderId);

    // Server-side LINE trigger on the last file — client chains are unreliable on mobile.
    if (data.triggerLine) {
      try {
        sendLineAfterUpload(data.triggerLine.folderId, data.triggerLine.submission);
        Logger.log('sendLineAfterUpload triggered server-side for ' + data.triggerLine.folderId);
      } catch (e2) {
        Logger.log('sendLineAfterUpload (post-upload) failed: ' + e2.message);
      }
    }

    return { success: true, fileName: safeName };

  } catch (e) {
    Logger.log('uploadSingleFile ERROR: ' + e.message + '\nStack: ' + e.stack);
    // Fire LINE even if the upload itself failed — requester should still be notified.
    if (data && data.triggerLine) {
      try {
        sendLineAfterUpload(data.triggerLine.folderId, data.triggerLine.submission);
        Logger.log('sendLineAfterUpload triggered server-side despite upload failure');
      } catch (e2) {
        Logger.log('sendLineAfterUpload (on failure) failed: ' + e2.message);
      }
    }
    throw new Error('Upload failed (' + (data && data.name || 'file') + '): ' + e.message);
  }
}


/**
 * Returns file extension from filename or MIME type.
 */
function getExtension_(fileName, mimeType) {
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx > 0) return fileName.substring(dotIdx).toLowerCase();
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
  };
  return map[mimeType] || '.bin';
}
