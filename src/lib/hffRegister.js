function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeGender(value) {
  const g = normalizeString(value).toUpperCase();
  // Support standard codes (1=M, 2=F) and Setswana (Monna=M, Mosadi=F)
  if (g === "M" || g === "MALE" || g === "1" || g === "MONNA") return "M";
  if (g === "F" || g === "FEMALE" || g === "2" || g === "MOSADI") return "F";
  return "Unknown";
}

function looksLikeNoCell(cell) {
  const s = normalizeString(cell).toUpperCase();
  return s === "NO." || s === "NO" || s === "NO:";
}

export function detectHffHeaderRowIndex(rows, { maxScanRows = 40 } = {}) {
  const limit = Math.min(rows.length, maxScanRows);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    // Common case: first cell is "No."
    if (looksLikeNoCell(row[0])) return i;
    // Fallback: any cell is "No."
    if (row.some(looksLikeNoCell)) return i;
  }
  return -1;
}

export function detectAttendanceColumns(rows, headerRowIndex) {
  const dateRowIndex = headerRowIndex + 1;
  const dateRow = rows[dateRowIndex];

  // Observed template: attendance starts at column 10 (after occupation at 9)
  const startCol = 10;

  if (!Array.isArray(dateRow)) {
    // Fallback to the observed 12-day shape
    return Array.from({ length: 12 }, (_, i) => startCol + i);
  }

  const cols = [];
  const maxCol = Math.max(dateRow.length, startCol + 12);

  for (let col = startCol; col < maxCol; col++) {
    const v = dateRow[col];
    if (normalizeString(v) !== "") cols.push(col);
  }

  // If the date row is empty in those cols, fallback to 12 columns (10..21)
  if (cols.length === 0) {
    return Array.from({ length: 12 }, (_, i) => startCol + i);
  }

  return cols;
}

export function parseHffRegisterRows(rows) {
  const headerRowIndex = detectHffHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    throw new Error('Could not find header row (expected a "No." column).');
  }

  const dateRowIndex = headerRowIndex + 1;
  const dataStartIndex = headerRowIndex + 2;

  if (rows.length < dataStartIndex) {
    throw new Error("File/sheet is too short to contain participant rows.");
  }

  const attendanceCols = detectAttendanceColumns(rows, headerRowIndex);
  const dateRow = rows[dateRowIndex] || [];
  const campaignDates = attendanceCols.map((idx, i) => dateRow[idx] || `Day ${i + 1}`);

  const participants = [];
  const skippedRows = [];

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const id = row[0];
    const firstName = normalizeString(row[1]);

    // Stop early if we hit a footer section (common in templates)
    if (normalizeString(id) === "" && firstName === "") continue;

    if (id == null || firstName === "") {
      if (normalizeString(row[0]) !== "" || normalizeString(row[1]) !== "") {
        skippedRows.push({
          row: i + 1,
          reason: "Missing ID or First Name",
        });
      }
      continue;
    }

    const gender = normalizeGender(row[3]);
    // Note: We don't add to skippedRows for missing gender to keep the dashboard clean.
    // Name and ID are the primary requirements for a valid participant.

    const participant = {
      id,
      firstName,
      lastName: row[2],
      gender,
      age: row[4],
      education: row[6],
      maritalStatus: row[7],
      occupation: row[9],
      attendance: {},
    };

    let daysAttended = 0;
    attendanceCols.forEach((colIdx, index) => {
      const dateKey = campaignDates[index];
      const val = row[colIdx];
      const isPresent = val == 1; // supports number 1 or string "1"
      participant.attendance[dateKey] = isPresent;
      if (isPresent) daysAttended++;
    });

    participant.daysAttended = daysAttended;
    participants.push(participant);
  }

  const analytics = calculateAnalytics(participants, campaignDates);

  return { participants, analytics, campaignDates, skippedRows };
}

export function calculateAnalytics(participants, dates) {
  // Defensive checks for empty or invalid data
  if (!Array.isArray(participants)) {
    console.warn('calculateAnalytics: participants is not an array', participants);
    participants = [];
  }

  if (!Array.isArray(dates)) {
    console.warn('calculateAnalytics: dates is not an array', dates);
    dates = [];
  }

  const totalRegistered = participants.length;
  const uniqueAttendees = participants.filter((p) => p.daysAttended > 0).length;

  const dailyStats = dates.map((date) => {
    const count = participants.filter((p) => p.attendance && p.attendance[date]).length;
    return { date, count };
  });

  const totalAttendanceCount = dailyStats.reduce((acc, curr) => acc + curr.count, 0);
  const avgAttendance = dates.length > 0 ? (totalAttendanceCount / dates.length).toFixed(1) : 0;

  const genderDist = participants.reduce((acc, p) => {
    const g = normalizeString(p.gender).toUpperCase() || "Unknown";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  const eduDist = participants.reduce((acc, p) => {
    const e = normalizeString(p.education).toUpperCase() || "Unknown";
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});

  const maritalDist = participants.reduce((acc, p) => {
    const m = normalizeString(p.maritalStatus).toUpperCase() || "Unknown";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  const result = {
    totalRegistered,
    uniqueAttendees,
    avgAttendance,
    dailyStats,
    demographics: {
      gender: genderDist,
      education: eduDist,
      maritalStatus: maritalDist,
    },
  };

  console.log('calculateAnalytics result:', result);
  return result;
}

