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
  'Occupation',
  'Affiliation',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12',
  'Total Days',
  'Books Received',
  'Entered By (Profile)',
  'Entered By Email',
  'Updated At (ISO)',
  'Source Tab'
];

const COMPOUND_OCCUPATION_PATTERNS = [
  /^self[\s-]*employed$/i,
  /^pre[\s-]*school(\s+teacher)?$/i,
  /^co[\s-]*founder$/i,
  /^co[\s-]*ordinator$/i,
  /^sub[\s-]*inspector$/i,
  /^part[\s-]*time$/i,
  /^full[\s-]*time$/i,
  /^v[\s-]*secretary$/i,
  /^vice[\s-]*secretary$/i,
  /^vice[\s-]*chair(person|man)?$/i,
  /^add[\s-]*member$/i,
  /^non[\s-]*commissioned(\s+officer)?$/i
];

const INSTITUTION_PATTERNS = /\b(parliament|land\s*board|district\s*council|coucil|council|tribal(\s+admin(istration)?)?|police\s*service|ministry|department|church|school|clinic|hospital|brigade|prison|bdf|defence\s*force|university|college|association|foundation|society|centre|center|bank)\b/i;

const ROLE_PATTERNS = /^(clerk(\s+assistant(\s*\d*)?)?|groundsman|operator|driver|kgosi|police\s*officer|procurement(\s+assistant|\s+officer)?|administration\s*officer|admin\s*officer|environmental\s*officer|social\s*worker|pastor|teacher|cleaner|nurse|secretary|director|manager|officer|assistant|tutor|lecturer|soldier|inspector|warden|cook|chef|caretaker|messenger|typist|accountant|receptionist|supervisor|coordinator|counselor|counsellor|intern|volunteer|agent|security(\s+officer|\s+guard)?)$/i;

function splitOccupationAndAffiliation(rawOccupation, existingAffiliation) {
  const cleanOcc = String(rawOccupation || '').trim();
  const cleanAff = String(existingAffiliation || '').trim();

  if (!cleanOcc || /^[-–—]+$/.test(cleanOcc)) {
    return { occupation: '', affiliation: cleanAff === '—' ? '' : cleanAff };
  }

  for (let i = 0; i < COMPOUND_OCCUPATION_PATTERNS.length; i++) {
    if (COMPOUND_OCCUPATION_PATTERNS[i].test(cleanOcc)) {
      return {
        occupation: /^self[\s-]*employed$/i.test(cleanOcc) ? 'Self-Employed' : cleanOcc,
        affiliation: cleanAff
      };
    }
  }

  if (!/[-–—]/.test(cleanOcc)) {
    return { occupation: cleanOcc, affiliation: cleanAff };
  }

  let left = '';
  let right = '';
  const spacedMatch = cleanOcc.match(/^(.+?)\s+[-–—]\s*(.+)$/) || cleanOcc.match(/^(.+?)\s*[-–—]\s+(.+)$/);
  if (spacedMatch) {
    left = spacedMatch[1].trim();
    right = spacedMatch[2].trim();
  } else {
    const firstHyphenIdx = cleanOcc.search(/[-–—]/);
    left = cleanOcc.slice(0, firstHyphenIdx).trim();
    right = cleanOcc.slice(firstHyphenIdx + 1).trim();
  }

  if (!left || !right) {
    return {
      occupation: cleanOcc.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim(),
      affiliation: cleanAff
    };
  }

  const leftLooksLikeInstitution = INSTITUTION_PATTERNS.test(left) && !ROLE_PATTERNS.test(left);
  const rightLooksLikeRole = ROLE_PATTERNS.test(right) && !INSTITUTION_PATTERNS.test(right);
  const wasReversed = leftLooksLikeInstitution && rightLooksLikeRole;

  const extractedOccupation = wasReversed ? right : left;
  const extractedAffiliation = String(wasReversed ? left : right).trim().replace(/^Coucil$/i, 'Council').replace(/\bCoucil\b/gi, 'Council');

  return {
    occupation: extractedOccupation,
    affiliation: extractedAffiliation || cleanAff
  };
}

/**
 * Ensure a sheet tab exists with formatted 32-column headers
 */
function getOrCreateSheet(ss, tabName, headerColor) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  const lastRow = sheet.getLastRow();
  let needsHeaderUpdate = lastRow === 0;
  if (!needsHeaderUpdate) {
    const currentHdr = sheet.getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), HEADERS.length)).getValues()[0] || [];
    if (currentHdr[12] !== 'Occupation' || currentHdr[13] !== 'Affiliation') {
      needsHeaderUpdate = true;
    }
  }
  if (needsHeaderUpdate) {
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
 * Convert a registration JSON object into a 32-column row array
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

  const split = splitOccupationAndAffiliation(r.occupation, r.affiliation);

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
    String(split.occupation || '').trim(),
    String(split.affiliation || '').trim(),
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
 * Convert a 32-column (or legacy 30-column) sheet row back into a structured registration object
 */
function rowToRecord(row) {
  const isBoolStr = (val) => {
    const s = String(val || '').trim().toUpperCase();
    return s === 'TRUE' || s === 'FALSE';
  };
  const isLegacy30Col = isBoolStr(row[12]) && isBoolStr(row[13]) && String(row[30] || '').trim() === '';
  const dayStartIdx = isLegacy30Col ? 12 : 14;

  const attendance = [];
  for (let i = dayStartIdx; i < dayStartIdx + 12; i++) {
    const v = String(row[i] || '').trim().toUpperCase();
    attendance.push(v === 'TRUE' || v === '1' || v === 'YES' || v === '✓');
  }

  const rawOcc = isLegacy30Col ? '' : String(row[12] || '').trim();
  const rawAff = isLegacy30Col ? '' : String(row[13] || '').trim();
  const split = splitOccupationAndAffiliation(rawOcc, rawAff);

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
    occupation: split.occupation,
    affiliation: split.affiliation,
    attendance: attendance,
    books_received: String(row[dayStartIdx + 13] || '').trim().toUpperCase() === 'TRUE',
    updated_by_name: String(row[dayStartIdx + 14] || '').trim(),
    updated_by_email: String(row[dayStartIdx + 15] || '').trim(),
    updated_at: String(row[dayStartIdx + 16] || '').trim(),
    source_tab: String(row[dayStartIdx + 17] || '').trim()
  };
}

/**
 * Upsert or replace a batch of records into a specific profile's buffer tab (PROFILE_<Name>_<Range>)
 */
function upsertProfileTab(ss, tabName, records, deletedUuids, replaceTab) {
  const safeTabName = String(tabName || 'PROFILE_Default').substring(0, 95);
  const sheet = getOrCreateSheet(ss, safeTabName, '#4A154B');
  const lastRow = sheet.getLastRow();

  const deletedSet = new Set(Array.isArray(deletedUuids) ? deletedUuids.map(u => String(u || '').trim()) : []);
  for (let i = 0; i < records.length; i++) {
    if (records[i] && records[i].is_deleted && records[i].uuid) {
      deletedSet.add(String(records[i].uuid).trim());
    }
  }

  const activeRecords = records.filter(r => r && r.uuid && !r.is_deleted);

  const existingByUuid = new Map();
  let allRows = [];

  if (lastRow > 1 && !replaceTab) {
    const rawRows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rawRows.length; i++) {
      const u = String(rawRows[i][0] || '').trim();
      if (!u || deletedSet.has(u)) continue;
      const normalizedExisting = recordToRow(rowToRecord(rawRows[i]), safeTabName);
      existingByUuid.set(u, allRows.length);
      allRows.push(normalizedExisting);
    }
  } else if (lastRow > 1 && replaceTab) {
    // Even when replacing tab, preserve existing attendance bits for matching UUIDs
    const rawRows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rawRows.length; i++) {
      const u = String(rawRows[i][0] || '').trim();
      if (u && !deletedSet.has(u)) {
        existingByUuid.set(u, rawRows[i]);
      }
    }
  }

  let inserted = 0;
  let updated = 0;

  for (let rIdx = 0; rIdx < activeRecords.length; rIdx++) {
    const rec = activeRecords[rIdx];
    const newRow = recordToRow(rec, safeTabName);

    if (replaceTab) {
      const oldRow = existingByUuid.get(rec.uuid);
      if (oldRow) {
        const oldRec = rowToRecord(oldRow);
        if (!newRow[12] && oldRec.occupation) newRow[12] = oldRec.occupation;
        if (!newRow[13] && oldRec.affiliation) newRow[13] = oldRec.affiliation;
        let totalDays = 0;
        for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
          const colIdx = 14 + dayIdx;
          const oldPresent = Boolean(oldRec.attendance && oldRec.attendance[dayIdx]);
          const newPresent = String(newRow[colIdx] || '').toUpperCase() === 'TRUE';
          const merged = oldPresent || newPresent;
          if (rec.last_attendance_mark && rec.last_attendance_mark.day_index === dayIdx && rec.last_attendance_mark.value === false) {
            newRow[colIdx] = 'FALSE';
          } else {
            newRow[colIdx] = merged ? 'TRUE' : 'FALSE';
          }
          if (newRow[colIdx] === 'TRUE') totalDays++;
        }
        newRow[26] = totalDays;
        updated++;
      } else {
        inserted++;
      }
      allRows.push(newRow);
    } else if (existingByUuid.has(rec.uuid)) {
      const idx = existingByUuid.get(rec.uuid);
      const oldRow = allRows[idx];
      const oldRec = rowToRecord(oldRow);
      if (!newRow[12] && oldRec.occupation) newRow[12] = oldRec.occupation;
      if (!newRow[13] && oldRec.affiliation) newRow[13] = oldRec.affiliation;
      // Merge attendance non-destructively across days D1..D12 (columns 14..25)
      let totalDays = 0;
      for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
        const colIdx = 14 + dayIdx;
        const oldPresent = Boolean(oldRec.attendance && oldRec.attendance[dayIdx]);
        const newPresent = String(newRow[colIdx] || '').toUpperCase() === 'TRUE';
        const merged = oldPresent || newPresent;
        // Honor explicit single-day uncheck if last_attendance_mark specifies value === false
        if (rec.last_attendance_mark && rec.last_attendance_mark.day_index === dayIdx && rec.last_attendance_mark.value === false) {
          newRow[colIdx] = 'FALSE';
        } else {
          newRow[colIdx] = merged ? 'TRUE' : 'FALSE';
        }
        if (newRow[colIdx] === 'TRUE') totalDays++;
      }
      newRow[26] = totalDays;
      allRows[idx] = newRow;
      updated++;
    } else {
      existingByUuid.set(rec.uuid, allRows.length);
      allRows.push(newRow);
      inserted++;
    }
  }

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
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
        if (!existing.occupation && rec.occupation) existing.occupation = rec.occupation;
        if (!existing.affiliation && rec.affiliation) existing.affiliation = rec.affiliation;
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
      const deletedUuids = Array.isArray(payload.deletedUuids) ? payload.deletedUuids : [];
      const replaceTab = Boolean(payload.replaceTab);
      const upsertRes = upsertProfileTab(ss, tabName, records, deletedUuids, replaceTab);
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
