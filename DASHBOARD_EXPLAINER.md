# HFF Dashboard V2 - Comprehensive System Overview & LLM Handover Guide

This document provides an extensive breakdown of the **Hope For Families (HFF) Dashboard**, its current state, features, technical architecture, and the challenges remaining for field deployment. It is designed to brief another LLM or developer on the project's logic and trajectory.

---

## 1. Project Mission
The HFF Dashboard is a specialized data management and visualization platform for the **Hope For Families** campaign. Its primary goal is to track participant registration and attendance across multi-day campaigns (typically 12 days) and provide real-time demographic insights. The system bridges the gap between **offline data collection** (via Enketo forms and Excel sheets) and **centralized monitoring** (via Google Sheets and a web dashboard).

## 2. Technical Stack
- **Frontend**: React + Vite + Tailwind CSS (Hosted on Vercel).
- **Backend**: Node.js / Express (Local/Server-side API).
- **Primary Database**: SQLite (for local persistence and concurrency).
- **External Sync**: Google Sheets API (for real-time sharing and backup).
- **Authentication**: Supabase (replacement for Firebase).
- **Data Ingestion**: `xlsx` (Excel/CSV parser) and `xmldom` (Enketo XML parser).

---

## 3. Core Modules & Current Progress

### A. Data Processing Engine (`hffRegister.js`)
- **Header Detection**: Uses `detectHffHeaderRowIndex` to automatically find the "No." column in messy Excel files, regardless of title rows or empty space.
- **Attendance Mapping**: Identifies the 12 columns assigned to daily attendance (columns 10-21 by default) and correlates them with dates.
- **Normalization**: Handles inconsistent inputs (e.g., converting "Monna", "1", "Male" all to "M" via `normalizeGender`).
- **Analytics**: Calculates real-time stats for:
  - Total Registered vs. Unique Attendees.
  - Average Daily Attendance.
  - Demographic distributions (Gender, Education, Marital Status).

### B. Sync & Storage (`storage.js`, `db.js`, `googleSheets.js`)
- **SQLite Migration**: Successfully migrated from flat JSON files to SQLite. This allows for transactional writes and better handling of concurrent requests.
- **Two-Way Sync**:
  - **Load Live**: Pulls directly from a Google Sheet to populate the dashboard.
  - **Sync Local**: Pushes local SQLite data up to Google Sheets.
- **Auto-Sync**: Background logic to keep the "Source of Truth" (Google Sheets) updated whenever a new registration is submitted.

### C. Enketo Integration (`enketoMapper.js`)
- **XML Mapping**: Parses Enketo ODK-style XML submissions and converts them into the specific array format required by the dashboard.
- **Field Flexibility**: Recognizes multiple variations of field names (e.g., `Sex`, `gender`, `Bong` for gender detection) to accommodate different form versions used in the field.

### D. Security (`index.js`)
- **API Key Protection**: All data endpoints are now protected by an `x-api-key` header to prevent unauthorized access.
- **Auth Migration**: Current transition from Firebase to Supabase for user management.

---

## 4. Features - "What's Working"
- [x] **Excel/CSV Upload**: Robust parsing of legacy campaign registers.
- [x] **Real-time Stats**: Dynamic charts for daily attendance and demographics.
- [x] **Gender Normalization**: Consistent mapping across local and Enketo data.
- [x] **Backend Persistence**: SQLite database is fully functional with migration logic from JSON.
- [x] **Google Sheets Integration**: Service account authentication is set up.
- [x] **Offline Cache**: Local storage handles data when the API is unreachable.

---

## 5. Current Issues & Known Constraints

### Data Integrity 
- **"Skipped Rows"**: There are still edge cases where Excel rows are skipped if the "No." or "First Name" columns are missing. Field teams often omit these, leading to under-counting.
- **Templating Variations**: If a field team changes the column order (e.g., moving "Occupation" before "Gender"), the index-based parser in `hffRegister.js` may misalign data.

### Formatting
- **Dates**: Handling of Excel serial dates vs. ISO strings can sometimes lead to "Day 1", "Day 2" labels instead of actual calendar dates.

### Sync Conflicts
- If multiple people edit the Google Sheet manually while the API attempts a sync, there is a risk of data overwrites.

---

## 6. Hurdles for Field Deployment

### 1. Connectivity (The biggest hurdle)
The system relies on Google Sheets for its "master" record. In rural areas with unstable internet, the "Sync to Cloud" feature needs a robust retry mechanism and a clear "Pending Sync" UI indicator for users.

### 2. Device Scaling
The dashboard is currently optimized for desktop/laptop screens. Field supervisors using tablets or phones will struggle with the current layout of the attendance grid (which is very wide—12 days).

### 3. Data Entry Errors in Enketo
Enketo forms allow for free-text in some "Age" or "Gender" fields which bypasses the current normalization. The mapper needs even more defensive logic to handle unexpected strings.

### 4. Hosting Strategy
While Vercel is great for the UI, the SQLite-based backend requires a persistent file system or a move to a managed DB (like Supabase Postgres). If deployed as a standalone Node server on a local machine in the field, it needs a "single-click" installer or Docker container.

---

## 7. Next Steps for Success
1. **Dynamic Mapping**: Move away from hardcoded column indices (e.g., `row[3]` for gender) and use a header-name lookup instead.
2. **Bulk ID Generation**: Auto-generate IDs if they are missing in the source file.
3. **PWA Support**: Turn the dashboard into a Progressive Web App (PWA) so field teams can access the UI offline.
4. **Supabase Finalization**: Complete the migration to use Supabase for *all* data storage, moving away from SQLite to allow for true multi-user cloud access without Google Sheets bottlenecks.

---
*End of Briefing*
