/**
 * ============================================================================
 * HFF CAMPAIGN DASHBOARD — PER-PROFILE GOOGLE SHEETS BUFFER & RECONCILIATION
 * ============================================================================
 *
 * HOW TO DEPLOY (Takes 60 seconds):
 * 1. Open your Google Sheet -> Extensions -> Apps Script
 * 2. Paste this entire file into Code.gs and click Save (Ctrl+S)
 * 3. Click "Deploy" -> "New deployment"
 * 4. Select type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Click "Deploy", copy the Web App URL (https://script.google.com/macros/s/.../exec),
 *    and paste it into the HFF Dashboard (or set VITE_GOOGLE_SHEETS_WEBAPP_URL in Vercel).
 */

const MASTER_TAB_NAME = 'MASTER_UNIFORM_REGISTER';
const AUDIT_TAB_NAME = 'RECONCILIATION_AUDIT';

const HEADERS = [
  'UUID',
  'Campaign ID',
  'Record Type',
  'Form #',
  'Group Form #',
  'Facilitator UUID',
  'First Name',
  'Last Name',
  'Gender',
  'Age',
  'Phone / Contact',
  'Location / Zone',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12',
  'Total Days',
  'Books Received',
  'Entered By (Profile)',
  'Entered By Email',
  'Updated At (ISO)',
  'Source Tab'
];

/**
 * Ensure a sheet tab exists with formatted headers
 */
function getOrCreateSheet(ss, tabName, headerColor) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground(headerColor || '#71167F');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Convert a registration JSON object into a 30-column row array
 */
function recordToRow(r, sourceTabName) {
  const att = Array.isArray(r.attendance) ? r.attendance : [];
  const days = [];
  let totalDays = 0;
  for (let i = 0; i < 12; i++) {
    const present = Boolean(att[i]);
    days.push(present ? 'TRUE' : 'FALSE');
    if (present) totalDays++;
  }

  return [
    String(r.uuid || ''),
    String(r.campaign_id || 'hff_campaign_2026'),
    String(r.type || 'participant'),
    String(r.form_number || ''),
    String(r.group_form_number || r.form_number || ''),
    String(r.facilitator_uuid || ''),
    String(r.first_name || '').trim(),
    String(r.last_name || '').trim(),
    String(r.gender || 'F'),
    r.age !== undefined && r.age !== null ? String(r.age) : '',
    String(r.contact || ''),
    String(r.place || ''),
    ...days,
    totalDays,
    r.books_received ? 'TRUE' : 'FALSE',
    String(r.updated_by_name || r.created_by_name || ''),
    String(r.updated_by_email || r.created_by_email || ''),
    String(r.updated_at || r.created_at || new Date().toISOString()),
    String(sourceTabName || '')
  ];
}

/**
 * Convert a 30-column sheet row back into a structured registration object
 */
function rowToRecord(row) {
  const attendance = [];
  for (let i = 12; i < 24; i++) {
    const v = String(row[i] || '').trim().toUpperCase();
    attendance.push(v === 'TRUE' || v === '1' || v === 'YES' || v === '✓');
  }
  return {
    uuid: String(row[0] || '').trim(),
    campaign_id: String(row[1] || 'hff_campaign_2026').trim(),
    type: String(row[2] || 'participant').trim().toLowerCase(),
    form_number: String(row[3] || '').trim(),
    group_form_number: String(row[4] || '').trim(),
    facilitator_uuid: String(row[5] || '').trim(),
    first_name: String(row[6] || '').trim(),
    last_name: String(row[7] || '').trim(),
    gender: String(row[8] || 'F').trim(),
    age: row[9] !== '' && row[9] !== null ? Number(row[9]) || String(row[9]) : null,
    contact: String(row[10] || '').trim(),
    place: String(row[11] || '').trim(),
    attendance: attendance,
    books_received: String(row[25] || '').trim().toUpperCase() === 'TRUE',
    updated_by_name: String(row[26] || '').trim(),
    updated_by_email: String(row[27] || '').trim(),
    updated_at: String(row[28] || '').trim(),
    source_tab: String(row[29] || '').trim()
  };
}

/**
 * Upsert a batch of records into a specific profile's buffer tab (PROFILE_<Name>_<Range>)
 */
function upsertProfileTab(ss, tabName, records) {
  const safeTabName = String(tabName || 'PROFILE_Default').substring(0, 95);
  const sheet = getOrCreateSheet(ss, safeTabName, '#4A154B');
  const lastRow = sheet.getLastRow();

  const existingByUuid = new Map();
  let allRows = [];

  if (lastRow > 1) {
    allRows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < allRows.length; i++) {
      const u = String(allRows[i][0] || '').trim();
      if (u) existingByUuid.set(u, i);
    }
  }

  let inserted = 0;
  let updated = 0;

  for (let rIdx = 0; rIdx < records.length; rIdx++) {
    const rec = records[rIdx];
    if (!rec || !rec.uuid) continue;
    const newRow = recordToRow(rec, safeTabName);

    if (existingByUuid.has(rec.uuid)) {
      const idx = existingByUuid.get(rec.uuid);
      const oldRow = allRows[idx];
      // Merge attendance non-destructively across days D1..D12 (columns 12..23)
      let totalDays = 0;
      for (let d = 12; d < 24; d++) {
        const oldPresent = String(oldRow[d] || '').toUpperCase() === 'TRUE';
        const newPresent = String(newRow[d] || '').toUpperCase() === 'TRUE';
        const merged = oldPresent || newPresent;
        // Honor explicit single-day uncheck if last_attendance_mark specifies value === false
        if (rec.last_attendance_mark && rec.last_attendance_mark.day_index === (d - 12) && rec.last_attendance_mark.value === false) {
          newRow[d] = 'FALSE';
        } else {
          newRow[d] = merged ? 'TRUE' : 'FALSE';
        }
        if (newRow[d] === 'TRUE') totalDays++;
      }
      newRow[24] = totalDays;
      allRows[idx] = newRow;
      updated++;
    } else {
      existingByUuid.set(rec.uuid, allRows.length);
      allRows.push(newRow);
      inserted++;
    }
  }

  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, HEADERS.length).setValues(allRows);
  }

  return {
    tabName: safeTabName,
    inserted: inserted,
    updated: updated,
    totalInTab: allRows.length
  };
}

/**
 * Reconcile all PROFILE_* tabs into MASTER_UNIFORM_REGISTER
 */
function reconcileAllProfileTabs(ss) {
  const sheets = ss.getSheets();
  const profileSheets = sheets.filter(s => s.getName().indexOf('PROFILE_') === 0);

  const cleanStr = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanForm = (f) => String(f || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^0+(?=\d)/, '');

  const masterByUuid = new Map();
  const facByFormKey = new Map();
  const personByGroupNameKey = new Map();

  let totalRawRows = 0;
  let duplicatesMerged = 0;
  const perTabStats = [];

  for (let sIdx = 0; sIdx < profileSheets.length; sIdx++) {
    const pSheet = profileSheets[sIdx];
    const pName = pSheet.getName();
    const lastRow = pSheet.getLastRow();
    if (lastRow <= 1) {
      perTabStats.push({ tabName: pName, rowCount: 0 });
      continue;
    }

    const rows = pSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    perTabStats.push({ tabName: pName, rowCount: rows.length });

    for (let r = 0; r < rows.length; r++) {
      const rec = rowToRecord(rows[r]);
      if (!rec.uuid && !rec.first_name && !rec.last_name) continue;
      totalRawRows++;

      const camp = rec.campaign_id || 'hff_campaign_2026';
      const type = rec.type || 'participant';
      const cf = cleanForm(rec.form_number);
      const gf = cleanForm(rec.group_form_number || (type === 'participant' ? rec.form_number : ''));
      const fn = cleanStr(rec.first_name);
      const ln = cleanStr(rec.last_name);

      let existing = masterByUuid.get(rec.uuid);

      if (!existing && type === 'facilitator' && cf) {
        const candidate = facByFormKey.get(camp + '|facilitator|' + cf);
        if (candidate && ((!fn && !ln) || (cleanStr(candidate.first_name) === fn && cleanStr(candidate.last_name) === ln))) {
          existing = candidate;
        }
      }

      if (!existing && fn && ln) {
        const groupScope = type === 'facilitator' ? (cf || 'noform') : (gf || cleanStr(rec.facilitator_uuid) || 'ungrouped');
        const nameKey = camp + '|' + type + '|' + groupScope + '|' + fn + '|' + ln;
        existing = personByGroupNameKey.get(nameKey);
      }

      if (!existing) {
        masterByUuid.set(rec.uuid, rec);
        if (type === 'facilitator' && cf) {
          facByFormKey.set(camp + '|facilitator|' + cf, rec);
        }
        if (fn && ln) {
          const groupScope = type === 'facilitator' ? (cf || 'noform') : (gf || cleanStr(rec.facilitator_uuid) || 'ungrouped');
          personByGroupNameKey.set(camp + '|' + type + '|' + groupScope + '|' + fn + '|' + ln, rec);
        }
      } else {
        duplicatesMerged++;
        // Merge non-empty fields & union 12-day attendance
        for (let d = 0; d < 12; d++) {
          existing.attendance[d] = Boolean(existing.attendance[d] || rec.attendance[d]);
        }
        existing.books_received = Boolean(existing.books_received || rec.books_received);
        if (!existing.contact && rec.contact) existing.contact = rec.contact;
        if (!existing.place && rec.place) existing.place = rec.place;
        if (!existing.age && rec.age) existing.age = rec.age;
        if (!existing.facilitator_uuid && rec.facilitator_uuid) existing.facilitator_uuid = rec.facilitator_uuid;
        if (!existing.group_form_number && rec.group_form_number) existing.group_form_number = rec.group_form_number;
        if (rec.updated_at > existing.updated_at) {
          existing.updated_at = rec.updated_at;
          existing.updated_by_name = rec.updated_by_name || existing.updated_by_name;
          existing.updated_by_email = rec.updated_by_email || existing.updated_by_email;
        }
        if (existing.source_tab.indexOf(pName) === -1) {
          existing.source_tab = existing.source_tab + ' + ' + pName;
        }
      }
    }
  }

  const unifiedRecords = Array.from(masterByUuid.values());
  // Sort facilitators first by form #, then participants by group form # and name
  unifiedRecords.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'facilitator' ? -1 : 1;
    const fa = parseInt(a.type === 'facilitator' ? a.form_number : a.group_form_number, 10) || 99999;
    const fb = parseInt(b.type === 'facilitator' ? b.form_number : b.group_form_number, 10) || 99999;
    if (fa !== fb) return fa - fb;
    return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name);
  });

  const masterSheet = getOrCreateSheet(ss, MASTER_TAB_NAME, '#1E3A8A');
  if (masterSheet.getLastRow() > 1) {
    masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, HEADERS.length).clearContent();
  }
  if (unifiedRecords.length > 0) {
    const outRows = unifiedRecords.map(r => recordToRow(r, r.source_tab));
    masterSheet.getRange(2, 1, outRows.length, HEADERS.length).setValues(outRows);
  }

  return {
    ok: true,
    reconciledAt: new Date().toISOString(),
    profileTabsScanned: profileSheets.length,
    perTabStats: perTabStats,
    totalRawRows: totalRawRows,
    duplicatesMerged: duplicatesMerged,
    uniformMasterTotal: unifiedRecords.length,
    facilitatorsCount: unifiedRecords.filter(r => r.type === 'facilitator').length,
    participantsCount: unifiedRecords.filter(r => r.type !== 'facilitator').length,
    records: unifiedRecords
  };
}

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(25000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) || 'status';

    if (action === 'reconcile') {
      const res = reconcileAllProfileTabs(ss);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    const sheets = ss.getSheets();
    const profileTabs = sheets
      .filter(s => s.getName().indexOf('PROFILE_') === 0)
      .map(s => ({ tabName: s.getName(), rowCount: Math.max(0, s.getLastRow() - 1) }));
    const masterSheet = ss.getSheetByName(MASTER_TAB_NAME);
    const masterCount = masterSheet ? Math.max(0, masterSheet.getLastRow() - 1) : 0;

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      spreadsheetTitle: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      masterCount: masterCount,
      profileTabs: profileTabs
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: String(err && err.message ? err.message : err)
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(28000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action || 'push_profile_buffer';

    if (action === 'push_profile_buffer') {
      const tabName = payload.tabName || 'PROFILE_Admin_Default';
      const records = Array.isArray(payload.records) ? payload.records : [];
      const upsertRes = upsertProfileTab(ss, tabName, records);
      let reconcileRes = null;
      if (payload.autoReconcile) {
        reconcileRes = reconcileAllProfileTabs(ss);
      }
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        upsert: upsertRes,
        reconcile: reconcileRes ? {
          uniformMasterTotal: reconcileRes.uniformMasterTotal,
          duplicatesMerged: reconcileRes.duplicatesMerged
        } : null
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'reconcile') {
      const res = reconcileAllProfileTabs(ss);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: String(err && err.message ? err.message : err)
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
