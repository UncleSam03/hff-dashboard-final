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

## 3. Data Quality & Deficient Record Notes for Ongoing Tracking

1. **Shared Phone Numbers:**
   * **Mochudi State Prison (`5777251`):** All 54 inmates legitimately share the prison landline. Do not flag as duplicate based on contact number.
   * **Household Shared Mobiles:** Several young participants share mobile phones with older relatives (e.g., `Selinah Moitoi` [39] & `Monich Moitoi` [21] on `77741676`; `Janet Pone` [13] & `Abigail Pone` [16] on `71596708`). These are verified legitimate separate individuals.
2. **Attendance Integrity:**
   * Form 72 marked attendance physically on `28 Oct` (Day 2).
   * Form 58 (Mmusi P. School) has active participants with `None` marked on dates, which remain unselected until verified.
   * Day 1 & Day 2 attendances were merged additively during record deduplication to avoid under-reporting.
3. **Database Integrity Status:**
   * **Cloud Firestore:** 6 duplicate records soft-deleted, 3 master records updated with complete merged attributes.
   * **Google Sheets:** Buffer updated and reconciled into `MASTER_UNIFORM_REGISTER` (total reconciled: 949 rows).
   * **Local Storage (Dexie):** Pre-sanitized to strip device-specific `id` values, preventing `ConstraintError` exceptions upon pull.
