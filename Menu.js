// ============================================================
// FC FACILITIES MANAGEMENT — MENU
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// Single onOpen() — lean operations menu only.
// Setup commands are in Setup.gs (run from Script Editor).
// ============================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ FC FM')
    .addItem('📥 Import New Requests',        'importFromAllSources')
    .addItem('📦 Archive Completed Jobs',      'archiveCompleted')
    .addSeparator()
    .addItem('➕ Quick Add Contractor',         'showQuickAddContractor')
    .addItem('🔄 Refresh ASSIGNED_TO Dropdowns','refreshAllDropdowns')
    .addSeparator()
    .addItem('⏱️ Enable Auto Import (5 min)',  'enableAutoImport')
    .addItem('⏹️ Disable Auto Import',          'disableAutoImport')
    .addToUi();
}
