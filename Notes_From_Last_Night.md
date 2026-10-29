# Notes From Last Night — Duplicate Resolution & Data Quality Log

**Document Version:** 1.0  
**Date:** 29 October 2026  
**Auditor / Operator:** Samukeliso Mayabane (`samukeliso.mayabane@thehealthyfamilies.net`)  
**Campaign:** Mochudi Family Building Campaign (`campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22`)  
**Sync Targets:** Dexie (Client IndexedDB), Google Cloud Firestore, Google Sheets Web App (`PROFILE_Samukeliso_Mayabane` & `MASTER_UNIFORM_REGISTER`)

---

## 1. Executive Summary

During field data transcription and ingestion of physical registers (specifically Registers 51 through 201), several duplicate records and discrepancies emerged due to:
1. **Middle-name inconsistencies:** Names written with a middle name initially in pre-campaign onboarding and omitted on physical registers (or vice versa).
2. **Dual-role self-registration:** Facilitators entering their own names in the participant table of their own register group.
3. **Cross-group registrations:** Participants who attended sessions in multiple wards/kgotlas and were entered into multiple group registers.
4. **Naming convention differences:** English/Christian names vs. Setswana honorific names (e.g., Ben vs. Rrapula) or initials vs. full middle names (e.g., Proud M vs. Proud Mothusi).

This document details the exact actions taken to resolve each duplicate cluster, the facilitators identified for cross-reference, and notes for subsequent review.

---

## 2. Duplicate Cluster Resolutions & Actions Taken

### Cluster 1: Form 63 — Dual-Role Self-Registration & Middle Name
* **Context:** Tebogo Esther Modisagae was registered as a primary facilitator for Register 63, but was also transcribed as Row 1 on her own participant sheet without her middle name *"Esther"*.
* **Records Involved:**
  * **Record A (Facilitator):** `Tebogo Esther Modisagae` | Cell: `76193699` | Age: `50` | Form: `63` | UUID: `193eacb5-8010-44c8-835e-9fd1a25045c7`
  * **Record B (Participant):** `Tebogo Modisagae` | Cell: `76193699` | Age: `50` | Form: `63` | UUID: `022a52bc-1e4a-4c28-890c-8db129f735c0`
* **Action Taken:**
  * **Retained Record A** as the primary Facilitator (`Tebogo Esther Modisagae`).
  * **Removed Record B** from the participant list (soft-deleted with `is_deleted: true`).
  * **Adjusted Group 63 Counts:** Facilitator participant count updated to **11 active participants** (`participants_count: 11`, `books_distributed: 11`).

---

### Cluster 2: Form 201 — Inmate Middle Name Inconsistency
* **Context:** On Register 201 (Mochudi State Prison), inmate Kefilwe Koitsiwe appeared on Sheet 1 with his middle name *"Shaimus"* and on Sheet 4 without it.
* **Records Involved:**
  * **Record A (Participant):** `Kefilwe Shaimus Koitsiwe` | Cell: `5777251` (Prison) | Age: `33` | Form: `201` | UUID: `4bb15bdc-20c0-4fd6-9b52-8d2568ce2f85`
  * **Record B (Participant):** `Kefilwe Koitsiwe` | Cell: `5777251` (Prison) | Age: `33` | Form: `201` | UUID: `9cc7a9b7-d0dd-4a00-b512-c0ab312f18d0`
* **Action Taken:**
  * **Retained Record A** (`Kefilwe Shaimus Koitsiwe`) as the complete original record.
  * **Removed Record B** (`Kefilwe Koitsiwe`) with `is_deleted: true`.
  * **Adjusted Register 201 Counts:** Group leader Raymond Baiphethi / Kenewang Ramontsho participant count updated to **54 active inmates** (`participants_count: 54`, `books_distributed: 54`).

---

### Cluster 3: Cross-Group Participant — Serufe Masilo (Group 63 vs. Group 132)
* **Context:** Serufe Masilo was transcribed on two separate physical registers in Makgophana (Form 63 and Form 132).
* **Records Involved:**
  * **Record A (Group 63):** `Serufe Masilo` | Cell: `72217317` | Age: `55` | Place: `Makgophana Kgotla` | UUID: `80303b8f-2132-45c0-965b-f4717692c526`
  * **Record B (Group 132):** `Serufe Masilo` | Cell: `72217317` | Age: `57` | Place: `MAKGOPHANA` | UUID: `e4563835-83dd-47a3-af41-3f99ce3c4f5e`
* **Facilitators for Serufe Masilo:**
  1. **Group 63 Facilitator:** **Tebogo Esther Modisagae** (Cell: `76193699`, Meeting Place: *Makgophana Kgotla*, Meeting Time: *07:00*, UUID: `193eacb5-8010-44c8-835e-9fd1a25045c7`).
  2. **Group 132 Facilitator:** **Onicah Phalaagae** (Cell: `71464954`, Meeting Place: *MAKGOPHANA*, UUID: `f08da1dc-231d-4740-ad20-4533dd44947b`).
* **Action Taken:**
  * **Retained Record A** in Group 63 under facilitator Tebogo Esther Modisagae.
  * **Removed Record B** from Group 132 (soft-deleted with `is_deleted: true`).
  * **Adjusted Group 132 Counts:** Facilitator Onicah Phalaagae's participant count reduced by 1 to prevent double-counting.

---

### Cluster 4: Facilitator English vs. Setswana Name — Ben Moloi vs. Rrapula Moloi
* **Context:** In Mochudi, the same facilitator was recorded under his English/Christian name (*Ben*) in one session and under his Setswana/honorific name (*Rrapula*) in another. Both share the exact phone `71300225` and age `68`.
* **Records Involved:**
  * **Record A:** `Ben Moloi` | Cell: `71300225` | Age: `68` | UUID: `a0ecbaa3-b897-4875-8c4f-d47ed304d8ca`
  * **Record B:** `Rrapula moloi` | Cell: `71300225` | Age: `68` | UUID: `1044a9a9-2110-4f31-85f3-f0f037382a0f`
* **Action Taken:**
  * **Kept the canonical name:** **`Ben Moloi`** (`a0ecbaa3-b897-4875-8c4f-d47ed304d8ca`).
  * **Merged Attributes into Ben Moloi:**
    * Attendance union: Day 1 (`true`) + Day 2 (`true`) -> `[true, true, false, false, ...]`
    * `teaching_group: true`, `is_daily_core: true`, `books_distributed: 1`, `participants_count: 1`.
  * **Removed Record B** (`Rrapula moloi`) with `is_deleted: true`.

---

### Cluster 5: Facilitator Middle Initial Expansion — Proud M vs. Mothusi Mapotsane
* **Context:** Facilitator registered under `Proud M Mapotsane` on pre-onboarding and `Mothusi Mapotsane` in campaign records. Both share cell `72978680` and age `21`.
* **Records Involved:**
  * **Record A:** `Proud M Mapotsane` | Cell: `72978680` | Age: `21` | UUID: `f57a8a01-9fcf-4321-b2ba-2f3473f603e7`
  * **Record B:** `Mothusi Mapotsane` | Cell: `72978680` | Age: `21` | UUID: `dd5437a1-2350-4e89-920a-82b244784bd3`
* **Action Taken:**
  * **Merged records under full name:** **`Proud Mothusi Mapotsane`** (UUID: `f57a8a01-9fcf-4321-b2ba-2f3473f603e7`).
  * First Name: `Proud Mothusi` | Last Name: `Mapotsane`.
  * **Merged Attributes:** Attendance union `[true, true, ...]`, `teaching_group: true`, `is_daily_core: true`, `books_distributed: 1`, `participants_count: 1`.
  * **Removed Record B** (`dd5437a1-2350-4e89-920a-82b244784bd3`) with `is_deleted: true`.

---

### Cluster 6: Facilitator vs. Participant Cross-Entry — Onkarabile Nnuku Makole
* **Context:** Onkarabile Nnuku Makole is an active facilitator. A participant record under `Onkabile Nkwane` with the identical phone `77491167` and age `38` was transcribed into Register 136.
* **Records Involved:**
  * **Record A (Facilitator):** `Onkarabile Nnuku Makole` | Cell: `77491167` | Age: `38` | UUID: `6ad71cd4-153b-4d68-b061-5c32f4c48e9d`
  * **Record B (Participant on Form 136):** `Onkabile Nkwane` | Cell: `77491167` | Age: `38` | Form: `136` | UUID: `82f50370-d693-4dc6-8575-c768af57f6cc`
* **Facilitator for Record B (Form 136):**
  * **Facilitator Name:** **Olebogeng Peolwane**
  * **Cell Number:** `75991025`
  * **Form Number:** `136`
  * **Facilitator UUID:** `c9a145e2-640f-4583-b1bb-10c8739f7402`
* **Action Taken:**
  * **Retained Record A** (`Onkarabile Nnuku Makole`) as Facilitator.
  * **Removed Record B** (`Onkabile Nkwane`) from Form 136 with `is_deleted: true`.
  * **Adjusted Form 136 Counts:** Facilitator Olebogeng Peolwane's participant count reduced by 1.

---

### Clusters 7 & 8: Pending System-Side Review (Left Untouched)
* **Cluster 7 (Form 143):**
  * `Neo Setsuma` (Age 26, F) vs. `Maatla Segotso` (Age 26, F) sharing cell `74073465`.
  * *Status:* Deferred to user system-side check (potential shared phone among group friends).
* **Cluster 8 (Forms 60 & 85):**
  * `Mmatsebe Mabote` (Age 50, F, Form 85) vs. `Mmakose Makole` (Age 50, F, Form 60) sharing cell `72434046`.
  * *Status:* Deferred to user system-side check.

---

### Clusters 9–11: Fuzzy Typo & Handwriting Variation Clusters (Resolved)

#### Cluster 9: Form 106 Facilitator — Lebogang Doreen Makgale vs. LEBOGANG MAKGALA
* **Context:** Facilitator onboarded during pre-campaign as `Lebogang Doreen Makgale` (entered by Kagiso Moffat on Oct 27). When the physical paper register for Form 106 was transcribed on Oct 28, she was entered as `LEBOGANG MAKGALA` (under Samukeliso Mayabane).
* **Root Causes:**
  1. Middle name omitted on paper (`Doreen` absent).
  2. Setswana vowel variation in surname (`Makgale` vs. `Makgala`).
  3. Single-digit handwriting phone discrepancy: `75966113` (digital onboarding) vs. `75966118` (paper register handwritten `3` misread as `8`).
* **Records Involved:**
  * **Master Record A:** `Lebogang Doreen Makgale` | Cell: `75966113` | Age: `46` | Female | UUID: `3ccca050-f6c0-449e-b2d9-3652d87e07eb`
  * **Paper Register Record B:** `LEBOGANG MAKGALA` | Cell: `75966118` | Form: `106` | Place: `BOSEJA BEHIND IPCC` | Meeting: `5:00 - 6:30 PM` | UUID: `00b5d86f-23ea-42f0-911e-089aa14bc497`
* **Action Taken:**
  * **Retained Record A as Master:** Preserved full canonical name `Lebogang Doreen Makgale`, demographic details (Age 46, Female), and verified contact `75966113`.
  * **Merged Attributes from Record B:** Attached Form Number `106`, meeting time `5:00 - 6:30 PM`, place `BOSEJA BEHIND IPCC`, `teaching_group: true`, `is_daily_core: true`.
  * **Re-linked All 12 Group 106 Participants:** Updated `facilitator_uuid` on all 12 participants from `00b5d86f...` to master `3ccca050...`.
  * **Soft-Deleted Record B:** Soft-deleted `00b5d86f...` with `is_deleted: true`.

#### Cluster 10: Form 121 Facilitator — Mmakgabo Bojelo vs. BOJELO MMAKGAGO
* **Context:** Pre-campaign record `Mmakgabo Bojelo` duplicated when physical register Form 121 was transcribed with reversed First/Last names as `BOJELO MMAKGAGO` (Setswana `b` vs. `g` transcription variant).
* **Records Involved:**
  * **Master Record A:** `BOJELO MMAKGAGO` | Cell: `77626920` | Form: `121` | Place: `IKAGENG/RATSWEVENG` | UUID: `2140e009-42b7-4b7b-8919-61da88df1796`
  * **Pre-campaign Record B:** `Mmakgabo Bojelo` | Cell: `77626920` | UUID: `76fd9f34-1188-4db8-8d07-28e6c7025ec1`
* **Action Taken:**
  * **Retained Record A as Master Facilitator:** Preserved Form Number `121`, linked participants, place `IKAGENG/RATSWEVENG`, and verified contact `77626920`.
  * **Soft-Deleted Record B:** Soft-deleted `76fd9f34...` with `is_deleted: true`.

#### Cluster 11: Participant — Daphney Chelane vs. Daphney chabuya
* **Context:** Participant in Form 104 recorded with identical phone `76342674`, age `27`, female, under slight surname spelling variant.
* **Records Involved:**
  * **Master Record A:** `Daphney Chelane` | Cell: `76342674` | Age: `27` | Form: `104` | UUID: `f44a3627-ef31-41c1-8ce2-da47b1e7c5b6`
  * **Duplicate Record B:** `Daphney chabuya` | Cell: `76342674` | Age: `27` | Form: `104` | UUID: `ca13f704-5e16-43bf-bb2b-4fa88dcf6d9b`
* **Action Taken:**
  * **Retained Record A** (`Daphney Chelane`).
  * **Soft-Deleted Record B** (`ca13f704...`) with `is_deleted: true`.

---

## 4. Systemic Duplicate Prevention Engine Enhancements

To prevent similar fuzzy-name, Setswana orthographic variations, and single-digit handwriting phone errors from creating duplicate records in future imports and live synchronization, the client-side deduplication engine in `src/lib/dataMaintenance.js` was enhanced with:

1. **Setswana Vowel Ending Normalization (`normalizeSetswanaWord`):**
   * Normalizes terminal vowel alternations common in Setswana transcription (`-e` ↔ `-a` such as *Makgale* ↔ *Makgala*; `-o` ↔ `-u` such as *Setsuma* ↔ *Setsoma*).
2. **Fuzzy Phone Matching (`isPhoneFuzzyMatch`):**
   * Computes Hamming distance on 8-digit mobile and 7-digit landline numbers. If numbers differ by exactly 1 digit (e.g. `75966113` vs `75966118`), it is recognized as a handwriting transcription typo rather than a distinct individual.
3. **Multi-Token & Inverted Name Matching (`areNamesFuzzyMatch`):**
   * Evaluates token subsets to catch omitted middle names (e.g. *Lebogang Doreen Makgale* vs. *Lebogang Makgale*).
   * Automatically recognizes inverted name ordering (*First Last* vs. *Last First*, e.g. *Bojelo Mmakgabo* vs. *Mmakgabo Bojelo*).
4. **Candidate Bucketing by Phone Prefix and Name Tokens:**
   * Bucketing incorporates 7-digit phone prefixes (`phone7`) and normalized word tokens (`token`), allowing the $O(N)$ candidate clustering system to detect fuzzy pairs without expensive $O(N^2)$ comparisons across the 3,000+ record dataset.

---

## 5. Execution Report: 29 October 2026 Numbered Registers Handover (Range 51–221)

On 29 October 2026, the complete ingestion and reconciliation pipeline was executed for all physical registers in the 51–221 range in accordance with the handover specification (`HFF_Registers_51_to_200s_Handover_29-10-2026.md`).

### Part A — 20 Brand-New Numbered Register Groups Ingested (256 Active Participants)
All 20 new registers were verified, facilitators assigned/created, and participant rosters populated with complete demographics (`education`, `marital_status`, `affiliation`, `occupation`):
* **REGISTER 57** (Boseja / Boseja Kgotla): Maipelo Rathari-Molefe (`71780517`) / Keatlaretse Mokgosi (`71449339`) — **24 participants**, 24 books.
* **REGISTER 68** (Boseja / Boseja Clinic): Lesego Popie Pheto (`77158917`) — **15 participants**, 15 books.
* **REGISTER 78** (Modipane / Modipane Clinic): Bathusi Tsheko (`76735515`) — **5 participants**, 5 books.
* **REGISTER 92** (Mochudi / Makgophana): Itumeleng Senyarelo (`74620023`) — **11 participants**, 11 books.
* **REGISTER 100** (Mabalane / Mabalane Clinic): Kutlo L Batlang (`74408167`) — **12 participants**, 12 books.
* **REGISTER 101** (Sikwane / Sikwane Clinic): Ronicah Motshegwe (`76420556`) — **12 participants**, 12 books.
* **REGISTER 123** (Boseja Ward): Elisa Mapotsane (`72352125`) — **15 participants**, 15 books.
* **REGISTER 125** (Modipane): Kefilwe Moseki (`71626245`) — **18 participants**, 18 books.
* **REGISTER 151** (Boseja / Home): Lesego Moraope (`75042296`) — **6 participants**, 6 books.
* **REGISTER 153** (Boseja): Tebogo Moeng (`76233481`) — **21 participants**, 21 books.
* **REGISTER 157** (Boseja Ward): Leah Senwelo (`75966113`) — **3 participants**, 3 books.
* **REGISTER 179** (Makgophana): Kgomotso Nquesh Dintsi (`76677943`) — **4 participants**, 4 books.
* **REGISTER 191** (Mochudi Prison Staff): Raymond Baiphetlhi (`71374706`) — **4 participants**, 4 books.
* **REGISTER 203** (Modipane): Tebogo Charmine Dikgang (`75440755`) — **12 participants**, 12 books.
* **REGISTER 205** (Boseja Ward): Itumeleng Pilane (`75932594`) — **4 participants** (Row 1 struck through and omitted), 4 books.
* **REGISTER 208** (Boseja): Gaonyalelwe kgang (`72242125`) — **17 participants**, 17 books.
* **REGISTER 210** (Modipane): Gaanewe Pinkie Molema (`76211833`) — **3 participants**, 3 books.
* **REGISTER 216** (Mochudi / Lady Mitchison): Lesedi Ramabokwa (`76785237`) — **24 participants**, 24 books.
* **REGISTER 217** (Mochudi / Lady Mitchison): Dolly Shapata (`71780517`) — **35 participants**, 35 books.
* **REGISTER 221** (Mochudi / Lady Mitchison): Lesedi Kaone (`74581177`) — **11 participants**, 11 books.

### Part B — Updates, New Pages, Removals & Attendance Across Existing Registers
* **Re-numbering REGISTER 129 → REGISTER 128 (Wildlife Office):**
  * Group Leaders Boago Letshoo (`77326267`) & Wabo Venda (`74406246`) re-numbered from Form 129 to Form 128.
  * Rows 1–11 updated with expanded full names and `affiliation: "Wildlife"`.
  * Added 8 new participants (Rows 12–19). Total group roster: **19 participants**.
  * Attendance: Rows 1–14 marked for `27 Oct, 28 Oct`; Rows 15–19 marked for `28 Oct`.
* **New Pages & Supplementary Participant Rows Added:**
  * **REGISTER 53** (Pulafela Pilane): Added full initial roster of 8 participants.
  * **REGISTER 54**: Added Rows 12–14 (3 new participants).
  * **REGISTER 72**: Added Rows 13–15 (3 new participants).
  * **REGISTER 73**: Added Row 11 (`Mmathapelo Tsele`).
  * **REGISTER 104**: Added Rows 13–16 (4 new participants).
  * **REGISTER 132**: Added Rows 6–10 (5 new participants).
  * **REGISTER 172 Set B**: Added Row 16 (`Amantle Ditlole`).
  * **REGISTER 182**: Added Row 10 (`Meshack Musonda`).
  * **REGISTER 183 A**: Added Row 12 (`Katlego Seabelo`).
  * **REGISTER 185**: Added 3 participants from the 15:30hr sub-group sheet.
  * **REGISTER 196**: Added New Page 1 (Rows 1–5).
  * **REGISTER 197**: Added Rows 20–22 (3 new participants).
  * **REGISTER 201 Sheet 1**: Added Rows 8–12 (5 new inmate participants).
* **Physical Struck-Through / Crossed-Out Rows Purged (Soft-Deleted):**
  * `REGISTER 73`: Row 8 (`Bokang Kgaupe`).
  * `REGISTER 201 Sheet 2`: Row 16 (`Tomeletso Lengwadibe`) and Row 18 (`Kabelo Thibogang`).
  * `REGISTER 201 Sheet 3`: Row 16 (`Kefilwe Koitsiwe`) and Row 17 (`Oteng Kgabangwe`).
* **Demographic Fields Enriched:**
  * `REGISTER 85`: Row 1 (`Mmamasedinyane Moitoi`) `occupation: "Cluster"`.
  * `REGISTER 121`: All 10 rows `affiliation: "IKAGENG"`, `occupation: "CLEANING"`.
  * `REGISTER 197`: Row 16 marital status `"S"`, Row 17 marital status `"M"`.
  * `REGISTER 201` (Mochudi State Prison Sheets 1–5): Filled education level and marital status across all 56 active inmate rows.
* **Physical Attendance Tracking (`attendance` Array Updates):**
  * `attendance[0]` = 27 Oct, `attendance[1]` = 28 Oct, `attendance[2]` = 29 Oct, `attendance[3]` = 30 Oct.
  * Applied verified physical ticks across `REGISTER 53`, `54`, `63`, `72`, `73`, `85`, `104`, `108`, `116`, `121`, `128`, `132`, `136`, `143` (Grps 1–3), `159`, `172` (Sets A & B), `182`, `183 A`, `185`, `196`, `197`, `201`, `202`, and `220`.
* **Book Accounting Policy Enforced (`1 Participant = 1 Book Given`):**
  * All active participants marked `books_received: true`.
  * Every facilitator's `books_distributed` and `participants_count` recalculated to equal their active group roster size.

### Synchronization & Reconciliation Metrics
* **Cloud Firestore:**
  * 644 registration records upserted across 2 batches.
  * 8 redundant / struck-through records soft-deleted (`is_deleted: true`).
* **Google Sheets Web App Integration:**
  * 913 active records pushed to `PROFILE_Samukeliso_Mayabane` (379 inserted, 534 updated, 963 total in profile tab).
  * Auto-reconciliation in `MASTER_UNIFORM_REGISTER` executed: **1,375 uniform master total records**, with 1,212 duplicate matches reconciled.
* **Audit Footprint:**
  * All records stamped under operator **Samukeliso Mayabane** (`samukeliso.mayabane@thehealthyfamilies.net`, UID `E7bGBQslPsafBPovmFoYHiLqxQZ2`).
