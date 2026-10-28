# HFF Dashboard Data Handover: Numbered Physical Registers (Facilitators, Participants, Attendance & Books Given)

## 1. Agent Execution Instructions & Business Rules

> [!IMPORTANT]
> **Target System:** HFF Dashboard (`c:\Users\samuk\Documents\hff-dashboard-final`) — IndexedDB/Dexie (`db.registrations`), Firebase Cloud Sync (`hff-firebase-sync-request`), and Google Sheets Profile Buffer (`pushProfileBufferToSheets`).
>
> **Scope of Handover:**
> - **Section 2 (Primary Import Set — Numbered Registers `54` through `220`, including `REGISTER 201` / Mochudi State Prison):** **40 Leader/Register Groups** across **58 unique physical pages** (**567 active participants = 567 books given**). Process all registers in Section 2 in chronological/ascending order.
> - **Section 3 (Reference Only — Registers `1–50` & Leader-Associated `REGISTER 53`):** Already handed over for manual entry (**18 unique pages, 159 participants**). **Skip Section 3** unless explicitly instructed to import or cross-check it.
> - **Section 4 (Reference Only — 4 Remaining Unnumbered Register Groups):** **5 pages, 54 participants** without a register number yet. **Skip Section 4** until register numbers are assigned.

### Core Data Rules for the Agent

1. **Attach or Create the Correct Facilitator (`type: 'facilitator'`):**
   - For each Register / Group in Section 2, first search existing records in `db.registrations` (for the active campaign) by the **Group Leader's name** (`first_name`, `last_name`) or **Cell Number** (`contact`), using `matchesPerson` or normalized phone/name matching.
   - **If the facilitator already exists in the database:**
     - Update their record with `form_number: String(registerNumber)` (e.g. `"54"`, `"58"`, ..., `"201"`, `"202"`, `"220"`), `type: 'facilitator'`, `teaching_group: true`, `is_daily_core: true`, `place` (Meeting Place), and `meeting_time` (Meeting Time).
     - Ensure they have a valid `uuid`.
   - **If the facilitator does not exist yet in the database:**
     - Create a new facilitator record in `db.registrations` with `type: 'facilitator'`, `form_number: String(registerNumber)`, `first_name`, `last_name`, `contact`, `place`, `meeting_time`, `teaching_group: true`, `is_daily_core: true`, and a generated `uuid`.
   - **Co-Leaders / Second Leaders & Shared Register Numbers:**
     - Where a **Second Leader** is listed on the physical register header, preserve their name/contact in notes or co-leader metadata, or if they lead a sub-group sharing a register number (`REGISTER 143` Groups 1/2/3, `REGISTER 172` Sets A/B, `REGISTER 174 A/B`, `REGISTER 183 / 183A / 183B`, `REGISTER 201` Sheets 1–5), attach each sub-group's participants to their respective leader's `facilitator_uuid` while keeping `group_form_number` set to the register number (or sub-group identifier as supported by the dashboard).

2. **Add All Participant Names & Demographics (`type: 'participant'`):**
   - For every active row in each register's table (excluding crossed-out rows such as Row 5 on `REGISTER 59`), add or update the participant record in `db.registrations`:
     - `first_name`: Participant's First Name
     - `last_name`: Participant's Last Name (use `""` if only one name is written)
     - `gender`: `'M'` or `'F'` (normalize `"Male"` → `'M'`, `"Female"` → `'F'`)
     - `age`: Integer age (or `null` if blank/`"-"`)
     - `contact`: Phone number string (or `null` if blank/`"-"`)
     - `education`: Education level string (or `null` if blank/`"-"`)
     - `marital_status`: Marital status string (or `null` if blank/`"-"`)
     - `affiliation`: Value from `Organisation / Workplace` column (or fallback to facilitator's `affiliation`/`place` if blank)
     - `occupation`: Value from `Occupation` column (or `null` if blank/`"-"`)
     - `place`: Register's `Meeting Place`
     - `type`: `'participant'`
     - `group_form_number`: `String(registerNumber)`
     - `facilitator_uuid`: The `uuid` of the attached Group Leader / Facilitator for that register.

3. **Mark Attendance Registers ONLY Where Marked on the Physical Register (`attendance` Array):**
   - In the HFF Dashboard (`TOTAL_CAMPAIGN_DAYS = 12`), each participant has an `attendance` array of 12 booleans (`[false, false, ..., false]`):
     - `attendance[0]` = **Day 1 (`27 Oct`)**
     - `attendance[1]` = **Day 2 (`28 Oct`)**
     - `attendance[2]` = **Day 3 (`29 Oct`)**
     - `attendance[3]` = **Day 4 (`30 Oct`)**
     - `attendance[4]` = **Day 5 (`31 Oct`)**
     - `attendance[5]` = **Day 6 (`1 Nov`)**
     - `attendance[6]` = **Day 7 (`2 Nov`)**
     - `attendance[7]` = **Day 8 (`3 Nov`)**
     - `attendance[8]` = **Day 9 (`4 Nov`)**
     - `attendance[9]` = **Day 10 (`5 Nov`)**
     - `attendance[10]` = **Day 11 (`6 Nov`)**
     - `attendance[11]` = **Day 12 (`7 Nov`)**
   - Check the **`Attendance Marked (Dates)`** column in the tables below for each participant:
     - If `27 Oct` → set `attendance[0] = true` (all other indices `false`).
     - If `28 Oct` → set `attendance[1] = true` (e.g., `REGISTER 72`).
     - If `27 Oct, 28 Oct` → set `attendance[0] = true` and `attendance[1] = true` (e.g., `REGISTER 197` Row 19).
     - If `None` → set all 12 indices to `false` (`Array(12).fill(false)`). **Do NOT mark attendance if the physical register is unmarked (`None`).**

4. **Books Given Rule (`Each Participant = 1 Book Given`):**
   - For **every active participant**, set **`books_received: true`** (each participant equals 1 book given).
   - For each **Facilitator**, set **`books_distributed`** (and `participants_count`) equal to the **total number of active participants** attached to that facilitator (so 1 participant = 1 book given is reflected at both the participant level and the facilitator level).

---

## 2. Master Summary of Numbered Registers 54–220 (Chronological Order)

| Grp # | Register / Form No. | Pages | Group Leader (Primary Facilitator) | Cell Number | Second Leader (Co-Leader) | Second Cell | Meeting Place | Meeting Time | Active Participants (= Books Given) | Physical Attendance Marked |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **`REGISTER 54`** | P1 | Lone Tsholofeloetso Moitoi | `74689270 / 71689270` | — | — | Lone home Mabodisa | `17:00` | **11** | `27 Oct` (Rows 1–11) |
| 2 | **`REGISTER 58`** | P2 | Khutsafalo Kgodungwe | `72728148` | Malebogo Setlhabi | `78675522` | Mmusi P. School | `16:30` | **7** | `None` |
| 3a | **`REGISTER 59`** | P1 | Babedi Moroope | `75854127` | Tebogo E. Modisagae | `76193699` | Tigers F Club | `05:00` | **5** *(Row 5 crossed out)* | `27 Oct` (Rows 1–4, 6) |
| 3b | **`REGISTER 60`** | P1 | Babedi Moroope | `75854127` | Estheri Modisagae | `76193699` | Makgophana Kgotla | `12:00` | **9** | `27 Oct` (Rows 1–9) |
| 3c | **`REGISTER 63`** | P1 | Tebogo E. Modisagae | `76193699` | Babedi Moroope | `75854127` | Makgophana Kgotla | `07:00` | **12** | `27 Oct` (Rows 1–12) |
| 4 | **`REGISTER 65`** | P1 | Sharon T. B. Phiri | `72804348` | — | — | Home Mabodisa | `17:30` | **4** | `27 Oct` (Rows 1–4) |
| 5 | **`REGISTER 72`** | P1 | Seakgosing (Seanokeng) Nkope Molefe | `72422804` | Tefo Simane | `72799040` | VDC Offices Moganetsi Kgotla | `07:30` | **12** | `28 Oct` (Rows 1–12) |
| 6 | **`REGISTER 73`** | P1 | Neo Matlhaga | `77036887` | — | — | Masiana Kgotla | `17:00 HRS` | **10** | `27 Oct` (Rows 1–10) |
| 7 | **`REGISTER 75`** | P1 & P2 | Seanokeng Selala | `71803346` | Rivonia M. Tlhase | `77060006` | Ntshinoge, Next to Kagiso Bar | `17:30 / 11:30` | **14** (12 + 2) | `27 Oct` (Rows 1–14) |
| 8 | **`REGISTER 85`** | P1 | Bogolo (Bogo) Moitoi | `76418118` | Matlhodi Sarah Molefe | `78354037` | Makgophana Ward | `12:30 HRS` | **9** | `27 Oct` (Rows 1–9) |
| 9 | **`REGISTER 98`** | P2 | Alecah Kotsedi | `74190365` | Phatsima Sello | `78247718` | Pilane Kgotla | `12:00` | **2** | `27 Oct` (Rows 13–14) |
| 10 | **`REGISTER 104`** | P1 | Josephine Mathibe | `71565643 / 75009303` | Mpho Ramotho | `73091462 / 72548023` | Boseja | `15:00` | **12** | `27 Oct` (Rows 1–12) |
| 11 | **`REGISTER 106`** | P1 | Lebogang Makgae (Makgala) | `75966118` | — | — | Boseja Behind IPCC | `17:00 - 18:30` | **12** | `27 Oct` (Rows 2, 4–7, 10–11); `None` (Rows 1, 3, 8–9, 12) |
| 12 | **`REGISTER 107`** | P1 & P2 | Thabang P. Modimakwane | `72993400` | — | — | Lady Mitchison School / Neighbours | `07:30 hrs` | **17** (12 + 5) | `27 Oct` (Rows 1–2, 9–17); `None` (Rows 3–8) |
| 13 | **`REGISTER 108`** | P1 | Onkarabile Mlambo | `73192609` | — | — | Plot 8285 Boseja South | `16:30` | **9** | `27 Oct` (Rows 1–4, 6–9); `None` (Row 5) |
| 14 | **`REGISTER 116`** | P1 & P2 | Oikabetse K. Ramoele | `75349459` | Onkabetse Ramotsele | `75686300` | Morema / Morwa, Plot 19518 After Main Kgotla | `17:00 HRS` | **19** (12 + 7) | `27 Oct` (Rows 1–19) |
| 15 | **`REGISTER 121`** | P1 | Bojelo Mmakgabo | `77649305` | Lesego Mothofela | `77040635` | Pavement Route 9 / Phaphane Slabs | `14:00` | **10** | `None` |
| 16 | **`REGISTER 129`** | P1 | Boago Leshomo (Lekaowa) | `77826267` | Wabo Venda | — | Wildlife & National Parks | `14:00 HRS` | **11** | `27 Oct` (Rows 1–5, 9–11); `None` (Rows 6–8) |
| 17 | **`REGISTER 132`** | P1 | Onica Rammala (Rammapa) | `71464954` | — | — | Makgophana | `10:00 / 14:00` | **5** | `27 Oct` (Rows 1–5) |
| 18 | **`REGISTER 136`** | P1 | Olebogeng Fedwane | `75991025` | Boitumelo Moeng | `75412919` | Makgophana Clinic | `13:00` | **12** | `27 Oct` (Rows 1–12) |
| 19 | **`REGISTER 141`** | P1 & P2 | Mrs. S. Sikwane | `75493040` | — | — | Mmadipamo P. School | `14:30 hrs` | **15** (12 + 3) | `27 Oct` (Rows 1–15) |
| 20 | **`REGISTER 143` (Grp 1)** | P1 | Thato Mosate | `78719592` | Nthabiseng Mfosi | `76920501` | Makgophana | `07:00` | **11** | `27 Oct` (Rows 1–11) |
| 21 | **`REGISTER 143` (Grp 2)** | P1 | Bakeng Thabiso Molefe | `76312112` | — | — | Kwa Maswena | `14:00` | **12** | `27 Oct` (Rows 1–12) |
| 22 | **`REGISTER 143` (Grp 3)** | P1 & P2 | Bakang Modise | `74704731` | Tumediso Ellen Mfosi | `76381950` | Bogatsu Primary School (Makgophana) | `12:30` | **14** (12 + 2) | `27 Oct` (Rows 1–14) |
| 23 | **`REGISTER 159`** | P1 | Botsalo Leungo Rakgole | `72110158` | — | — | Madiane's house | `12:00` | **12** | `27 Oct` (Rows 1–12) |
| 24 | **`REGISTER 171`** | P1 | Bomme Ba Thapelo (Thari) | `71611285 / 72509327` | Gagoipone Tsheko | `71611285 / 74401195` | Clinic 1 Mochudi | `14:00` | **10** | `None` |
| 25a | **`REGISTER 172` (Set A)** | P1 & P2 | Dineo Sereko | `72522488` | Dikeledi (Boledi) P. Tsoane | `72600130` | Rankoa P. School | `14:30` | **16** (12 + 4) | `27 Oct` (Rows 1–16) |
| 25b | **`REGISTER 172` (Set B)** | P1 & P2 | Dineo Sereko | `72522488` | Dikeledi (Boledi) P. Tsoane | `72600130` | Rankoa P. School | `14:30` | **15** (12 + 3) | `27 Oct` (Rows 1–15) |
| 26a | **`REGISTER 174 A`** | P1 | Selinah Sefakwe | `72395409 / 74515520` | — | — | Morwa / Morula route 5 | `06:00 am` | **12** | `27 Oct` (Rows 1–12) |
| 26b | **`REGISTER 174 B`** | P2 | Selinah Sefakwe | `72395409 / 74515520` | — | — | Kgotla Boseja South | `07:00 am` | **9** | `27 Oct` (Rows 13–21) |
| 27 | **`REGISTER 175`** | P2 | Emmanuel Latlhisa (Katlego) | `76931562` | — | — | Fire Dept | `07:30` | **11** | `None` |
| 28 | **`REGISTER 182`** | P1 | Tseone (Tsegwe) B. Lemogo | `71779905 / 71770905` | — | — | Plot 10226 Phaphane | `20:00` | **9** | `27 Oct` (Rows 1–9) |
| 29 | **`REGISTER 183` (Grp 1)** | P1 & P2 | Tshegofatso Lebotse | `73495184` | Nicolas Sefako & Omphile Tsele | `73495184 / 74651231` | Seingwaeng P. School | `07:30 - 08:00 am` | **13** (12 + 1) | `27 Oct` (Rows 1–13) |
| 30 | **`REGISTER 183 A` (Grp 2)** | P1 | Ms. Onalepelo Dipogiso | `76934521` | Thato Mogotsi | `78156864` | Seingwaeng P. School | `07:30 - 08:00 am` | **11** | `27 Oct` (Rows 1–11) |
| 31 | **`REGISTER 183 B` (Grp 3)** | P1 | Kelebogile Ntshabele | `71744244` | Kesaobaka Pheto | `77427767` | Seingwaeng P. School | `07:30 - 08:30 am` | **10** | `27 Oct` (Rows 1–10) |
| 32 | **`REGISTER 185`** | P1 & P2 | Kagiso Moitoi | `74977997 / 77777169` | Kabo Maxala | `72958870` | Education Regional Office | `15:00 hrs` | **13** (12 + 1) | `27 Oct` (Rows 1–13) |
| 33 | **`REGISTER 188`** | P1 & P2 | Lesego F. Tlhage | `74173550 / 74173510` | Mma Kgwetane | — | Isang P. School | `13:00` | **22** (12 + 10) | `27 Oct` (Rows 1–22) |
| 34 | **`REGISTER 189`** | P2 | Segametsi Setshwane | `71542193 / 78202341` | Ahueng Masaka (Mosala) | `74441865` | At home | `20:00` | **12** | `27 Oct` (Rows 13–24) |
| 35 | **`REGISTER 196`** | P2 | Otshegeditswe Mofisa (Mosiisi) | `75512007` | — | — | Mmathubudukwane Police Station | `15:00 HRS` | **11** | `27 Oct` (Rows 13–23) |
| 36 | **`REGISTER 197`** | P2 | Olebogeng Tona | `72775831 / 72795831` | — | — | Mmathubudukwane | `07:30` | **7** | `27 Oct` (Rows 13–18); `27 Oct, 28 Oct` (Row 19) |
| 37 | **`REGISTER 198`** | P1 | Boitshelo Tshukudu | `74875510` | — | — | Malotwana Kgotla / Police | `08:00` | **9** | `None` |
| 38 | **`REGISTER 201` (Sheets 1–5)** | 5 Pages | Raymond Baiphethi | `71374706` | Kenewang Ramontsho | `71430259` | Mochudi State Prison | `12:30 - 14:00 hrs` | **55** (7+12+12+12+12; 53 unique names) | `27 Oct` (All 55 rows) |
| 39 | **`REGISTER 202`** | P2 | Katlego Nkatswang | `78247743` | Botho Lindi Phiri | `76616081` | Kgamanyane School | `14:00` | **12** | `27 Oct` (Rows 13–24) |
| 40 | **`REGISTER 220`** | P1 | Oarabile Mokgatse (Makwatse) | `76263830` | — | — | Main Land Board | `15:00` | **10** | `27 Oct` (Rows 1–10) |

---

## 3. Detailed Participant & Facilitator Transcriptions — Numbered Registers 54–220 (Including Register 201)

<!-- Batch 1 (Registers 54–75) -->

### 1. REGISTER 54 (Page 1 of 2)
- **Register No.:** 54
- **Page:** Page 1 of 2
- **Meeting Place:** Lone home Mabodisa
- **Group Leader:** Lone Tsholofeloetso Moitoi (Cell: `74689270` / `76689270`)
- **Second Leader:** None
- **Meeting Time:** 17:00
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.04 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Johanes | Mogotlhwane | M | 67 | 74654953 | Std 4 | S | Unemployed | | 27 Oct | Yes (1) |
| 2 | Chispho | Tshite | M | 54 | 71556974 | JC | S | Unemployed | | 27 Oct | Yes (1) |
| 3 | Seabelo | Moitoi | M | 27 | 75308376 | JC | S | Unemployed | | 27 Oct | Yes (1) |
| 4 | Lephi | Phelagae | M | 68 | 71791216 | Std 7 | S | Pension | | 27 Oct | Yes (1) |
| 5 | Ntuna | Masweu | M | 57 | 71646756 | | S | Unemployed | | 27 Oct | Yes (1) |
| 6 | Kenosi | Motome | M | 61 | 78780142 | JC | S | brick layer | | 27 Oct | Yes (1) |
| 7 | Matlotleng | Tibane | M | 69 | 75845292 | | S | Unemployed | | 27 Oct | Yes (1) |
| 8 | Oralenna (Oralenns) | Noko | F | 43 | 75996996 | S | M | Unemployed | | 27 Oct | Yes (1) |
| 9 | Nkosi | Msiza | M | 44 | 74264654 | S | S | brick layer | | 27 Oct | Yes (1) |
| 10 | Neo | Moitoi | F | 43 | 76206179 | | M | | | 27 Oct | Yes (1) |
| 11 | Jennifer | Letebele | M | 43 | 72441162 | S | | | | 27 Oct | Yes (1) |

---

### 2. REGISTER 58 (Page 2 of 2)
- **Register No.:** 58
- **Page:** Page 2 of 2
- **Meeting Place:** Mmusi P. School
- **Group Leader:** Khutsafalo Kgodungwe (Cell: `72728148`)
- **Second Leader:** Malebogo Setlhabi (Cell: `78675522`)
- **Meeting Time:** 16:30
- **Physical Books Given Note:** N/A *(Page 2 of 2)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.08 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Selinah N. | Masoko | F | 39 | 77775093 | J.C | | VDC | VDC | None | Yes (1) |
| 14 | Maatla T. | Masoko | M | 18 | 77775093 | J.C | | VDC | VDC | None | Yes (1) |
| 15 | Gomoteng | Moremi | M | 30 | 76506421 | J.C | | VDC | VDC | None | Yes (1) |
| 16 | Tsholofelo T. | Bogatsu | F | 40 | 75366644 | J.C | | VDC | VDC | None | Yes (1) |
| 17 | Malebogo | Kgopedi | F | 20 | 76918635 | J.C | | VDC | VDC | None | Yes (1) |
| 18 | Kelebone M. | Sebako | F | 35 | 72593934 | J.C | | VDC | VDC | None | Yes (1) |
| 19 | Goabaone | Motsumi | F | | | | | VDC | VDC | None | Yes (1) |

---

### 3. REGISTER 59 (Page 1 of 2)
- **Register No.:** 59
- **Page:** Page 1 of 2
- **Meeting Place:** Tigers F Club
- **Group Leader:** Babedi Moroope (Cell: `75854127`)
- **Second Leader:** Tebogo E Modisagae (Cell: `76193699`)
- **Meeting Time:** 5:00
- **Physical Books Given Note:** Setswana: `1` | English: `5` *(also annotated `1-SETS`, `5-ENG` at top right)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.44.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Chris L | Moroope | M | | 78150720 | form 5 | Single | nil | nil | 27 Oct | Yes (1) |
| 2 | Omega P | Moroope | M | 23 | 71881194 | form 5 | Single | nil | nil | 27 Oct | Yes (1) |
| 3 | Selinah | Moitoi | F | 39 | 77741676 | form 3 | Single | Office of MP | Cleaner | 27 Oct | Yes (1) |
| 4 | Monich | Moitoi | F | 21 | 77741676 | form 5 | Single | nil | nil | 27 Oct | Yes (1) |
| 5 | ~~Babedi~~ | ~~Moroope~~ | ~~F~~ | ~~52~~ | ~~75854127~~ | ~~form 5~~ | ~~Single~~ | ~~V.DC~~ | ~~V-Secretary~~ | ~~27 Oct~~ | Crossed out (Group Leader; note 1 Setswana + 5 English = 6 books recorded at bottom) |
| 6 | Tshiamelo | Moitoi | M | 22 | 78750305 | form | Single | nil | nil | 27 Oct | Yes (1) |

---

### 4. REGISTER 60 (Page 1 of 2)
- **Register No.:** 60
- **Page:** Page 1 of 2
- **Meeting Place:** Makgophana Kgotla
- **Group Leader:** Babedi Moroope (Cell: `75854127`)
- **Second Leader:** Estuari Modisagae (Cell: `76193699`)
- **Meeting Time:** 12:00
- **Physical Books Given Note:** Setswana: `9` | English: `-` *(also annotated `9-Sets` at top left)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.44 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tebogo P | Rammala | F | 25 | 72693148 | form 5 | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 2 | Neo | Setsoma | F | 26 | 74073466 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 3 | Lore N | Segetlong | F | 27 | 76322542 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 4 | Mmakose | Makole | F | 50 | 72434046 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 5 | Botho Willy | Molefe | M | 29 | 73927403 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 6 | Olerato Dorcas | Makoba | F | 30 | 76194080 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 7 | Edwin Kabo | Ntesang | M | 22 | 75354720 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 8 | Dennis Ofentse | Rasedie | M | 22 | 76145617 | | Single | Ikageng | worker | 27 Oct | Yes (1) |
| 9 | Kelebogile B | Ratladi | F | 25 | 78085708 | | Single | Ikageng | worker | 27 Oct | Yes (1) |

---

### 5. REGISTER 63 (Page 1 of 2)
- **Register No.:** 63
- **Page:** Page 1 of 2
- **Meeting Place:** Makgophana Kgotla
- **Group Leader:** Tebogo E Modisagae (Cell: `76193699`)
- **Second Leader:** Babedi Moroope (Cell: `75854127`)
- **Meeting Time:** 7:00
- **Physical Books Given Note:** Setswana: `6` | English: `6`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.58 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | David | Tladi | M | | 72173317 | | Married | Tribal | Kgosi | 27 Oct | Yes (1) |
| 2 | Martin | Moiste (Moitse) | M | | 75693699 | | Widow | Tribal | Kgosi | 27 Oct | Yes (1) |
| 3 | Ireen | Tsheole | F | | 77967735 | Form 5 | Single | VDC | V-Secretary | 27 Oct | Yes (1) |
| 4 | Joyce | Moeng | F | 58 | 72269621 | STD 7 | Single | VDC | Treasurer | 27 Oct | Yes (1) |
| 5 | Nthotlwane | Sakeng | F | 55 | 71564667 | Form 3 | Married | VDC | Add member | 27 Oct | Yes (1) |
| 6 | Serufe | Masilo | F | 55 | 72217317 | STD 7 | Widow | VDC | Add member | 27 Oct | Yes (1) |
| 7 | Bobo | Molefe | F | 60 | 74088445 | STD 7 | Single | VDC | Add-Member | 27 Oct | Yes (1) |
| 8 | Thato | Mosote | F | 49 | 72719592 | Form 3 | Single | VDC | Add Member | 27 Oct | Yes (1) |
| 9 | Tebogo | Modisagae | F | 50 | 76193699 | Form 2 | Single | VDC | Add-Member | 27 Oct | Yes (1) |
| 10 | Balegi | Mowane | F | 63 | 71852673 | STD 5 | Single | Ikageng | Worker | 27 Oct | Yes (1) |
| 11 | Tshepiso | Mmokwa | F | 27 | | | Single | Ikageng | Worker | 27 Oct | Yes (1) |
| 12 | Outumetse | Moeng | M | 32 | 71767140 | Form 3 | Single | Ikageng | Worker | 27 Oct | Yes (1) |

---

### 6. REGISTER 65 (Page 1 of 2)
- **Register No.:** 65
- **Page:** Page 1 of 2
- **Meeting Place:** Home Mabodisa
- **Group Leader:** Sharon T. B. Phiri (Cell: `72804348`)
- **Second Leader:** None
- **Meeting Time:** 17:30
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.54 (3).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Thatsimo | Phefo | F | 16 | 77062810 | Form 3 | S | - | - | 27 Oct | Yes (1) |
| 2 | Lebopo | Molefe | F | 16 | 75026508 | Form 3 | S | - | - | 27 Oct | Yes (1) |
| 3 | Jane L. | Ramoobya | F | 44 | 75018144 | Diploma Interior | S | African Wed Magazine | Editor | 27 Oct | Yes (1) |
| 4 | Juliet | Molefe | F | 26 | 72585742 | BGCSE | S | - | - | 27 Oct | Yes (1) |

---

### 7. REGISTER 72 (Page 1 of 2)
- **Register No.:** 72
- **Page:** Page 1 of 2
- **Meeting Place:** VDC Offices Moganetsi Kgotla
- **Group Leader:** Seanokeng Nkope Molefe (Cell: `72422804`)
- **Second Leader:** Tefo Simane (Cell: `72799040`)
- **Meeting Time:** 7:30
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.47 (3).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bonang | Letsepe | F | 40 | 71260119 | BGCSE | Married | VDC | | 28 Oct | Yes (1) |
| 2 | Beauty Naomi | Molefe | F | 52 | 77022556 | BGCSE | S | VDC | | 28 Oct | Yes (1) |
| 3 | Boitshoko Nelly | Molefe | F | 48 | 74282913 | JC | S | VDC | | 28 Oct | Yes (1) |
| 4 | Batsile | Seroke | F | 43 | 76618937 | BGCSE | S | VDC | | 28 Oct | Yes (1) |
| 5 | Linda | Moremi | F | 73 | 77127217 | JC | S | VDC | | 28 Oct | Yes (1) |
| 6 | Salome | Moakofi | F | 42 | 77030776 | BGCSE | S | VDC | | 28 Oct | Yes (1) |
| 7 | Tumisang K | Molefe | F | 34 | 76330831 | JC | S | Ikageng | | 28 Oct | Yes (1) |
| 8 | Kesego Orapeleng | Molefe | F | 29 | 75373071 | BGCSE | S | Ikageng | | 28 Oct | Yes (1) |
| 9 | Wesley | Molefe | M | 26 | 75157396 | JC | S | Ikageng | | 28 Oct | Yes (1) |
| 10 | Tumisang Thomo | Bathai | M | 27 | 75796095 | BGCSE | S | Ikageng | | 28 Oct | Yes (1) |
| 11 | Bokang Funny | Basejane | M | 32 | 77464883 | BGCSE | Married | Ikageng | | 28 Oct | Yes (1) |
| 12 | Katlarelo Mogi S. | Basejane | F | 26 | 72913240 | BGCSE | Married | Ikageng | | 28 Oct | Yes (1) |

---

### 8. REGISTER 73 (Page 1 of 2)
- **Register No.:** 73
- **Page:** Page 1 of 2
- **Meeting Place:** Masiana Kgotla
- **Group Leader:** Neo Matlhaga (Cell: `77036887`)
- **Second Leader:** None
- **Meeting Time:** 1700 HRS
- **Physical Books Given Note:** Setswana: `1` | English: `9`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.57.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Lesedi | Sefako | F | 40 | 72411917 | TERTIARY | S | N/A | N/A | 27 Oct | Yes (1) |
| 2 | Sethunya | Mosalagae | M | | | | S | N/A | N/A | 27 Oct (marked X) | Yes (1) |
| 3 | Neo | Mashabe | F | 43 | 72821023 | BGCSE | S | N/A | N/A | 27 Oct | Yes (1) |
| 4 | Elizabeth | Ramedupe | F | 63 | 71920463 | TERTIARY | S | N/A | N/A | 27 Oct | Yes (1) |
| 5 | Moshe | Montlane | M | | | PSLE | S | N/A | N/A | 27 Oct (marked X) | Yes (1) |
| 6 | Gosego | Rammala | F | 35 | 74089834 | PSLE | S | N/A | N/A | 27 Oct | Yes (1) |
| 7 | Tshepang | Matlhaga | M | 21 | 75636159 | BGCSE | S | N/A | N/A | 27 Oct | Yes (1) |
| 8 | Bokang | Kgaupe | M | 17 | 77879361 | IGCSE | S | N/A | N/A | 27 Oct | Yes (1) |
| 9 | Lindy | Sefako | F | 36 | 76192605 | BGCSE | S | N/A | N/A | 27 Oct | Yes (1) |
| 10 | Gaone | Tsele | F | 26 | 76771090 | BGSCE (BGCSE) | S | N/A | N/A | 27 Oct | Yes (1) |

---

### 9. REGISTER 75 (Page 1 of 2)
- **Register No.:** 75
- **Page:** Page 1 of 2
- **Meeting Place:** Ntshinoge, Next to Kagiso Bar
- **Group Leader:** Seanokeng Selala (Cell: `71803346`)
- **Second Leader:** Rivonia M Tlhase (Cell: `77060006`)
- **Meeting Time:** 17:30
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.55 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tebogo Seipati | Phefo | F | 41 | 71745715 | BGCSE | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 2 | Esther | Phefo | F | 53 | 77664324 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 3 | Tshenolo Jenny | Makgale | F | 43 | 76462412 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 4 | Tebogo | Mmale | F | 31 | 74371673 | Tertiary | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 5 | Banyanabotlhe | Mmale | F | 30 | 75326465 | BGCSE | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 6 | Rhoda | Phineas | F | 34 | 77657170 | Tertiary | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 7 | Bontsi | Molefe | F | 34 | 74007631 | Tertiary | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 8 | Galenkute | Bandi | F | 36 | 78486928 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 9 | Mpho | Mangole | F | 50 | 74800441 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 10 | Omphile | Sepotoke | F | 20 | 78516891 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 11 | Tebogo | Mariri | F | 47 | 75203799 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 12 | Keneilwe | Sepotoke | F | 23 | 71868528 | JC | S | | UNEMPLOYED | 27 Oct | Yes (1) |

---

### 10. REGISTER 75 (Page 2 of 2)
- **Register No.:** 75
- **Page:** Page 2 of 2
- **Meeting Place:** Ntshinoge Next to Kagiso Bar
- **Group Leader:** Seanokeng Selala (Cell: `71803346`)
- **Second Leader:** Rivonia M Tlhase (Cell: `77060006`)
- **Meeting Time:** 17:30
- **Physical Books Given Note:** N/A *(Page 2 of 2)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.55.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Oratile | Sepotoke | F | | 78254253 | | S | | UNEMPLOYED | 27 Oct | Yes (1) |
| 14 | Precious Kefilwe | Paledi (Palepi) | F | 30 | 75244420 | BGCSE | S | | UNEMPLOYED | 27 Oct | Yes (1) |

---

<!-- Batch 2 (Registers 85–121) -->

### 1. REGISTER 85 (Page 1 of 2)
- **Register No.:** REGISTER 85
- **Page:** Page 1 of 2
- **Meeting Place:** Makgophana ward
- **Group Leader:** Bogolo Motloi (Cell: 76418118)
- **Second Leader:** Mathata Sarah Molefe (Cell: 78354037)
- **Meeting Time:** 12:30 HRS
- **Physical Books Given Note:** Setswana: 6 | English: 3
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.58.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mmamasedinyane | Motloi | F | 33 | 77133122 | Form 3 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 2 | Game | Mfosi | F | 23 | 78111835 | Form 3 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 3 | Heo | Lephoiwe | F | 50 | 71585372 | Form 2 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 4 | Madia | Lephoiwe | M | 20 | 74305539 | Form 5 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 5 | Mmatsebe | Mabote | F | 50 | 72434046 | STD 7 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 6 | Onalenna | Motloi | F | 34 | 72550169 | Form 3 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 7 | Janet | Letlole | F | 24 | 78155419 | Form 5 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 8 | Kedibonye Maradis | Motloi | F | 53 | 75778066 | STD 7 | Single | Makgophana | - | 27 Oct | Yes (1) |
| 9 | Bame | Kgatele | F | 24 | 78518970 | Form 5 | Single | Makgophana | - | 27 Oct | Yes (1) |

---

### 2. REGISTER 98 (Page 2 of 2)
- **Register No.:** REGISTER 98
- **Page:** Page 2 of 2
- **Meeting Place:** PILANE KGOTLA
- **Group Leader:** Alecan Kotsedi (Cell: 74190365)
- **Second Leader:** Phoesimo Sello (Cell: 78247718)
- **Meeting Time:** 12:00
- **Physical Books Given Note:** Setswana: N/A (Page 2) | English: N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.03 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Boipuso | Modimakwane | F | 30 | 72415895 | JC | Single | Police Volunteer | - | 27 Oct | Yes (1) |
| 14 | Pearl | Khutsafalo | F | 39 | 71416081 | BGCSE | Single | BPS | - | 27 Oct | Yes (1) |

---

### 3. REGISTER 104 (Page 1 of 2)
- **Register No.:** REGISTER 104
- **Page:** Page 1 of 2
- **Meeting Place:** Boseja
- **Group Leader:** Josephane Mathibe (Cell: 71565643 / 75009303)
- **Second Leader:** Mpo Ramotho (Cell: 73091462 / 72548023)
- **Meeting Time:** 3:00 pm
- **Physical Books Given Note:** Setswana: 6 | English: 4
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.01 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Theo M | Kotsedi | M | 25 | 75590365 | JCE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 2 | Boemo V. | Mapotsane | F | 21 | 72729904 | JCE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 3 | Neo | Mogobye | F | 37 | 72548023 | BGCSE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 4 | Matlhedi | Motshega | F | 54 | 72168675 | PSLE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 5 | Rosinah | Mathibe | F | 59 | 72558284 | PSLE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 6 | Mosidi | Mathibe | F | 52 | 74387954 | PSLE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 7 | Themba | Montsho | M | 33 | 75396098 | JCE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 8 | Prince | Selwe | M | 23 | 78480660 | JCE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 9 | Phokwane | Phale | F | 60 | 72269086 | Cambridge | M | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 10 | Sello | Mathibe | M | 52 | 78475171 | JCE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 11 | Junior | Mathibe | M | 23 | 75394483 | BGCSE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |
| 12 | Gomolemo | Mathibe | F | 21 | 78475437 | BGCSE | S | Boseja ward | Unemployed | 27 Oct | Yes (1) |

---

### 4. REGISTER 106 (Page 1 of 2)
- **Register No.:** REGISTER 106
- **Page:** Page 1 of 2
- **Meeting Place:** BOSEJA BEHIND IPCC
- **Group Leader:** LEBOGANG MAKGALA (Cell: 75966118)
- **Second Leader:** None
- **Meeting Time:** 5:00 - 6:30 PM
- **Physical Books Given Note:** Setswana: 9 (amended from 12; top note: `9 - Sets, 4 - Eng`) | English: 4
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.42 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Comfort | Dikutu | M | 19 | 78386413 | JC | Single | Boseja Behind IPCC | - | None | Yes (1) |
| 2 | Lone | Letsebe | F | 17 | 71380758 | BG | Single | Boseja Behind IPCC | Student | 27 Oct | Yes (1) |
| 3 | Ladiah | Ntoampe | F | 23 | 75310426 | BG | Single | Boseja Behind IPCC | Student | None | Yes (1) |
| 4 | Emmah | Mfosi | F | 30 | 71148855 | JC | Single | Boseja Behind IPCC | - | 27 Oct | Yes (1) |
| 5 | Kefilwe | Moeng | F | 27 | 77159938 | JC | Single | Boseja Behind IPCC | - | 27 Oct | Yes (1) |
| 6 | Ratiwa | Pilane | F | 20 | 77378279 | JC | Single | Boseja Behind IPCC | - | 27 Oct | Yes (1) |
| 7 | Amogelang | Kube | F | 33 | 76490891 | BGCSE | Single | Boseja Behind IPCC | - | 27 Oct | Yes (1) |
| 8 | Dimpho | Letshwiti | F | - | 75348000 | JC | Single | Boseja Behind IPCC | - | None | Yes (1) |
| 9 | Masego | Letshwiti | F | - | 74509481 | JC | Single | Boseja Behind IPCC | - | None | Yes (1) |
| 10 | Steven | Makgale | M | 17 | 76314906 | BGCSE | Single | Boseja Behind IPCC | Student | 27 Oct | Yes (1) |
| 11 | Victor | Manyika | M | 27 | 72157477 | BGCSE | Single | Boseja Behind IPCC | - | 27 Oct | Yes (1) |
| 12 | Mmalo | Letsebe | F | 47 | 75344121 | PSLE | Single | Boseja Behind IPCC | - | None | Yes (1) |

---

### 5. REGISTER 107 (Page 1 of 2)
- **Register No.:** REGISTER 107
- **Page:** Page 1 of 2
- **Meeting Place:** Lady Mitchison School
- **Group Leader:** Thabang P. Modimakwane (Cell: 72993400)
- **Second Leader:** None
- **Meeting Time:** 07:30 hrs
- **Physical Books Given Note:** Setswana: 15 | English: 2
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.41 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kgomotso | Nyepetsi | F | 56 | 71571676 | JC | S | - | - | 27 Oct | Yes (1) |
| 2 | Pinkie | Chelane | F | 48 | 76129695 | JC | S | - | - | 27 Oct | Yes (1) |
| 3 | Hildah O | Sekokome | F | - | - | - | - | - | - | None | Yes (1) |
| 4 | Boitumelo | Ramolepa | F | - | - | - | - | - | - | None | Yes (1) |
| 5 | Seikgokgoni | Phale | F | - | - | - | - | - | - | None | Yes (1) |
| 6 | Gadipele | Mpetane | F | - | - | - | - | - | - | None | Yes (1) |
| 7 | Hildah | Motumi | F | - | - | - | - | - | - | None | Yes (1) |
| 8 | Dineo | Lebekwe | F | - | - | - | - | - | - | None | Yes (1) |
| 9 | Mmapula | Motshwanele | F | 60 | 74415180 | JCE | W | - | Unemployed | 27 Oct | Yes (1) |
| 10 | Sebokikanye | Molefe | F | 43 | 72235738 | BGCSE | S | Red Star | Cashier | 27 Oct | Yes (1) |
| 11 | Emmah | Modise | F | 41 | 75479102 | Tertiary | S | Unemployed | - | 27 Oct | Yes (1) |
| 12 | Remy | Modimakwane | M | 21 | 76516677 | JC | S | - | Self-employed | 27 Oct | Yes (1) |

---

### 6. REGISTER 107 (Page 2 of 2)
- **Register No.:** REGISTER 107
- **Page:** Page 2 of 2
- **Meeting Place:** Neighbours
- **Group Leader:** Thabang P. Modimakwane (Cell: 72993400)
- **Second Leader:** None
- **Meeting Time:** 07:30 hrs
- **Physical Books Given Note:** Setswana: N/A (Page 2; recorded on Page 1 as 15) | English: N/A (Page 2; recorded on Page 1 as 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.41.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Naledi | Modimakwane | F | 45 | 77446622 | JC | S | - | Self-employed | 27 Oct | Yes (1) |
| 14 | Anastacia | Modimakwane | F | 51 | 72227277 | JC | S | - | Unemployed | 27 Oct | Yes (1) |
| 15 | Connie | Modise | F | 65 | 74551346 | JC | M | - | Unemployed | 27 Oct | Yes (1) |
| 16 | Refilwe | Motswanele | F | 12 | 72993400 | P | S | - | Student | 27 Oct | Yes (1) |
| 17 | Theo | Motswanele | M | 15 | 72993400 | J | S | - | Student | 27 Oct | Yes (1) |

---

### 7. REGISTER 108 (Page 1 of 2)
- **Register No.:** REGISTER 108
- **Page:** Page 1 of 2
- **Meeting Place:** PLOT 8285 BOSEJA SOUTH
- **Group Leader:** ONKARABILE MLAMBO (Cell: 73192609)
- **Second Leader:** None
- **Meeting Time:** 16:30
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.51 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ontuetse Keletso | Sefako | F | 34 | 75730571 | Senior | Single | Ikageng | - | 27 Oct | Yes (1) |
| 2 | Kesilwe Maureen | Onkarabile | F | 42 | 74511473 | Tertiary | Single | Ikageng | - | 27 Oct | Yes (1) |
| 3 | Gadifele | Tsheko | F | 50 | 74812060 | Junior | Single | Ikageng | - | 27 Oct | Yes (1) |
| 4 | Segeng Ethel | Mmolotsi | F | 52 | 74824243 / 71735379 | Senior | Single | Ikageng | - | 27 Oct | Yes (1) |
| 5 | Dijeng | Tabane | F | 58 | - | Primary | Widower | Ikageng | - | None | Yes (1) |
| 6 | Motlalepula | Letshwiti | F | 48 | 74151538 | Junior | Divorced | Ikageng | - | 27 Oct | Yes (1) |
| 7 | Kefilwe Boipelo | Nkete | F | 36 | 76724929 | Senior | Single | Ikageng | - | 27 Oct | Yes (1) |
| 8 | Lerato | Nkgeng | F | 38 | 75759346 | Junior | Single | Ikageng | - | 27 Oct | Yes (1) |
| 9 | Mitchell | Mlambo | F | 21 | 78363055 | Junior | Single | Ikageng | - | 27 Oct | Yes (1) |

---

### 8. REGISTER 116 (Page 1 of 2)
- **Register No.:** REGISTER 116
- **Page:** Page 1 of 2
- **Meeting Place:** MORWA, PLOT 19518 AFTER MAIN KGOTLA
- **Group Leader:** OOKABETSE K. RAMORE (Cell: 75349459)
- **Second Leader:** ONKABETSE RAMOTSEI (Cell: 75686300)
- **Meeting Time:** 17:00 HRS
- **Physical Books Given Note:** Setswana: 9 | English: 10
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.42 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Magdeline | Molefe | F | 58 | 76204279 | STD 7 | S | Ikageng | General Worker | 27 Oct | Yes (1) |
| 2 | Mpho | Mogwakgono | F | 44 | 75497047 | Form 5 | S | Ikageng | General Worker | 27 Oct | Yes (1) |
| 3 | Dimpho | Molefe | F | 34 | 76149688 | BGCSE | S | N/A | N/A | 27 Oct | Yes (1) |
| 4 | Katlo | Masire | M | 14 | 72689486 | Form 2 | S | Kgamanyane CJSS | Student | 27 Oct | Yes (1) |
| 5 | Modie | Mooketsi | F | 62 | 71270163 | STD 7 | S | Ikageng | General Worker | 27 Oct | Yes (1) |
| 6 | Janet | Pone | F | 13 | 71596708 | STD 7 | S | Linchwe Primary | Student | 27 Oct | Yes (1) |
| 7 | Abigail | Pone | F | 16 | 71596708 | Form 2 | S | Kgamanyane CJSS | Student | 27 Oct | Yes (1) |
| 8 | Boineelo | Sesigo | F | 15 | 74085702 | Form 2 | S | Kgamanyane CJSS | Student | 27 Oct | Yes (1) |
| 9 | Marang | Kgwakgwana | F | 19 | 76382063 | Form 3 | S | N/A | N/A | 27 Oct | Yes (1) |
| 10 | Alex | Molemi | M | 19 | 76357269 | Form 3 | S | N/A | N/A | 27 Oct | Yes (1) |
| 11 | Dikhalapo | Molefe | F | 20 | 76211492 | Form 3 | S | Ikageng | General Worker | 27 Oct | Yes (1) |
| 12 | Baitshoki | Malebye | M | 21 | 78437074 | Form 5 | S | N/A | N/A | 27 Oct | Yes (1) |

---

### 9. REGISTER 116 (Page 2 of 2)
- **Register No.:** REGISTER 116
- **Page:** Page 2 of 2
- **Meeting Place:** MORWA, PLOT 19518 AFTER MAIN KGOTLA
- **Group Leader:** OOKABETSE K. RAMORE (Cell: 75349459)
- **Second Leader:** ONKABETSE RAMOTSEI (Cell: 75686300)
- **Meeting Time:** 17:00 HRS
- **Physical Books Given Note:** Setswana: N/A (Page 2; recorded on Page 1 as 9) | English: N/A (Page 2; recorded on Page 1 as 10)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.42.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Kutlo | Makgatlhe | M | 20 | 78261105 | Form 3 | S | N/A | N/A | 27 Oct | Yes (1) |
| 14 | Kevin | Pilane | M | 15 | 74679594 | Form 2 | S | Kgamanyane CJSS | Student | 27 Oct | Yes (1) |
| 15 | Katlo | Lebekwe | M | 14 | 77306879 | Form 1 | S | Linchwe CJSS | Student | 27 Oct | Yes (1) |
| 16 | Tshegofatso | Mosate | F | 13 | 76194898 | STD 7 | S | Isang Primary | Student | 27 Oct | Yes (1) |
| 17 | Normah | Mosomotsi | F | 11 | 76199058 | STD 5 | S | Segale Primary | Student | 27 Oct | Yes (1) |
| 18 | Sharon | Molefe | F | 10 | 78532151 | STD 5 | S | Isang Primary | Student | 27 Oct | Yes (1) |
| 19 | Tlotlo | Molefe | F | 11 | 76149088 | STD 5 | S | Isang Primary | Student | 27 Oct | Yes (1) |

---

### 10. REGISTER 121 (Page 1 of 2)
- **Register No.:** REGISTER 121
- **Page:** Page 1 of 2
- **Meeting Place:** Pavement Route 9, Phaphane, Slices
- **Group Leader:** BOJELO MMAKGAGO (Cell: 77649805)
- **Second Leader:** LESEGO MOTHOFELA (Cell: 77040635)
- **Meeting Time:** 2:00 pm
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.10.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Modise | Molefe | M | 63 | 75040208 | - | Single | - | - | None | Yes (1) |
| 2 | Oarabile G. | Nthole | F | 34 | 77021323 | Senior | Single | - | - | None | Yes (1) |
| 3 | Maipelo A. | Matswe | F | 40 | 76921267 / 7540562 | BGCSE / Senior | Single | - | - | None | Yes (1) |
| 4 | Daise | Makola | F | 33 | 74477464 | Senior | Single | - | - | None | Yes (1) |
| 5 | Bathuti | Dingopo | F | 39 | 77363182 | Primary | Single | - | - | None | Yes (1) |
| 6 | Kgomotso | Mangadi | F | 59 | 72143924 | Primary | Single | - | - | None | Yes (1) |
| 7 | Bathusi | Rahube | F | 40 | 76429796 | Junior | Married | - | - | None | Yes (1) |
| 8 | Tefo | Nyepetsi | M | 26 | 7255097 | College | Single | - | - | None | Yes (1) |
| 9 | Gabadise | Legotse | M | 57 | 72660454 | Primary | Single | - | - | None | Yes (1) |
| 10 | Nnani | Nthole | F | 72 | 71481067 | Primary | Single | - | - | None | Yes (1) |

---

<!-- Batch 3 (Registers 129–159) -->

### 1. REGISTER 129 (Page 1 of 2)
- **Register No.:** REGISTER 129
- **Page:** Page 1 of 2
- **Meeting Place:** WILDLIFE & NATIONAL PARKS
- **Group Leader:** Boago Lekaowa & Wabo Venda (Cell: `77326267`)
- **Second Leader:** Wabo Venda (Cell: `[Blank]`)
- **Meeting Time:** `14:00 HRS`
- **Physical Books Given Note:** Setswana: `[Blank]` / English: `[Blank]`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.51 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | B. S. | Rakhudu | M | 51 | 73390783 | JC | S | [Blank] | APO | 27 Oct | Yes (1) |
| 2 | M. T. | Peolwane | F | 47 | 74282037 | JC | S | [Blank] | Cleaner | 27 Oct | Yes (1) |
| 3 | L. P. | Moathodi | F | 28 | 75097972 | BGCSE | S | [Blank] | Attachment | 27 Oct | Yes (1) |
| 4 | K. | Montshiwa | M | 40 | 75285047 | M Ed | S | [Blank] | Lecture 1 | 27 Oct | Yes (1) |
| 5 | K. | Mlangeni | F | 55 | 71585331 | PSLE | S | [Blank] | Messenger | 27 Oct | Yes (1) |
| 6 | O. | Letswakgosi | F | 57 | 72504696 | DIPLOMA | M | [Blank] | SWW | None | Yes (1) |
| 7 | B. N. | Kobe | F | 54 | 74386515 | DIPLOMA | M | [Blank] | SWW | None | Yes (1) |
| 8 | S. S. | Setshwane | M | 47 | 77973266 | Certificate | M | [Blank] | SWW II | None | Yes (1) |
| 9 | T. | Mokgetlhane | F | 46 | 71784707 | JC | M | [Blank] | Cleaner | 27 Oct | Yes (1) |
| 10 | M. | Sentsho | M | 37 | 76537466 | JC | S | [Blank] | Groundsman | 27 Oct | Yes (1) |
| 11 | L. | Marobane | M | 31 | 72892506 | JC | S | [Blank] | Groundsman | 27 Oct | Yes (1) |

---

### 2. REGISTER 132 (Page 1 of 2)
- **Register No.:** REGISTER 132
- **Page:** Page 1 of 2
- **Meeting Place:** MAKGOPHANA
- **Group Leader:** ONICAH RAMMALA (Cell: `71464954`)
- **Second Leader:** `[Blank]` (Cell: `[Blank]`)
- **Meeting Time:** `1000HRS`
- **Physical Books Given Note:** Setswana: `[Blank]` / English: `[Blank]`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.53 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Serufe | Masilo | F | 57 | 72217317 | Form 3 | M | Unemployed | Business p | 27 Oct | Yes (1) |
| 2 | Matlhodi | Rammala | F | 80 | 76398553 | Std 7 | M | Unemployed | Farmer | 27 Oct | Yes (1) |
| 3 | Dora | Rakgati | F | 72 | 75952750 | Std 7 | M | Unemployed | Farmer | 27 Oct | Yes (1) |
| 4 | Sonia | Modise | F | 68 | 74025719 | Form 3 | S | Unemployed | Domestic worker | 27 Oct | Yes (1) |
| 5 | John | Palai | M | 76 | 76124457 | Std 7 | M | Unemployed | Farmer | 27 Oct | Yes (1) |

---

### 3. REGISTER 136 (Page 1 of 2)
- **Register No.:** REGISTER 136
- **Page:** Page 1 of 2
- **Meeting Place:** Makgophana Clinic
- **Group Leader:** Olebogeng Felwane (Cell: `75991025`)
- **Second Leader:** Boitumelo Moeng (Cell: `75412919`)
- **Meeting Time:** `13:00`
- **Physical Books Given Note:** Setswana: `6` / English: `6`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.00 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Lemogang | Maribe | F | 25 | 75731918 | BGCSE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 2 | Kitso | Motshetsi | F | 26 | 72563311 | BGCSE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 3 | Naledi | Keakopile | F | 30 | 74056788 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 4 | Wabo | Venda | F | 28 | 755076 | BGCSE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 5 | Onkabile | Nkwane | F | 38 | 77491167 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 6 | Grace | Ramonyane | F | 28 | 77089359 | BGCSE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 7 | Phenyo | Maleke | F | 26 | 78395292 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 8 | Keneilwe | Mokgatla | F | 43 | 76074242 / 76974126 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 9 | Tshegofatso | Tshephe | F | 44 | 71766768 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 10 | Motlaletsi | Felwane | F | 47 | 74212098 / 77670925 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 11 | Olebetse P. | Letsholo | F | 30 | 75627525 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 12 | Mpokeng | Polwane | F | 29 | 78129328 | JCE | S | Makgophana | NIL | 27 Oct | Yes (1) |

---

### 4. REGISTER 141 (Page 1 of 2)
- **Register No.:** REGISTER 141
- **Page:** Page 1 of 2
- **Meeting Place:** MMADIPAMO P. SCH
- **Group Leader:** MRS S. SIKWANE (Cell: `75493040`)
- **Second Leader:** `[Blank]` (Cell: `[Blank]`)
- **Meeting Time:** `14:30hrs`
- **Physical Books Given Note:** Setswana: `[Blank]` / English: `[Blank]`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.50 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | G. M. | Poroga | F | 62 | 73350825 / 72226340 | U | S | MMADIPAMO P. SCH | TEACHER | 27 Oct | Yes (1) |
| 2 | L. | Bathusi | F | 37 | 72925400 / 74297642 | U | M | MMADIPAMO | TEACHER | 27 Oct | Yes (1) |
| 3 | M. | Motshegwe | F | 27 | 74381104 | U | S | MMADIPAMO | T.S.P | 27 Oct | Yes (1) |
| 4 | D. | Koitswe | F | 26 | 76637213 | U | S | MMADIPAMO | T.S.P | 27 Oct | Yes (1) |
| 5 | O. | Medupe | F | 27 | 71509706 | U | S | MMADIPAMO | T.S.P | 27 Oct | Yes (1) |
| 6 | D. | Modu | F | 34 | 77110112 | C | M | MMADIPAMO | AIDE | 27 Oct | Yes (1) |
| 7 | E. M. | Bapodile | F | 59 | 74782611 | C | S | MMADIPAMO SCHOOL | TEACHER | 27 Oct | Yes (1) |
| 8 | H. K. | Tladi | F | 47 | 75513362 | S | S | Mmadipamo | GDA | 27 Oct | Yes (1) |
| 9 | M. | Madimabe | M | 36 | 73525655 | U | S | MMADIPAMO | TEACHER | 27 Oct | Yes (1) |
| 10 | T. K. | Tau | F | 40 | 76257861 | C | S | MMADIPAMO | TEACHER | 27 Oct | Yes (1) |
| 11 | L. | Motho | M | 22 | 78116044 | JC | M | Mmadipamo | T.S.P | 27 Oct | Yes (1) |
| 12 | M. | Meswele | F | 49 | 77190311 | COSC | M | Mmadipamo | COOK | 27 Oct | Yes (1) |

---

### 5. REGISTER 141 (Page 2 of 2)
- **Register No.:** REGISTER 141
- **Page:** Page 2 of 2
- **Meeting Place:** Mmadipamo P School
- **Group Leader:** Mrs S. Sikwane (Cell: `75493040`)
- **Second Leader:** `[Blank]` (Cell: `[Blank]`)
- **Meeting Time:** `14:30hrs`
- **Physical Books Given Note:** Setswana: `[Blank]` / English: `[Blank]`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.50.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Baruti Aaron | Rakgati | M | 25 | 71534197 | JC | S | Mmadipamo Primary School | T.S.P | 27 Oct | Yes (1) |
| 14 | T. S. | Golebetswe | F | 27 | 72324155 | C | S | Mmadipamo Primary School | Temp Teacher aide | 27 Oct | Yes (1) |
| 15 | M. | Moirapula | F | 44 | 74009870 | U | S | Mmadipamo P. School | Teacher | 27 Oct | Yes (1) |

---

### 6. REGISTER 143 - Group 1 (Page 1 of 2 - Thato Mosate)
- **Register No.:** REGISTER 143 (Group 1)
- **Page:** Page 1 of 2
- **Meeting Place:** Makgophana
- **Group Leader:** Thato Mosate (Cell: `78719592`)
- **Second Leader:** Nthabiseng Mfosi (Cell: `76920501`)
- **Meeting Time:** `07:00`
- **Physical Books Given Note:** Setswana: `8` / English: `3`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.45 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Khamo | Nkgoeng | F | 41 | 71887509 | J | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 2 | Tlamelo | Rakereng | F | 22 | 75386758 | S | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 3 | Kalaapere | Phuswane | F | 46 | 78174217 | [Blank] | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 4 | Mpuseng | Ratladi | F | 37 | 78125729 | J | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 5 | Meduo | Selatlhwe | F | 42 | 71735712 | J | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 6 | Queen | Rakgati | F | 39 | 74083737 | J | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 7 | Mpho | Kgotlele | M | 57 | 72439790 | NIL | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 8 | Joel | Modibedi | M | 63 | 72624232 | J | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 9 | Bameelo Julia | Mosate | F | 21 | [Blank] | S | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 10 | Onica P. | Medupe | F | 27 | 76997249 | [Blank] | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 11 | Kemo | Mosate | F | 23 | 71879546 | S | S | Makgophana | NIL | 27 Oct | Yes (1) |

---

### 7. REGISTER 143 - Group 2 (Page 1 of 2 - Bakeng Thabiso Molefe)
- **Register No.:** REGISTER 143 (Group 2)
- **Page:** Page 1 of 2
- **Meeting Place:** Kwa Maswena
- **Group Leader:** Bakeng Thabiso Molefe (Cell: `76312112`)
- **Second Leader:** `[Blank]` (Cell: `[Blank]`)
- **Meeting Time:** `14:00`
- **Physical Books Given Note:** Setswana: `8` / English: `4`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.57 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ramagonono | Maswena | M | 68 | 74134442 | PSLE | M | Makgophana | NIL | 27 Oct | Yes (1) |
| 2 | Keleboga | Maswena | F | 46 | 74668016 | JCC | M | Makgophana | NIL | 27 Oct | Yes (1) |
| 3 | Neo | Setsuma | F | 26 | 74073465 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 4 | Moletedi | Pitse | F | 33 | 72117630 | BJSE | M | Makgophana | NIL | 27 Oct | Yes (1) |
| 5 | Thabang | Pitse | M | 37 | 78048846 | G4C | M | Makgophana | NIL | 27 Oct | Yes (1) |
| 6 | Boikanyo Pearl | Tlhase | F | 28 | 72729645 | BJSE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 7 | Francheny | Molefe | F | 43 | 72226786 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 8 | Neo | Molefe | F | 39 | 76277302 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 9 | Kakanyo | Setsuma | M | 23 | 77420564 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 10 | Bontle Amanda | Molefe | F | 26 | 72918174 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 11 | Rekoone Gloria | Molefe | F | 23 | 75697490 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 12 | Boitsung | Molefe | F | 47 | 75569686 | JCC | S | Makgophana | NIL | 27 Oct | Yes (1) |

---

### 8. REGISTER 143 - Group 3 (Page 1 of 2 - Bakang Modise)
- **Register No.:** REGISTER 143 (Group 3)
- **Page:** Page 1 of 2
- **Meeting Place:** Bogatsu Primary School (Makgophana)
- **Group Leader:** Bakang Modise (Cell: `74704731`)
- **Second Leader:** Lumediso Ellen Mfosi (Cell: `76381950`)
- **Meeting Time:** `12:30`
- **Physical Books Given Note:** Setswana: `3` / English: `11`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.01.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Keanole | Mfosi | F | 43 | 77725944 | JCE | M | Makgophana | NIL | 27 Oct | Yes (1) |
| 2 | Keneilwe | Ramhale | F | 29 | 78176109 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 3 | Kaone | Kgotlele | F | 26 | 78530544 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 4 | Laika Goitseone Gofaone | Bodumetse | F | 18 | 78150700 | BGCSE | S | Makgophana | NIL | 27 Oct | Yes (1) |
| 5 | Maatla | Segotso | F | 26 | 74073465 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 6 | Bertha | Mmamogwe | F | 23 | 77159978 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 7 | Keamogetse | Serohe | F | 27 | 76255382 | BGCSE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 8 | Kelebogile | Malebye | F | [Blank] | 78166499 | BGCSE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 9 | Segametsi | Kopong | F | [Blank] | 74351402 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 10 | Emeldah D. | Peolwane | F | [Blank] | 74714375 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 11 | Banyana Goetlo | Pheto | F | [Blank] | 76651275 | JCE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 12 | Matilda Tuduetso | Peolwane | F | [Blank] | 74714568 | Certificate in records | S | Makgophana | TS | 27 Oct | Yes (1) |

---

### 9. REGISTER 143 - Group 3 (Page 2 of 2 - Bakang Modise)
- **Register No.:** REGISTER 143 (Group 3)
- **Page:** Page 2 of 2
- **Meeting Place:** Bogatsu Primary School (Makgophana)
- **Group Leader:** Bakang Modise (Cell: `74704731`)
- **Second Leader:** Lumediso Ellen Mfosi (Cell: `76381950`)
- **Meeting Time:** `12:30`
- **Physical Books Given Note:** Setswana: `3` (from Page 1) / English: `11` (from Page 1)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.59.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Petra Salome | Bogatsu | F | [Blank] | 75051514 | BGCSE | S | Makgophana | TS | 27 Oct | Yes (1) |
| 14 | Bertha | Moitoi | F | [Blank] | 72314604 | BGCSE | S | Makgophana | TS | 27 Oct | Yes (1) |

---

### 10. REGISTER 159 (Page 1 of 2)
- **Register No.:** REGISTER 159
- **Page:** Page 1 of 2
- **Meeting Place:** Madiane's house
- **Group Leader:** Botsalo Leungo Rakgole (Cell: `72110158`)
- **Second Leader:** `[Blank]` (Cell: `[Blank]`)
- **Meeting Time:** `12:00`
- **Physical Books Given Note:** Setswana: `[Blank]` / English: `[Blank]`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.47 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tsotlhe | Kgope | M | 34 | 74052013 | Tertiary | Single | Edu Haven | Tutor | 27 Oct | Yes (1) |
| 2 | Kgotso Arnold | Dintsi | M | 27 | 73848210 | Tertiary | Single | Edu Haven | Tutor | 27 Oct | Yes (1) |
| 3 | Oteng | Pele | F | 23 | 72991351 | Tertiary | Single | Unemployed | Unemployed | 27 Oct | Yes (1) |
| 4 | Keletso Kelly | Pele | F | 32 | 75358373 | Senior | Single | Unemployed | Unemployed | 27 Oct | Yes (1) |
| 5 | Thabang | Pele | F | 39 | 75158030 | Junior | Single | Unemployed | Unemployed | 27 Oct | Yes (1) |
| 6 | Thato | Pele | M | 19 | 78497186 | Junior | Single | N/A | Unemployed | 27 Oct | Yes (1) |
| 7 | Madiane | Pele | F | 58 | 72706886 | Senior | Married | N/A | Unemployed | 27 Oct | Yes (1) |
| 8 | Dipuo Doreen | Mongake | F | 42 | 74101321 | Senior | Single | N/A | Unemployed | 27 Oct | Yes (1) |
| 9 | Warona | Pele | F | 19 | 75774428 | Senior | Single | N/A | Unemployed | 27 Oct | Yes (1) |
| 10 | Karabo | Rakgofela | M | 23 | 76477617 | Tertiary | Single | N/A | Unemployed | 27 Oct | Yes (1) |
| 11 | Leungo Natasha | Rakgofela | F | 23 | 75213511 | Senior | Single | Shoprite | Employed | 27 Oct | Yes (1) |
| 12 | Ketty | Gwebu | F | 53 | 73399233 | Junior | Married | N/A | Unemployed | 27 Oct | Yes (1) |

---

<!-- Batch 4 (Registers 171–182) -->

### 1. REGISTER 171 (Page 1 of 2)
- **Register No.:** 171
- **Page:** Page 1 of 2
- **Meeting Place:** Clinic 1 Mochudi
- **Group Leader:** Bomme Ba Thari (Cell: `71611285 / 72509327`)
- **Second Leader:** Gagosepe Tsheko (Cell: `71611285 / 74401195`)
- **Meeting Time:** 2pm
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)* *(Handwritten note at top right: "Books Collected: 8 - ENG, 2 - SETS")*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.34.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Pearl | Sikwane | F | - | - | - | - | - | - | None | Yes (1) |
| 2 | Leipere | Tsheole | F | - | - | - | - | - | - | None | Yes (1) |
| 3 | Lerato | Lentswe | F | - | - | - | - | - | - | None | Yes (1) |
| 4 | Lucky | Ketshabile | M | - | - | - | - | - | - | None | Yes (1) |
| 5 | Sempe | Khumalo | M | - | - | - | - | - | - | None | Yes (1) |
| 6 | Dineo | Sikwane | F | - | - | - | - | - | - | None | Yes (1) |
| 7 | Pinci | Pilane | F | - | - | - | - | - | - | None | Yes (1) |
| 8 | Violet | Kganyangwe | F | - | - | - | - | - | - | None | Yes (1) |
| 9 | Kgabo | Ofentse | F | - | - | - | - | - | - | None | Yes (1) |
| 10 | Piet | Phale | M | - | - | - | - | - | - | None | Yes (1) |

---

### 2. REGISTER 172 Set A (Page 1 of 2)
- **Register No.:** 172 (Set A)
- **Page:** Page 1 of 2
- **Meeting Place:** RANKOA P SCHOOL
- **Group Leader:** Dineo Sereko (Cell: `72522488`)
- **Second Leader:** Dikeledi P Tlaone (Cell: `72600130`)
- **Meeting Time:** 2:30
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.49 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GOITSEONE | MATLAPENG | F | 53 | 75124004 | DIPLOMA | SINGLE | RANKOA P SCHOOL MALOLWANE | S/TEACHER | 27 Oct | Yes (1) |
| 2 | ORATILE | NKELE | F | 27 | 76474729 | J C | SINGLE | RANKOA P SCHOOL | TSP | 27 Oct | Yes (1) |
| 3 | Natasha | Nare | F | 28 | 72593138 | BGCSE | SINGLE | Rankoa P School | TSP | 27 Oct | Yes (1) |
| 4 | Gofaone Brighton | Phato | M | 24 | 72348223 | BGCSE | Single | Rankoa P. Sch Malolwane | TSP | 27 Oct | Yes (1) |
| 5 | ODIRELE | Ramotswetla | M | 42 | 75337750 | TERTIARY | SINGLE | Rankoa P. Sch Malolwane | Teacher Aid | 27 Oct | Yes (1) |
| 6 | LEBOGANG | NKELE | F | 27 | 74326183 | BGCSE | SINGLE | Rankoa P. Sch Malolwane | TSP | 27 Oct | Yes (1) |
| 7 | Priscilla Tsiepe | Sello | F | 45 | 73623003 | B ED | SINGLE | Rankoa P. Sch Malolwane | Senior Teacher Languages | 27 Oct | Yes (1) |
| 8 | Sibanda | Precious | F | 34 | 72868406 | CERTIFICATE | SINGLE | RANKOA P.S | TEACHER AIDE | 27 Oct | Yes (1) |
| 9 | Portuno Kaone | Morapedi | F | 27 | 72268568 | DIPLOMA | Single | Rankoa P.S | Teacher | 27 Oct | Yes (1) |
| 10 | LERATO | GARE | F | 45 | 71738743 | DIPLOMA | MARRIED | RANKOA P.S | TEACHER | 27 Oct | Yes (1) |
| 11 | THATO | BANO | F | 41 | 71832065 | DIPLOMA | SINGLE | RANKOA P SCHOOL | T/AIDE | 27 Oct | Yes (1) |
| 12 | Keamogetse | Bobe | M | 30 | 75495321 | DPE | SINGLE | Rankoa P. Sch Malolwane | Teacher | 27 Oct | Yes (1) |

---

### 3. REGISTER 172 Set A (Page 2 of 2)
- **Register No.:** 172 (Set A)
- **Page:** Page 2 of 2
- **Meeting Place:** RANKOA P SCHOOL
- **Group Leader:** Dineo Sereko (Cell: `72522488`)
- **Second Leader:** Dikeledi P Tlaone (Cell: `72600130`)
- **Meeting Time:** 14:30
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.48 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Bathoeba | Maemo | F | 57 | 76852114 | Std 7 | Married | Rankoa P. School Malolwane | GDA | 27 Oct | Yes (1) |
| 14 | SARAH | PHALA | F | 59 | 71873862 | DPE | MARRIED | Rankoa Primary | DSH TEACHER | 27 Oct | Yes (1) |
| 15 | KGOMOTSEGANG | GARE | F | 62 | 71782542 | DPE | Married | Rankoa Primary | S/H | 27 Oct | Yes (1) |
| 16 | Sarah | Motsage | F | 31 | 74841617 | Diploma | Single | Rankoa P. Sch Malolwane | Teacher Aide | 27 Oct | Yes (1) |

---

### 4. REGISTER 172 Set B (Page 1 of 2)
- **Register No.:** 172 (Set B)
- **Page:** Page 1 of 2
- **Meeting Place:** RANKOA P SCHOOL
- **Group Leader:** Dineo Sereko (Cell: `72522488`)
- **Second Leader:** Dikeledi P Tlaone (Cell: `72600130`)
- **Meeting Time:** 2:30
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.49 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Neo Lazarus | Mmale | M | 30 | 73170794 | Certificate in HSE | Single | Rankoa P. Sch Malolwane | Teacher Aide | 27 Oct | Yes (1) |
| 2 | MAIPELO | RAMPHALENG | F | 57 | 71744766 | BEd ECD | MARRIED | Rankoa | HOD Middle | 27 Oct | Yes (1) |
| 3 | DORIS | MOHUBITSHWANE | F | 59 | 71621404 | BEd PRIMARY | SINGLE | RANKOA | HOD TEACHER | 27 Oct | Yes (1) |
| 4 | TSAONE | MMIPI | F | 48 | 74090604 | DIPLOMA | SINGLE | RANKOA | TEACHER | 27 Oct | Yes (1) |
| 5 | FADZAI | MUNDSI | F | 34 | 76605442 | DEGREE | SINGLE | Rankoa P. Sch Malolwane | Teacher | 27 Oct | Yes (1) |
| 6 | Setlhunya | Mongkenyane | F | 34 | 71479416 | DEGREE | SINGLE | Rankoa P. Sch Malolwane | Teacher Aide | 27 Oct | Yes (1) |
| 7 | NEO KENNEDY | TIRELO | M | 54 | 77030079 | DIPLOMA | SINGLE | RANKOA | TEACHER | 27 Oct | Yes (1) |
| 8 | Baleseng | Gwai | F | 45 | 72555759 | Certificate C.B.W.Y.C | SINGLE | Rankoa P School | Caretaker | 27 Oct | Yes (1) |
| 9 | Kgololo | Tlhale | F | 50 | 72343725 | JC | Widow | Rankoa P School | Cook | 27 Oct | Yes (1) |
| 10 | Tsiela | Ntshole | F | 30 | 74085946 | DPE | SINGLE | Rankoa P School | Teacher | 27 Oct | Yes (1) |
| 11 | Chibilo | Thebe | F | 47 | 73494357 | DEGREE | Single | Rankoa School | HOD LD | 27 Oct | Yes (1) |
| 12 | Goitseone | Dinoko | F | 26 | 74653818 | BED SPED | Single | Rankoa | Teacher | 27 Oct | Yes (1) |

---

### 5. REGISTER 172 Set B (Page 2 of 2)
- **Register No.:** 172 (Set B)
- **Page:** Page 2 of 2
- **Meeting Place:** RANKOA P SCHOOL
- **Group Leader:** Dineo Sereko (Cell: `72522488`)
- **Second Leader:** Dikeledi P Tlaone (Cell: `72600130`)
- **Meeting Time:** 14:30
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.49.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Thabong | Maitsi | M | 37 | 75155638 | DPE | S | RANKOA P. SCHOOL (MALOLWANE) | TEACHER | 27 Oct | Yes (1) |
| 14 | Bonita | Montsho | F | 52 | 72563602 | DECE | S | RANKOA P. SCHOOL MALOLWANE | TEACHER | 27 Oct | Yes (1) |
| 15 | Kenshegilegone Ruth | Radikesi | F | 29 | 72465547 | DPE | S | RANKOA P.S MALOLWANE | TEACHER | 27 Oct | Yes (1) |

---

### 6. REGISTER 174 A (Page 1 of 2)
- **Register No.:** 174 A
- **Page:** Page 1 of 2
- **Meeting Place:** Morwa route 5
- **Group Leader:** Selinah Sefakwe (Cell: `72395409 / 74515520`)
- **Second Leader:** None
- **Meeting Time:** 6:00 am
- **Physical Books Given Note:** Setswana: `6` | English: `6`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.06 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Sulu | Moje | F | 57 | 74089015 | P | S | - | Ikgageng | 27 Oct | Yes (1) |
| 2 | Lame | Morake | F | 28 | 72965717 | U | S | - | Ikgageng | 27 Oct | Yes (1) |
| 3 | Tholiwe M | Tladi | F | 23 | 72368535 | J | S | - | Ikgageng | 27 Oct | Yes (1) |
| 4 | Junior T | Motshwane | M | 19 | 74521178 | J | S | - | Ikgageng | 27 Oct | Yes (1) |
| 5 | Tshepiso P. | Mogobi | M | 20 | 76334099 | S | S | - | Ikgageng | 27 Oct | Yes (1) |
| 6 | Obakeng R | Mothoka | M | 31 | 76022541 | S | S | - | Ikgageng | 27 Oct | Yes (1) |
| 7 | Bonnie | Nyepetsi | F | - | 74754615 | P | M | - | Ikgageng | 27 Oct | Yes (1) |
| 8 | Onneile L | Sefakwe | F | 24 | 74686731 | U | S | - | - | 27 Oct | Yes (1) |
| 9 | Nako | Diphale | F | - | - | U | S | - | - | 27 Oct | Yes (1) |
| 10 | Thuthi M | Sefakwe | F | - | 71598323 | P | S | - | - | 27 Oct | Yes (1) |
| 11 | Pinkie | Matlhaga | F | - | 75029180 | P | S | - | - | 27 Oct | Yes (1) |
| 12 | Gofamodimo | Ramochi | F | 32 | 78320439 | J | S | - | - | 27 Oct | Yes (1) |

---

### 7. REGISTER 174 B (Page 2 of 2)
- **Register No.:** 174 B
- **Page:** Page 2 of 2
- **Meeting Place:** Kgotla Boseja South
- **Group Leader:** Selinah Sefakwe (Cell: `74515520 / 72395409`)
- **Second Leader:** None
- **Meeting Time:** 7:00 am
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.05 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Lesego | Lebepe | F | 45 | 77542710 | J | S | Security | - | 27 Oct | Yes (1) |
| 14 | Bokang | Mathe | M | 50 | 75372919 | J | S | - | Cluster | 27 Oct | Yes (1) |
| 15 | Boitumelo | Kgote | F | 32 | 72939805 | J | S | - | Cluster | 27 Oct | Yes (1) |
| 16 | Lucy | Palai | F | 47 | 75493662 | J | M | - | Cluster | 27 Oct | Yes (1) |
| 17 | Matlakala | Mange | F | 30 | 74390121 | J | S | - | Cluster | 27 Oct | Yes (1) |
| 18 | Motsei | Mapotsane | F | 55 | 73370442 | J | S | - | Cluster | 27 Oct | Yes (1) |
| 19 | Tebogo | Kgote | F | 54 | 72660425 | J | S | - | - | 27 Oct | Yes (1) |
| 20 | Onkemetse | Mathe | F | 45 | 75043348 | J | S | - | - | 27 Oct | Yes (1) |
| 21 | Kgekagiso | Dire | M | 42 | 71419122 | J | S | - | - | 27 Oct | Yes (1) |

---

### 8. REGISTER 175 (Page 2 of 2)
- **Register No.:** 175
- **Page:** Page 2 of 2
- **Meeting Place:** FIRE
- **Group Leader:** Emmanuel Katlego Censrule (Cell: `76931562`)
- **Second Leader:** None
- **Meeting Time:** 07:30
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.47.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | MATHODI | SEBATO | F | 35 | 76752465 | BGCSE | SINGLE | - | - | None | Yes (1) |
| 14 | REFILWE | REAKAE | F | 39 | 71429769 | JC | SINGLE | - | - | None | Yes (1) |
| 15 | TEBOGO | TSHOSE | F | 43 | 71375389 | BGCSE | SINGLE | - | - | None | Yes (1) |
| 16 | Stella | Ranko | F | 57 | 71798981 | DIPLOMA | SINGLE | FIRE DEPT. | CHIEF FIRE OFFICER | None | Yes (1) |
| 17 | G. G. | MATSIRANE | M | 49 | 72207700 | TERTIARY | MARRIED | FIRE DEPT | FIRE OFFICER | None | Yes (1) |
| 18 | B. G. | BAGAKA | M | 42 | 74916160 | Certificate in Fire Safety | Single | Fire Dept | Sub Fire Officer | None | Yes (1) |
| 19 | JWA | KGOSIGADI | F | 49 | 71436017 | JC | Single | KDC FIRE DEPT | FIRE PREVENTION | None | Yes (1) |
| 20 | TEFO | PHALADZE | F | - | 74146613 | TERTIARY | SINGLE | FIRE DEPT | LEADING FIREMAN | None | Yes (1) |
| 21 | F. N. | MATSOGE | M | 47 | 76500684 | TERTIARY | SINGLE | FIRE DEPT | FIRE OFFICER | None | Yes (1) |
| 22 | Phiri | Phokojwe | M | 47 | 71367849 | JC | MARRIED | FIRE DEPT | FIREMAN | None | Yes (1) |
| 23 | Noah | Mokolelele | M | 54 | 76033884 | Diploma | Married | Fire Dept | Station Officer | None | Yes (1) |

---

### 9. REGISTER 182 (Page 1 of 2)
- **Register No.:** 182
- **Page:** Page 1 of 2
- **Meeting Place:** PLOT 10226 PHAPHANE
- **Group Leader:** TSEONE B. LEMOGO (Cell: `71779905`)
- **Second Leader:** None
- **Meeting Time:** 8 P.M
- **Physical Books Given Note:** Setswana: *(blank)* | English: *(blank)*
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.54 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | MOTLHASI | MAILAPENG | M | 64 | 75362494 | 3 YRS JC | M | PENSIONER | - | 27 Oct | Yes (1) |
| 2 | Mogobe | Mvunda | M | 38 | 75482885 | Tertiary | S | Security Systems | Supervisor | 27 Oct | Yes (1) |
| 3 | THEMBA | MPUCHANE | M | 40 | 719159692 | ASS DEGREE | S | - | UNEMPLOYED | 27 Oct | Yes (1) |
| 4 | Lucky | Mvunda | M | 33 | 76242192 | NCC | M | - | Unemployed | 27 Oct | Yes (1) |
| 5 | Monyenyi B | Mvunda | F | 29 | 74193694 | BGCSE | M | Hungry Lion | Cashier | 27 Oct | Yes (1) |
| 6 | Lesego | Chabo | F | 50 | 71695333 | BGCSE | Divorced | Self Employed | N/A | 27 Oct | Yes (1) |
| 7 | Ramotswetla | Odirena | F | 48 | 72441658 | JC | S | Security Systems | Guard | 27 Oct | Yes (1) |
| 8 | Chenjerai | Shantel | F | 22 | 73243741 | JC | M | - | Unemployed | 27 Oct | Yes (1) |
| 9 | CHIPO | MODISE | F | 64 | 71969780 | - | W | - | HOUSE WIFE | 27 Oct | Yes (1) |

---

<!-- Batch 5 (Registers 183–189) -->

### 1. REGISTER 183 — Grp 1 (Page 1 of 2)
- **Register No.:** REGISTER 183 (Grp 1)
- **Page:** Page 1 of 2
- **Meeting Place:** Seingwaeng P. School
- **Group Leader:** Tshegofatso Lebotse (Cell: None listed on line; see Second Leader line)
- **Second Leader:** Nicolas Sefako & Omphile Tsele (Cell: 73495184 / 74651231)
- **Meeting Time:** 0730 - 0800am
- **Physical Books Given Note (Setswana / English):** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.51 (3).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dipogiso | Nthulwe | F | 48 | 71710405 | Form 2 | S | Seingwaeng P. School | G D A | 27 Oct | Yes (1) |
| 2 | Boitumelo | Sefako | F | 48 | 71449152 | Form 2 | S | Seingwaeng P. School | Cook | 27 Oct | Yes (1) |
| 3 | Selinah | Tlhageng | F | 49 | 71434580 | Diploma in Education | M | Seingwaeng P. School | Teacher Aide | 27 Oct | Yes (1) |
| 4 | Obakeng | Dikgwela | M | 37 | 75903870 | Certificate | M | Seingwaeng P. School | Teacher Aide | 27 Oct | Yes (1) |
| 5 | Thatohatso | Mologi | F | 45 | 77412274 | Degree | S | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 6 | Tsholofelo | Letsholo | F | 46 | 71776477 | Diploma | M | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 7 | Mmamosweu | Phinius | F | 38 | 74496143 | Diploma | M | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 8 | Tshepo | Boku | F | 44 | 74661264 | Degree | M | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 9 | Kgalalelo | Mapogo | F | 43 | 74006215 | Certificate | F | Seingwaeng | Teacher Aide | 27 Oct | Yes (1) |
| 10 | Neo | Kgote | F | 57 | 72944273 | STD 7 | F | Seingwaeng | Cook | 27 Oct | Yes (1) |
| 11 | Thato | Popego | F | 52 | 76329774 | Form 2 | F | Seingwaeng | Cook | 27 Oct | Yes (1) |
| 12 | Mantsiea | Tlhagae | F | 43 | 74049743 | Form 3 | F | Seingwaeng | Cook | 27 Oct | Yes (1) |

---

### 2. REGISTER 183 — Grp 1 (Page 2 of 2)
- **Register No.:** REGISTER 183 (Grp 1)
- **Page:** Page 2 of 2
- **Meeting Place:** Seingwaeng P. School
- **Group Leader:** Tshegofatso Lebotse (Cell: Blank)
- **Second Leader:** Nicols Sefako & Omphile Tsele (Cell: Blank)
- **Meeting Time:** Blank (0730 - 0800am on Page 1)
- **Physical Books Given Note (Setswana / English):** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.50 (3).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Nhoh | Sejoe | F | 52 | 71913858 | F5 | Single | Seingwaeng | Security Officer | 27 Oct | Yes (1) |

---

### 3. REGISTER 183 A — Grp 2 (Page 1 of 2)
- **Register No.:** REGISTER 183 A (Grp 2)
- **Page:** Page 1 of 2
- **Meeting Place:** Seingwaeng P. School
- **Group Leader:** Ms Onalepele Dipogiso (Cell: 76934521)
- **Second Leader:** Thato Mogotsi (Cell: 78156864)
- **Meeting Time:** 0730 - 0800am
- **Physical Books Given Note (Setswana / English):** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.52 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Boikhutso | Pheko | F | 35 | 74424852 | Degree Sec | Single | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 2 | Keoagetsoe | Kgapanyane | F | 40 | 72424895 | Diploma Primary | Married | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 3 | Mildah | Malefho | F | 36 | 72100021 | Degree Secondary Edu | Married | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 4 | Tlotlo | - | F | 27 | 75252446 | Diploma ECE | Single | Seingwaeng P. School | TSP | 27 Oct | Yes (1) |
| 5 | Malebogo | Ramotswetla | F | 28 | 77756729 | Certificate | Single | Seingwaeng P. School | TSP | 27 Oct | Yes (1) |
| 6 | Doreen | Dipogiso | F | 25 | 77543114 | BGCSE | Single | Seingwaeng P. School | TSP | 27 Oct | Yes (1) |
| 7 | Tshepiso | Dipogiso | F | 23 | 78150953 | BGCSE | Single | Seingwaeng P. School | TSP | 27 Oct | Yes (1) |
| 8 | Malebogo | Selemogwe | F | 38 | 76087664 | Degree Secondary | Single | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 9 | Thabiso | Molefe | M | 42 | 74748230 | Diploma Primary Education | Single | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 10 | Thabo | Pilane | F | 27 | 76519274 | BGCSE | Single | Seingwaeng P. School | TSP | 27 Oct | Yes (1) |
| 11 | Lizzy | Mangole | F | 57 | 75584984 | Diploma | Single | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |

---

### 4. REGISTER 183 B — Grp 3 (Page 1 of 2)
- **Register No.:** REGISTER 183 B (Grp 3)
- **Page:** Page 1 of 2
- **Meeting Place:** Seingwaeng P. School
- **Group Leader:** Kelebogile Ntshebe (Cell: 71744244)
- **Second Leader:** Kesaoboka Pheto (Cell: 77427767)
- **Meeting Time:** 0730 - 0830am
- **Physical Books Given Note (Setswana / English):** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.52.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Gontse | Mathape | F | 35 | 71745882 | Diploma | Single | Seingwaeng P. School | T/Aide | 27 Oct | Yes (1) |
| 2 | Noreen | Rempiping | F | 44 | 71555157 | Degree Secondary Education | Married | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 3 | Seabe | Tau | F | 56 | 71261760 | Degree ECIE | Single | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 4 | Motsamai | Kgobokwe | F | 49 | 71615951 | Diploma Primary | Married | Seingwaeng P. School | Teacher | 27 Oct | Yes (1) |
| 5 | Dimpho | Merafhe | M | 34 | 75213374 | Degree Primary Education | Single | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 6 | Lesang Reichel | Pilane | F | 43 | 71236226 | D.P.E, BSc Degree | Married | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 7 | Mmabaledi | Dipheko | M | 42 | 75890893 | Diploma | Single | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 8 | Neo | Mooketsane | F | 45 | 71384648 | Masters in Maths | Married | Seingwaeng | SJT M&S | 27 Oct | Yes (1) |
| 9 | Mmoni | Bosupi | F | 54 | 76061906 | BEd Primary | Married | Seingwaeng | Teacher | 27 Oct | Yes (1) |
| 10 | Boitshoko F. | Kobe | F | 38 | 72775670 | BGCSE | Single | Seingwaeng | Teacher Aide | 27 Oct | Yes (1) |

---

### 5. REGISTER 185 (Page 1 of 2)
- **Register No.:** REGISTER 185
- **Page:** Page 1 of 2
- **Meeting Place:** Education Regional Office
- **Group Leader:** Kagiso Moitoi (Cell: 74977997 / 77777169)
- **Second Leader:** Kabo Maxala (Cell: 72958870)
- **Meeting Time:** 15:00hrs
- **Physical Books Given Note (Setswana / English):** Setswana: `6` | English: `7` (Top-right note: `6 - Sets, 7 - Eng`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.43 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Losie | Ramadue | M | 33 | 74507504 | B A B S | Single | Education Regional | P.R.O | 27 Oct | Yes (1) |
| 2 | Gorata | Boitshwarelo | F | 31 | 72907626 | A A T | Single | Education Regional | Accounting | 27 Oct | Yes (1) |
| 3 | Tato | Letsebe | M | 29 | 76009677 | Form 5 | Single | Education Regional | Messenger | 27 Oct | Yes (1) |
| 4 | Wadipo | Moikabi | F | 33 | 73800018 | D T L | Single | Education Regional | Transport Officer | 27 Oct | Yes (1) |
| 5 | Galebone | Tirelo | F | 47 | 74566700 | P S L E | Single | Education Regional | Office Cleaner | 27 Oct | Yes (1) |
| 6 | Bopeng D | Mongala | M | 33 | 75390468 | Form 3 | Single | Education Regional | Groundsman | 27 Oct | Yes (1) |
| 7 | Onthusitse | Makuku | M | 49 | 71895583 | B A Educ | Single | Education Regional | Adult Educator | 27 Oct | Yes (1) |
| 8 | Boitshepo M | Rampaleng | F | 42 | 74976069 | Form 5 | Single | Education Regional | Office Cleaner | 27 Oct | Yes (1) |
| 9 | Bagologi | Baboloki | M | 33 | 74493665 | B. Arch | Single | Education Regional | Architecture | 27 Oct | Yes (1) |
| 10 | Tshego | Moremi | F | 36 | 74678748 | Form 5 | Single | Education Regional | Receptionist | 27 Oct | Yes (1) |
| 11 | Matlhodi | Moitoi | F | 66 | 71747847 | Diploma Nursing | Single | Education Regional | Retired Nurse | 27 Oct | Yes (1) |
| 12 | Tshepiso | Morobi | F | 35 | 75306627 | B A | Single | Rasesa Primary Sch | Teacher | 27 Oct | Yes (1) |

---

### 6. REGISTER 185 (Page 2 of 2)
- **Register No.:** REGISTER 185
- **Page:** Page 2 of 2
- **Meeting Place:** Education Regional Office
- **Group Leader:** Kagiso Moitoi (Cell: 74977997 / 77777169)
- **Second Leader:** Kabo Maxala (Cell: 72958870)
- **Meeting Time:** 15:00hrs
- **Physical Books Given Note (Setswana / English):** N/A (Page 2; Page 1 notes 6 Setswana / 7 English)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.43.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Agisanyang | Tshwaane | M | 46 | 74499842 | BA Education | S | Education Regional | Adult Educator | 27 Oct | Yes (1) |

---

### 7. REGISTER 188 (Page 1 of 2)
- **Register No.:** REGISTER 188
- **Page:** Page 1 of 2
- **Meeting Place:** Isang P. School
- **Group Leader:** Lesego F. Tlhage (Cell: 74173550)
- **Second Leader:** Mma Kgwefane (Cell: Blank)
- **Meeting Time:** 13:00pm
- **Physical Books Given Note (Setswana / English):** Setswana: `5` | English: `17` (Top-right note: `ENG - 17, SETS - 5`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.45 (3).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tebogo E | Mothupi | F | 44 | 77041552 | DPE | M | Isang Primary | Teacher | 27 Oct | Yes (1) |
| 2 | Neo | Ditshego | F | 43 | 76018343 | DCE | S | Isang Primary | Teacher | 27 Oct | Yes (1) |
| 3 | Candie | Rabala | F | 34 | 76440540 | DIECD | M | Isang Primary | Teacher | 27 Oct | Yes (1) |
| 4 | Onkemetse | Mueti | F | 37 | 77601125 | BED IECD | S | Isang | Teacher | 27 Oct | Yes (1) |
| 5 | Tebogo | Danki | F | 46 | 71919870 | BED IECD | S | Isang | Teacher | 27 Oct | Yes (1) |
| 6 | Mmamoeng | Kgosana | F | 37 | 74020736 | DSE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 7 | Keitiretse | Buisanyang | F | 53 | 72247353 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 8 | Ompone | Osupile | F | 60 | 71690802 | BEd | W | Isang | Teacher | 27 Oct | Yes (1) |
| 9 | Motsei S. | Lekoa | M | 59 | 74223274 | BEd | S | Isang | Teacher | 27 Oct | Yes (1) |
| 10 | Ditlhare | Kgwampe | F | 64 | 71840953 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 11 | Kgomotso | Ntloe | F | 43 | 75299377 | BEd | S | Isang | Teacher | 27 Oct | Yes (1) |
| 12 | Florah | Gape | F | 59 | 71400498 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |

---

### 8. REGISTER 188 (Page 2 of 2)
- **Register No.:** REGISTER 188
- **Page:** Page 2 of 2
- **Meeting Place:** Isang P. School
- **Group Leader:** Lesego F. Tlhage (Cell: 74173550)
- **Second Leader:** Mma Kgwefane (Cell: Blank)
- **Meeting Time:** 13:00
- **Physical Books Given Note (Setswana / English):** N/A (Page 2; Page 1 notes Setswana: 5, English: 17)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.45 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Cathrine | Masuge | F | 55 | 71456305 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 14 | Angelina | Kgote | F | 21 | 77519384 | J | S | Isang | TSP | 27 Oct | Yes (1) |
| 15 | Margaret | Sefako | F | 54 | 71721107 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 16 | Christopher | Mothabi | M | 52 | 72629858 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 17 | Bofelo O. | Olefile | F | 27 | 78207879 | DPE | S | Isang | Teacher | 27 Oct | Yes (1) |
| 18 | Regego | Mongwaketse | F | 27 | 76334710 | DPE | S | Isang | Teacher | 27 Oct | Yes (1) |
| 19 | Boitumelo | Mobule | F | 44 | 71700109 | DPE | M | Isang | Teacher | 27 Oct | Yes (1) |
| 20 | Tumediso | Motsepe | F | 43 | 72471760 | BGCSE | S | Isang | T. Aid (Rehu) | 27 Oct | Yes (1) |
| 21 | Della Masego | Lebotse | F | 26 | 73692391 | BGCSE | S | Isang | T.S.P | 27 Oct | Yes (1) |
| 22 | Joyce | Mokotedi | F | 25 | 76859002 | J | S | Isang | T.S.P | 27 Oct | Yes (1) |

---

### 9. REGISTER 189 (Page 2 of 2)
- **Register No.:** REGISTER 189
- **Page:** Page 2 of 2
- **Meeting Place:** At home
- **Group Leader:** Segametsi Setshwane (Cell: 71542193 / 78202341)
- **Second Leader:** Ahueng Mosala (Cell: 74441865)
- **Meeting Time:** 8pm
- **Physical Books Given Note (Setswana / English):** Top-right note: `All books collected 12 - ENG`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.36.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 (1) | Kelebogile | Mhleng | F | 31 | 79111785 | C | S | Sefhare | Clinical Tech | 27 Oct | Yes (1) |
| 14 (2) | Phenyo | Ntshebe | M | 35 | 72764680 | U | S | - | - | 27 Oct | Yes (1) |
| 15 (3) | Jackson | Magashula | M | 17 | 73094389 | Form 5 | S | - | Student | 27 Oct | Yes (1) |
| 16 (4) | Kaboyaoone | Magashula | M | 15 | 73094389 | Form 2 | S | - | Student | 27 Oct | Yes (1) |
| 17 (5) | Tshegofatso | Cloutie | F | 22 | 76478847 | Tertiary | S | - | Student | 27 Oct | Yes (1) |
| 18 (6) | Loago | Tsheko | M | 28 | 75350984 | Form 5 | S | Law firm | Debt Collector | 27 Oct | Yes (1) |
| 19 (7) | Fred | Tsheko | M | 76 | 73028730 | JC | M | Pensioner | - | 27 Oct | Yes (1) |
| 20 (8) | Mofenyi | Segona | M | 31 | 72368371 | Form 5 | S | - | - | 27 Oct | Yes (1) |
| 21 (9) | Thobo | Balekanye | F | 38 | 72389178 | Tertiary | M | Self employed | Selling | 27 Oct | Yes (1) |
| 22 (10) | Phineas | Balekanye | M | 38 | 72238427 | Form 5 | M | Police Force | Police Officer | 27 Oct | Yes (1) |
| 23 (11) | Refilwe | Mosenyi | F | 41 | 76148201 | U | M | SADC | Lawyer | 27 Oct | Yes (1) |
| 24 (12) | Mothusi | Mosenyi | M | 41 | 74156747 | U | M | Self employed | Managing Director | 27 Oct | Yes (1) |

---

<!-- Batch 6 (Registers 196–220) -->

### 1. REGISTER 196 (Page 2 of 2)
- **Register No.:** 196
- **Page:** Page 2 of 2
- **Meeting Place:** MMATHUBUDUKWANE POLICE STATION
- **Group Leader:** Otshegeditse Mosiisi (Cell: `75512007`)
- **Second Leader:** None
- **Meeting Time:** `1500HRS`
- **Physical Books Given Note (Setswana / English):** N/A (Page 2 of 2; Collected Book column blank)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.53 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Kgamootswa | Lejela | M | 57 | 72452014 | COSC | Single | Police | Police Officer | 27 Oct | Yes (1) |
| 14 | Lazarus | Ramatebele | M | 59 | 72963740 | 3 Yr JC | Married | Police | Police Officer | 27 Oct | Yes (1) |
| 15 | Jane M | Rammako | F | 48 | 72404097 | COSC | Married | Police | Police Officer | 27 Oct | Yes (1) |
| 16 | Nametso | Disele | F | 39 | 72921780 | Tertiary | Single | Police | Police Officer | 27 Oct | Yes (1) |
| 17 | Relebatseng | Tlhakwane | F | 39 | 71323659 | Social Work Diploma | Single | Police Officer | Police Officer | 27 Oct | Yes (1) |
| 18 | Uriel Maduo | Kelebemang | F | 32 | 76120601 | BGCSE | Single | Police Officer | Police Officer | 27 Oct | Yes (1) |
| 19 | Isaac | Molefe | M | 54 | 73777395 | JC | Married | Police | Police Officer | 27 Oct | Yes (1) |
| 20 | Thepho | Kgari | M | 31 | 74484636 | BGCSE | Single | Police | Police Officer | 27 Oct | Yes (1) |
| 21 | Tshidiso | Matoma | M | Adult | 72628006 | BGCSE | Single | Police | Police Officer | 27 Oct | Yes (1) |
| 22 | Ompatile | Hange | F | Adult | 75939777 | BGCSE | Single | Police | Police Officer | 27 Oct | Yes (1) |
| 23 | Odiretse | Samuel | F | - | 72482235 | BGCSE | Single | Police | Police Officer | 27 Oct | Yes (1) |

---

### 2. REGISTER 197 (Page 2 of 2)
- **Register No.:** 197
- **Page:** Page 2 of 2
- **Meeting Place:** MMATHUBUDUKWANE
- **Group Leader:** Olebogeng Tona (Cell: `72775831`)
- **Second Leader:** Blank Name (Cell: `72795831`)
- **Meeting Time:** `0730`
- **Physical Books Given Note (Setswana / English):** N/A (Page 2 of 2; Collected Book column blank)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.54.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Odirile | Montshoe | F | 38 | 75779761 | BGCSE | Married (M) | Mmathubudukwane Police Station | Office Cleaner | 27 Oct | Yes (1) |
| 14 | Bokang | Keakanje | F | 28 | 72938320 | BGCSE | Single (S) | Mmathubudukwane Police Station | Police Officer | 27 Oct | Yes (1) |
| 15 | Lenah | Ramasonya | F | 29 | 72776835 | Advanced Diploma | Married (M) | Mmathubudukwane Police Station | Police Officer | 27 Oct | Yes (1) |
| 16 | M. | Baipheng | M | 37 | 72418255 | BGCSE | - | Mmathubudukwane Police Station | Police Officer | 27 Oct | Yes (1) |
| 17 | Sebata | Sethe | M | 41 | 73028004 | BGCSE | - | Mmathubudukwane Police Station | Police Officer | 27 Oct | Yes (1) |
| 18 | Kedisaletse | Tshiamo | M | 34 | 72670233 | Diploma | Married (M) | Mmathubudukwane Police Station | Officer | 27 Oct | Yes (1) |
| 19 | Tiro | Gabatladiwe | M | 37 | 72512847 | BGCSE | Single (S) | Police | Officer | 27 Oct, 28 Oct | Yes (1) |

---

### 3. REGISTER 198 (Page 1 of 2)
- **Register No.:** 198
- **Page:** Page 1 of 2
- **Meeting Place:** MALOTWANA KGOTLA
- **Group Leader:** Boitshelo Tshukudu (Cell: `74875510`)
- **Second Leader:** None
- **Meeting Time:** `08:00`
- **Physical Books Given Note (Setswana / English):** Setswana: Blank, English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.48.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Lesego | Balebetse | F | 36 | 77654298 | BGCSE | Single | Malotwana | Community Developer | None | Yes (1) |
| 2 | Kabelo | Gaboone | M | 27 | 77737670 | Diploma in Law | Single | Malotwana Police | P/Officer | None | Yes (1) |
| 3 | Keoagile | Keekae | M | 47 | 73513707 | BGCSE | Single | Malotwana Police | P/Officer | None | Yes (1) |
| 4 | Kwenyu | Atolang | M | 30 | 74910535 | BGCSE | Single | Malotwana Police | Teacher | None | Yes (1) |
| 5 | Keabetswe | Gabaake | M | 24 | 75222099 | BGCSE | Single | Malotwana Police | P/Officer | None | Yes (1) |
| 6 | Kabelo | Baitatse | M | 22 | 76314116 | BGCSE | Single | Malotwana Police | Tirelo Sechaba | None | Yes (1) |
| 7 | Rranwaane | Mpole | M | 67 | - | - | Married | Malotwana Police | Headman of Arbitration | None | Yes (1) |
| 8 | Kago | Mokake | M | 39 | 72670098 | Diploma in H/R | Single | Malotwana Police | Driver | None | Yes (1) |
| 9 | Kemoneilwe | Mooketsi | M | 37 | 74704658 | BGCSE | Married | Malotwana Police | C/Bailif | None | Yes (1) |

---

### 4. REGISTER 201 — Sheet 1 (Page 1 of 2)
- **Register No.:** Unnumbered (`REGISTER 201` Sheet 1)
- **Page:** Page 1 of 2
- **Meeting Place:** Mochudi State Prison
- **Group Leader:** Raymond Baiphethi (Cell: `71374706`)
- **Second Leader:** Kenewang Ramontsho (Cell: `71430259`)
- **Meeting Time:** `1230 - 1400 hrs`
- **Physical Books Given Note (Setswana / English):** Bottom boxes blank; Left margin has language codes for all 7 rows (`5 Setswana [S]`, `2 English [E]`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.07 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Pashedi | Letlamma | M | 45 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 2 | Oarabile | Tlakoleng | M | 24 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 3 | Pholoso | Motlafela | M | 30 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 4 | Lapologang | Morolong | M | 63 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 5 | Petemekwe | Koitsiwe | M | 33 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] (Wait: 3 E, 4 S total: Rows 1,4,6,7 = S; Rows 2,3,5 = E) |
| 6 | Tlhobogi | Sephai | M | 23 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 7 | Nonofo | Mokgosi | M | 38 (or 28) | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |

*(Note on Sheet 1 margin codes: Rows 1, 4, 6, 7 are marked `S` = 4 Setswana; Rows 2, 3, 5 are marked `E` = 3 English.)*

---

### 5. REGISTER 201 — Sheet 2 (Page 2 of 2)
- **Register No.:** Unnumbered (`REGISTER 201` Sheet 2)
- **Page:** Page 2 of 2
- **Meeting Place:** Mochudi State Prison
- **Group Leader:** Raymond Baiphethi (Cell: `71374706`)
- **Second Leader:** Kenewang Ramontsho (Cell: `71430259`)
- **Meeting Time:** `1230 - 1400 hrs`
- **Physical Books Given Note (Setswana / English):** Page 2 of 2; Left margin has language codes for all 12 rows (`6 Setswana [S]`, `6 English [E]`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.07.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Michael | Selebalo | M | 24 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 14 | Mogorosi | Palai | M | 55 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 15 | Lesego | Matote | M | 40 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 16 | Tomeletso | Lengwadibe | M | 29 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 17 | Oteng | Moalosi | M | 24 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 18 | Kabelo | Thibogang | M | 40 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 19 | Theophilus | Kgositlou | M | 28 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 20 | Peter | Chata | M | 28 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 21 | Thabang | Ramatu | M | 29 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 22 | Tebogo | Batlotleng | M | 31 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 23 | Kabo Joseph | Sekalaka | M | 43 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 24 | Teddy | Mokgele | M | 61 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |

---

### 6. REGISTER 201 — Sheet 3 (Page 2 of 2)
- **Register No.:** Unnumbered (`REGISTER 201` Sheet 3)
- **Page:** Page 2 of 2
- **Meeting Place:** Mochudi State Prison
- **Group Leader:** Raymond Baiphethi (Cell: `71374706`)
- **Second Leader:** Kenewang Ramontsho (Cell: `71430259`)
- **Meeting Time:** `1230 - 1400 hrs`
- **Physical Books Given Note (Setswana / English):** Page 2 of 2; Left margin has language codes (`9 Setswana [S]`, `2 English [E]`, `1 unmarked` on Row 16)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.08 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Bonkamile | Tome | M | 42 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 14 | Kamogelo | Kgang | M | 40 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 15 | Obakeng | Tau | M | 43 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 16 | Kefilwe | Koitsiwe | M | 33 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [Unmarked] |
| 17 | Oteng | Kgabangwe | M | 26 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 18 | Mpho | Manguo | M | 38 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 19 | Tebogo | Moleta | M | 45 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 20 | Motsheshe | Sentsimako | M | 53 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 21 | Gaeboke | Obane | M | 65 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 22 | Piet | Leribisi | M | 57 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 23 | Pelotshweu | Too | M | 33 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 24 | Odirile | Medupe | M | 30 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |

---

### 7. REGISTER 201 — Sheet 4 (Page 1 of 2)
- **Register No.:** Unnumbered (`REGISTER 201` Sheet 4)
- **Page:** Page 1 of 2
- **Meeting Place:** Mochudi State Prison
- **Group Leader:** Raymond Baiphethi (Cell: `71374706`)
- **Second Leader:** Kenewang Ramontsho (Cell: `71430259`)
- **Meeting Time:** `1230 - 1400 hrs`
- **Physical Books Given Note (Setswana / English):** Bottom boxes blank; Left margin has language codes for all 12 rows (`5 Setswana [S]`, `7 English [E]`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.08.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Golebamang | Basupi | M | 48 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 2 | Kabo Ernest | Pheto | M | 33 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 3 | Aobakwe | Lesole | M | 40 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 4 | Kabelo | Rabasimane | M | 40 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 5 | Itumeleng Ronald | Paletona | M | 45 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 6 | Kefilwe Shaimus | Koitsiwe | M | 33 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 7 | Tomeletso | Lengwadibe | M | 29 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 8 | Kenneth | Mokopane | M | 63 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 9 | Oarabile | Kedisang | M | 45 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 10 | Othusitse | Mothudi | M | 45 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 11 | Simane | Mosinyi | M | 46 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 12 | Michael | King | M | 42 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |

*(Note: Rows 6 and 7 on Sheet 4 — Kefilwe Shaimus Koitsiwe, age 33, and Tomeletso Lengwadibe, age 29 — also appear on Sheet 3 Row 16 and Sheet 2 Row 16 respectively.)*

---

### 8. REGISTER 201 — Sheet 5 (Page 1 of 2)
- **Register No.:** Unnumbered (`REGISTER 201` Sheet 5)
- **Page:** Page 1 of 2
- **Meeting Place:** Mochudi State Prison
- **Group Leader:** Raymond Baiphethi (Cell: `71374706`)
- **Second Leader:** Kenewang Ramontsho (Cell: `71430259`)
- **Meeting Time:** `1230 - 1400 hrs`
- **Physical Books Given Note (Setswana / English):** Bottom boxes blank; Left margin has language codes for all 12 rows (`9 Setswana [S]`, `3 English [E]`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.09.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kgaroma | Moolosi | M | 24 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 2 | Kenneth | Phalagae | M | 50 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 3 | Ofentse | Letshwiti | M | 35 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 4 | Skinners | Phiri | M | 52 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 5 | Kaogile | Modise | M | 37 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 6 | Baboloki | Keebine | M | 44 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 7 | Mokgosang | Ramatlai | M | - | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 8 | Kabo | Osele | M | 40 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 9 | Pulengodisa | Ramokopane | M | 67 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 10 | Cliford Khotso | Phale | M | 42 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [E] |
| 11 | Poloko | Moepi | M | 44 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |
| 12 | Tebogo | Lekoko | M | 43 | 5777251 | - | - | Mochudi Prison | Inmate | 27 Oct | Yes (1) [S] |

---

### 9. REGISTER 202 (Page 2 of 2)
- **Register No.:** 202
- **Page:** Page 2 of 2
- **Meeting Place:** Kgamanyane School
- **Group Leader:** Katlego Nkatswang (Cell: `78247743`)
- **Second Leader:** Botho Lindi Phiri (Cell: `76616081`)
- **Meeting Time:** `02:00`
- **Physical Books Given Note (Setswana / English):** N/A (Page 2 of 2; Collected Book column blank)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.54 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Kalabetso | Makola | Female | 13 | 72503578 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 14 | Gofiwa | Kago | Female | 13 | 77890588 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 15 | Thato | Mogotlhwane | Female | 14 | 78021276 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 16 | Boineelo | Masire | Female | 14 | 76449624 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 17 | Kitso | Moeng | Female | 14 | 78888674 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 18 | Tumelo | Sebeke | Male | 14 | 71213219 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 19 | Sanikelo | Zitha | Male | 15 | 77762240 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 20 | Katso | - | Male | 15 | 74341993 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 21 | Atang | Gare | Male | 13 | 76763165 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 22 | Andy | Ratladi | Male | 15 | 77729260 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 23 | Albert | Modise | Male | 15 | - | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |
| 24 | Tumelo | Mooketsi | Female | 14 | 72321670 | Form 1 | Single | Kgamanyane | Student | 27 Oct | Yes (1) |

---

### 10. REGISTER 220 (Page 1 of 2)
- **Register No.:** 220
- **Page:** Page 1 of 2
- **Meeting Place:** Main Land Board
- **Group Leader:** Oarabile Makwatse (Cell: `76263830`)
- **Second Leader:** None
- **Meeting Time:** `15:00`
- **Physical Books Given Note (Setswana / English):** Setswana: Blank, English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.03.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kate | Thomas | F | 46 | 72713344 | Diploma | Single | Kgatleng Land Board | Principal Accounts Officer | 27 Oct | Yes (1) |
| 2 | Lesego | Mosite | F | 25 | 78278126 | Degree | Single | Kgatleng Land Board | Estate Intern | 27 Oct | Yes (1) |
| 3 | Precious | Mokgwati | F | 40 | 72528096 | Diploma | Married | Kgatleng Land Board | Estate Intern | 27 Oct | Yes (1) |
| 4 | Unami | Sedze | F | 34 | 76276944 | Degree | Single | Kgatleng Land Board | Ass EO | 27 Oct | Yes (1) |
| 5 | Onalenna | Mokgatlhe | F | 47 | 71826375 | Degree | Married | Kgatleng Land Board | Principal TO | 27 Oct | Yes (1) |
| 6 | Montshetsi | Mokane | M | 41 | 72277960 | Master | Single | Kgatleng Land Board | Snr Accountant | 27 Oct | Yes (1) |
| 7 | Keentseng | Morake | F | 36 | 77170613 | JC | Single | Kgatleng Land Board | Cleaner | 27 Oct | Yes (1) |
| 8 | Gomolemo | Tlou | M | 36 | 71328450 | Degree | Single | Kgatleng Land Board | Land Surveyor | 27 Oct | Yes (1) |
| 9 | Vincent | Jansen | M | 40 | 73407329 | U | Married | Kgatleng Land Board | SLBO | 27 Oct | Yes (1) |
| 10 | Olebile | Tshotlego | F | 56 | 73030725 | U | Married | Kgatleng Land Board | Accountant | 27 Oct | Yes (1) |

---

## 4. Reference Appendix A: Registers 1–50 & Associated Register 53 (Already Handed Over for Manual Entry)

> [!WARNING]
> **DO NOT IMPORT THIS SECTION BY DEFAULT.** Registers `1–50` (and `REGISTER 53`, led by Pulapela Pilane who also leads `REGISTER 28`) were already handed over for manual entry. They are included here only as a complete backup reference in case the user explicitly asks to verify or import them.

<!-- Batch 7 (Registers 22–28 & Associated 53) -->

### 1. REGISTER 22 (Page 1 of 2)
- **Register No.:** 22
- **Page:** Page 1 of 2
- **Meeting Place:** Ntshinoge Next to Medo Land Shop
- **Group Leader:** Lerato K. Moreti (Cell: `72123212`)
- **Second Leader:** None
- **Meeting Time:** 17:00 HRS
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.50 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Thato | Maikae | F | 35 | 75941003 | JC | S | - | Unemployed | None | Yes (1) |
| 2 | Kefilwe | Kediseng | F | 35 | 75230931 | JC | S | - | Unemployed | None | Yes (1) |
| 3 | Tebogo | Maekela | F | 39 | - | JC | S | - | Unemployed | None | Yes (1) |
| 4 | Sanka P. | Modise | F | 55 | 74335661 | JC | S | - | Unemployed | None | Yes (1) |
| 5 | Serwalo | Sefako | F | 45 | 72381843 | JC | M | - | Unemployed | None | Yes (1) |
| 6 | Malebogo J. | Moeng | F | 59 | 74086682 | JC | S | - | Unemployed | None | Yes (1) |
| 7 | Tsholofelo | Setia | M | 38 | 71791448 | JC | S | - | Unemployed | None | Yes (1) |
| 8 | Thabiso | Mothibe | F | 35 | 74805903 | JC | S | - | Unemployed | None | Yes (1) |
| 9 | Tumisang | Ruele | M | 33 | 77950745 | JC | S | - | Unemployed | None | Yes (1) |
| 10 | Oneile | Segomotso | F | 32 | 72405367 | JC | S | - | Unemployed | None | Yes (1) |
| 11 | Mangu | Ditshwego | F | 30 | 71149559 | JC | S | - | Unemployed | None | Yes (1) |
| 12 | Peo P. | Moraka | F | 20 | 78674314 | JC | S | - | Unemployed | None | Yes (1) |

---

### 2. REGISTER 25 (Page 1 of 2)
- **Register No.:** 25
- **Page:** Page 1 of 2
- **Meeting Place:** Makakatlela Kgotla
- **Group Leader:** Mogomotsi Chelane (Cell: `72768626`)
- **Second Leader:** Karabo Mmakgotso (Cell: `74320188`)
- **Meeting Time:** 12:00
- **Physical Books Given Note:** Setswana: `7` | English: `9`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.38 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Seemelo L. N. | Nkunyane | F | 42 | 74380773 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 2 | Kelebitse | Solomon | F | 24 | 76918711 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 3 | Boitumelo P. | Matswe | F | 51 | 75652547 | JC | M | Police | Cluster | 27 Oct | Yes (1) |
| 4 | Thabiso | Phiri | M | 21 | 78323092 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 5 | Cathrine | Ketetogile | F | 46 | 72654694 | JC | M | Police | Cluster | 27 Oct | Yes (1) |
| 6 | Kutlwano | Meswele | F | 32 | 75635790 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 7 | Matlhogonolo | Matshuba | F | 34 | 74176497 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 8 | Thuto | Nthite | F | 25 | 72236051 | BGCSE | S | Police | Cluster | 27 Oct | Yes (1) |
| 9 | Neo | Mafoko | F | 51 | 74771903 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 10 | Sekgabe | Modise | F | 33 | 77433428 | BGCSE | S | Police | Cluster | 27 Oct | Yes (1) |
| 11 | Bofelo | Motshegwe | F | 27 | 76373146 | BGCSE | S | Police | Cluster | 27 Oct | Yes (1) |
| 12 | Oregopotse | Kesebonye | M | 19 | 78719412 | JC | S | Police | Cluster | 27 Oct | Yes (1) |

---

### 3. REGISTER 25 (Page 2 of 2)
- **Register No.:** 25
- **Page:** Page 2 of 2
- **Meeting Place:** Makakatlela Kgotla
- **Group Leader:** Mogomotsi Chelane (Cell: `72768626`)
- **Second Leader:** Karabo Mmakgotso (Cell: `74320188`)
- **Meeting Time:** 12:00
- **Physical Books Given Note:** N/A (Page 2; Page 1 notes Setswana: `7`, English: `9`, total = 16)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.41 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 13 | Itshepeng | Moremi | M | 21 | 71867681 | JC | S | Police | Cluster | 27 Oct | Yes (1) |
| 14 | Unangoni L. | Tladi | M | 27 | 77408754 | BGCSE | S | Police | Cluster | 27 Oct | Yes (1) |
| 15 | Goitsemodimo | Lekwape | F | 31 | 75356417 | BGCSE | S | Police | Cluster | None | Yes (1) |
| 16 | Laone | Thekiso | M | 19 | 78678469 | JC | S | Police | Cluster | None | Yes (1) |

---

### 4. REGISTER 26 (Page 1 of 2)
- **Register No.:** 26
- **Page:** Page 1 of 2
- **Meeting Place:** Kgatleng Land Board - Main
- **Group Leader:** Olebile Leslie Mokgweetsi (Cell: `71477094`)
- **Second Leader:** None
- **Meeting Time:** 12:00
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.02 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Michael K. | Lebudi | M | 48 | 73800803 | B.A | Bachelor (S) | Kgatleng Land Board | Public Relations | 27 Oct | Yes (1) |
| 2 | Gotlhe | Kodutona | F | 40 | 74909190 | B.A | Divorced (D) | Kgatleng Land Board | Board Clerk | 27 Oct | Yes (1) |
| 3 | Thapelo Sabie | Sefako | F | 43 | 74194666 | JC | Single (S) | Kgatleng Land Board | Cleaner | 27 Oct | Yes (1) |
| 4 | Tsholofelo G. | Moima | F | 53 | 71495819 | Tertiary | Single (S) | Kgatleng Land Board | Principal Admin Officer | 27 Oct | Yes (1) |
| 5 | Mellcy | Ramatlhakwana | F | 52 | 78071616 | Cambridge | Married (M) | Kgatleng Land Board | Cleaner | 27 Oct | Yes (1) |
| 6 | Maureen | Letsatsi | F | 56 | 74049562 | JC | Single (S) | Kgatleng Land Board | Cleaner | 27 Oct | Yes (1) |
| 7 | Gotlhe | Kwadiba | F | 40 | 74431890 | B.A | Divorced (D) | Kgatleng Land Board | Principal Board Clerk | 27 Oct | Yes (1) |
| 8 | Khumo | Moatshe | F | 53 | 71229696 | Diploma (Record) | Single (S) | Kgatleng Land Board | Principal Records Officer | 27 Oct | Yes (1) |
| 9 | Mosidi | Mpebe | F | 59 | 71767921 | PSLE | Widow (W) | Kgatleng Land Board | Messenger | 27 Oct | Yes (1) |
| 10 | Gaolathe | Stephen | F | 48 | 75720463 | Diploma | Married (M) | Kgatleng Land Board | Customer Service Officer | 27 Oct | Yes (1) |
| 11 | Speedwell | Bebe | M | 43 | 73061481 | Tertiary | Single (S) | Kgatleng Land Board | Records Manager | 27 Oct | Yes (1) |
| 12 | Lorato | Moilwe | F | - | 74160304 | O-Level | Single (S) | Kgatleng Land Board | Messenger | 27 Oct | Yes (1) |

---

### 5. REGISTER 26 (Page 2 of 2)
- **Register No.:** 26
- **Page:** Page 2 of 2
- **Meeting Place:** Kgatleng Land Board - Main
- **Group Leader:** Olebile L. Mokgweetsi (Cell: `71477094`)
- **Second Leader:** None
- **Meeting Time:** 12:00
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.02.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 13 | K. | Morake | F | - | 5777217 | JC | Single (S) | Kgatleng Land Board | Cleaner | 27 Oct | Yes (1) |
| 14 | Mareen | Pheto | F | 48 | 73221030 | JC | Married (M) | Kgatleng Land Board | Switchboard Operator | 27 Oct | Yes (1) |

---

### 6. REGISTER 27 (Page 1 of 2)
- **Register No.:** 27
- **Page:** Page 1 of 2
- **Meeting Place:** Mochudi Sub Land Board
- **Group Leader:** Mogapi Molebatsi (Cell: `75888535`)
- **Second Leader:** None
- **Meeting Time:** 14:00 HRS
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.04.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | K. Shilpa | Kodisa | F | 42 | 73030746 | U | C | Mochudi SLB | Deputy SLBS | 27 Oct | Yes (1) |
| 2 | Keneilwe | Motlhamme | M | 50 | 72677005 | U | - | Mochudi SLB | PTO | 27 Oct, 4 Nov | Yes (1) |
| 3 | Baatweng | Tsomo | M | 48 | 74499528 | U | S | Mochudi SLB | PTO | 27 Oct | Yes (1) |
| 4 | Taboka Johanna | Cunningham | F | 43 | 75981276 | U | M | Mochudi SLB | BC | 27 Oct | Yes (1) |
| 5 | Kemiso | Gadinakgosi | M | - | 77599596 | U | S | Mochudi SLB | LAO | 27 Oct | Yes (1) |
| 6 | Lesedi M. | Morewanama | F | 47 | 71721618 | - | M | Mochudi SLB | Revenue | 27 Oct | Yes (1) |
| 7 | Moshe | Ntshole | M | - | 72753528 | - | M | Mochudi SLB | Accounts | 27 Oct | Yes (1) |
| 8 | Grace | Kgomari | F | 57 | 71640870 | S | S | Mochudi SLB | PA | 27 Oct | Yes (1) |
| 9 | Kgomotso | Selwe | F | 51 | 74776002 | D | M | Mochudi SLB | PCA | 27 Oct | Yes (1) |
| 10 | Lorato | Kgosidintsi | F | 40 | 72610969 | U | S | Mochudi SLB | LROI | 27 Oct | Yes (1) |
| 11 | Wapula | Gopane | F | 26 | 74525891 | U | S | Mochudi SLB | TSP LRO | 27 Oct | Yes (1) |
| 12 | Tlhotlhompho | Phokoje | F | 27 | 72143633 | U | S | Mochudi SLB | TSP Records | 27 Oct | Yes (1) |

---

### 7. REGISTER 27 (Page 2 of 2)
- **Register No.:** 27
- **Page:** Page 2 of 2
- **Meeting Place:** Mochudi Sub Land Board (continued from Page 1)
- **Group Leader:** Mogapi Molebatsi (Cell: `75888535`)
- **Second Leader:** None
- **Meeting Time:** 14:00 HRS
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.05.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 13 | Oratile | Pilane | F | 26 | 76167868 | U | S | Mochudi SLB | TSP LRO | 27 Oct | Yes (1) |
| 14 | Bonolo B. | Ralekgobo | F | 30 | 72301182 | U | S | Mochudi SLB | Cleaner | 27 Oct | Yes (1) |
| 15 | Mpho | Gouwe | F | 50 | 75456617 | - | S | Mochudi SLB | Messenger | 27 Oct | Yes (1) |
| 16 | Tshenolo | Letshiamo | F | 45 | 75249828 | U | S | Mochudi SLB | SBO | 27 Oct | Yes (1) |
| 17 | Thabang O. | Phiri | M | 24 | 75271478 | U | S | Mochudi SLB | TO Intern | 27 Oct | Yes (1) |
| 18 | Ntshebeng | Lesea | F | - | 71226711 | U | S | Mochudi SLB | Records Officer | 27 Oct | Yes (1) |
| 19 | Daniel | Kutuose | M | 42 | 73868872 | U | B (S) | Mochudi SLB | PRO | 27 Oct | Yes (1) |
| 20 | Segolame | Mafoko | F | 42 | 72254141 | U | M | Mochudi SLB | CSO | 27 Oct | Yes (1) |
| 21 | Vincent | Jansen | M | - | 74477692 | U | M | Mochudi SLB | SLRO | 27 Oct | Yes (1) |
| 22 | Tsholofelo | Sello | M | 52 | 71851051 | U | M | Mochudi SLB | Driver | 27 Oct | Yes (1) |
| 23 | Phuthego | Kgosile | M | 42 | 71213364 | U | M | Mochudi SLB | Driver | 27 Oct | Yes (1) |
| 24 | Boitshepo | Pilane | F | 45 | 72421179 | J | M | Mochudi SLB | Cleaner | 27 Oct | Yes (1) |

---

### 8. REGISTER 28 (Page 1 of 2)
- **Register No.:** 28
- **Page:** Page 1 of 2
- **Meeting Place:** Mabodisa Kgotla
- **Group Leader:** Pulafela Pilane (Cell: `74884465`)
- **Second Leader:** None
- **Meeting Time:** 7:00 - 7:30 HRS
- **Physical Books Given Note:** Setswana: `5` | English: `2`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.44 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Lebogang | Ntsimane | Female | 43 | 77075765 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 2 | Bapedi Ruth | Molomo | Female | 21 | 72461814 / 77595414 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 3 | Keneilwe | Monkge | Female | 23 | 77537359 | BGCSE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 4 | Khamo | Modimakwane | Female | 36 | 74527138 | PSLE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 5 | Goitseone | Makgwa | Female | 42 | 77016369 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 6 | Keneilwe Florah | Malela | Female | 35 | 74346010 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 7 | Eva | Malatlhwe | Female | 54 | 74808317 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |

---

### 9. REGISTER 53 (Page 1 of 2)
- **Register No.:** 53
- **Page:** Page 1 of 2
- **Meeting Place:** Pulafela Home (Mabodisa)
- **Group Leader:** Pulafela Pilane (Cell: `74884465`)
- **Second Leader:** None
- **Meeting Time:** 16:00 - 16:45 (30 - 45 minutes)
- **Physical Books Given Note:** Setswana: `4` | English: `4`
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.43 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Thuto Desmond | Tlhase | Male | 23 | 72282521 | BGCSE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 2 | Agang Theko K. | Motlotle | Male | 26 | 72667253 | BGCSE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 3 | Ame Alicia | Tlhase | Female | 18 | 72732407 | BGCSE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 4 | Onalenna | Tlhase | Female | 43 | 72633058 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 5 | Lucy Baboloki | Buisanyang | Female | 44 | 76025656 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 6 | Tsholofelo | Rakereng | Female | 30 | 71852660 | JCE | Single | - | Unemployed | 27 Oct | Yes (1) |
| 7 | Boitumelo Sophie | Modikwa | Female | 41 | 76230682 | JCE | Married | - | Unemployed | 27 Oct | Yes (1) |
| 8 | Tebo Calsiers | Tlhase | Male | 25 | 78094286 | BGCSE | Single | - | Unemployed | 27 Oct | Yes (1) |

---

<!-- Batch 8 (Registers 30–45) -->

### 1. REGISTER 30 (Page 1 of 2)
- **Register No.:** REGISTER 30
- **Page:** Page 1 of 2
- **Meeting Place:** BOSEJA 2 CLINIC
- **Group Leader:** DIKETSO KEITUMETSE (Cell: 73393319)
- **Second Leader:** None
- **Meeting Time:** Blank
- **Physical Books Given Note:** Setswana: Blank | English: `✓` (Ticked)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.33.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SEGOMOTSO | RAPALAI | F | 45 | 71267195 | Tertiary | Married | Boseja 2 | NURSE | 27 Oct | Yes (1) |
| 2 | PAULINE | MADISA | F | 41 | 71352995 | Tertiary | Married | Boseja 2 | NURSE | 27 Oct | Yes (1) |
| 3 | KEITUMETSE | TEBE | F | 46 | 71418526 | Tertiary | Married | Boseja 2 | HCA | 27 Oct | Yes (1) |
| 4 | TSHOLOFELO | MOGOCHA | F | 38 | 72671149 | Tertiary | Married | Boseja 2 | Pharmacy Technician | 27 Oct | Yes (1) |
| 5 | THATO | MONTSHO | F | 21 | 76197738 | Secondary | Single | Boseja 2 | TSP | 27 Oct | Yes (1) |
| 6 | LESEDI | DAVID | F | 39 | 75312553 | Tertiary | Married | Boseja 2 | HCA | 27 Oct | Yes (1) |
| 7 | BOTHO | GAETWESE | F | 41 | 71877251 | Tertiary | Single | Boseja 2 | HCA | 27 Oct | Yes (1) |
| 8 | KEDIMETSE | MOHAMETSI | M | 34 | 76608576 | Tertiary | Single | Boseja 2 | Nurse | 27 Oct | Yes (1) |
| 9 | OREDITSE | TASEBOLAI | F | 27 | 76365732 | Tertiary | Single | Boseja 2 | Nurse | 27 Oct | Yes (1) |
| 10 | WILLINGSON | EDWARD | M | 27 | 72204705 | Tertiary | Single | Boseja 2 | Nurse | 27 Oct | Yes (1) |
| 11 | BOIPELO | LETSHOLO | F | 28 | 76624123 | Tertiary | Single | Boseja 2 | Nurse | 27 Oct | Yes (1) |
| 12 | BONNO | MONNAKE | F | 47 | 77079905 | Tertiary | Married | Radikolo | Teacher | 27 Oct | Yes (1) |

---

### 2. REGISTER 30 (Page 2 of 2)
- **Register No.:** REGISTER 30
- **Page:** Page 2 of 2
- **Meeting Place:** Blank (BOSEJA 2 CLINIC on Page 1)
- **Group Leader:** Blank (DIKETSO KEITUMETSE, Cell: 73393319 on Page 1)
- **Second Leader:** None
- **Meeting Time:** Blank
- **Physical Books Given Note:** N/A (Page 2)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.32.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Keorapetse | Kgaogatswele (Koogotswele) | M | 42 | 72496069 | Tertiary | M (Married) | RADIKOLO | Teacher | 27 Oct | Yes (1) |

---

### 3. REGISTER 32 (Page 1 of 2)
- **Register No.:** REGISTER 32
- **Page:** Page 1 of 2
- **Meeting Place:** REHABILITATION DEPARTMENT
- **Group Leader:** LESEDI RAMABOKWA (Cell: 75097958)
- **Second Leader:** SALANG BINO MAJE (Cell: 71575472)
- **Meeting Time:** 1400hrs
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.48 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Lesego | Moagi | F | 51 | 72232723 | JC | Married | MRCB | Rehab Assistant | None | Yes (1) |
| 2 | Baboloki | Molwa | F | 47 | 72511046 | JC | Single | MRCB | Music Assistant | None | Yes (1) |
| 3 | Boikgantsho | R. | F | 46 | 77514994 | BGCSE | Single | MRCB | Braillist | None | Yes (1) |
| 4 | Thomas | Phorego | M | 51 | 72633672 | JC | Single | MRCB | Music Teacher | None | Yes (1) |

---

### 4. REGISTER 34 (Page 1 of 2)
- **Register No.:** REGISTER 34
- **Page:** Page 1 of 2
- **Meeting Place:** BOSEJA
- **Group Leader:** MONICAH MODISE (Cell: 71674801)
- **Second Leader:** ITUMELENG MODISE (Cell: 75693603)
- **Meeting Time:** 5pm - 6pm
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.09 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ONE MELITAH | MAGOTE | F | 30 | 77192272 | BGCSE | Single | — | Self employed | None | Yes (1) |
| 2 | ODIRILE MOSHE | METSWI | M | 33 | 77434554 | J (Junior) | SINGLE | — | EMPLOYED | None | Yes (1) |

---

### 5. REGISTER 39 (Page 1 of 2)
- **Register No.:** REGISTER 39
- **Page:** Page 1 of 2
- **Meeting Place:** KGATLENG REGIONAL OFFICE
- **Group Leader:** KATLEGO DINTSI (Cell: 71565240)
- **Second Leader:** THATAYAONE MHIKO (Cell: 71606805)
- **Meeting Time:** 1500HRS
- **Physical Books Given Note:** Setswana: `2` (handwritten top right: `2 - Sets`) | English: `3` (handwritten top right: `3 - Eng } Collected`); bottom boxes blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.46 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | MOLEFI | MAROPE | M | 59 | 77669734 | — | S (Single) | KGATLENG REGION | PLUMBER M & TS | None | Yes (1) |
| 2 | MPHO | SEBOKO | F | 51 | 71773744 | — | S (Single) | KGATLENG REGION | ADMIN OFFICER | None | Yes (1) |
| 3 | LESEGO | PHALAGAE | F | 54 | 71149828 | — | S (Single) | KGATLENG REGION | Switch board operator | None | Yes (1) |
| 4 | LESEGO | NTUTO | F | 50 | 72381611 | — | S (Single) | KGATLENG REGION | Procurement Officer | None | Yes (1) |
| 5 | LUCKY | LEGOISE | M | 42 | 7127004 | — | M (Married) | KGATLENG REGION | ADMIN OFFICER | None | Yes (1) |

---

### 6. REGISTER 42 (Page 1 of 2)
- **Register No.:** REGISTER 42
- **Page:** Page 1 of 2
- **Meeting Place:** MAKAKATLELA (BETWEEN STREAM & TARRED ROAD TO CLINIC)
- **Group Leader:** SEGALE VINCENT MONGALE (Cell: 78568739)
- **Second Leader:** PAUL SMUTS LEAGAJANG (Cell: 71565537)
- **Meeting Time:** 1730 - 1830
- **Physical Books Given Note:** Setswana: `10` | English: `12` (Individual rows also marked S or E in right margin)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.56 (3).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | KOTSOE | MOTSHEGWE | MALE | 67 | 71424246 | P (Primary) | S (Single) | S&CD DEV (KDC SECTOR) | RETIREE | 27 Oct | Yes (1) |
| 2 | SOOTLWE | RAMMALA | MALE | 74 | 71885245 | N/A | M (Married) | S&CD DEV (KDC SECTOR) | RETIREE | 27 Oct | Yes (1) |
| 3 | ISHMAEL | SEBISO | MALE | 62 | 71509085 | P (Primary) | M (Married) | S&CD DEV (KDC SECTOR) | BUILDER | 27 Oct | Yes (1) |
| 4 | MOOKETSI | MESWELE | MALE | 63 | 75362923 | P (Primary) | M (Married) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 5 | RAMONTSHO | BOATSU | MALE | — | 74758382 | P (Primary) | M (Married) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 6 | MOLEFE | CHELANE | MALE | 64 | 74141519 | P (Primary) | M (Married) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 7 | JEREMIAH | GARE | MALE | 67 | 71757384 | C (College) | M (Married) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 8 | LEFA REUBEN | MONGALE | MALE | 67 | 76905248 | P (Primary) | M (Married) | S&CD DEV (KDC SECTOR) | BUILDER | 27 Oct | Yes (1) |
| 9 | MAETO | TLAKGATHI | MALE | 66 | 71442576 | P (Primary) | M (Married) | S&CD DEV (KDC SECTOR) | RETIREE | 27 Oct | Yes (1) |
| 10 | GWAPENG | RADEBE | MALE | 61 | 71577026 | C (College) | M (Married) | S&CD DEV (KDC SECTOR) | ELECTRICIAN / WELDER | 27 Oct | Yes (1) |
| 11 | BAKANG | THUTOSEBISO | MALE | 34 | 76156511 | J (Junior) | S (Single) | S&CD DEV (KDC SECTOR) | PASTOR | 27 Oct | Yes (1) |
| 12 | BANANA | KEDISANG | MALE | 42 | 71694414 | J (Junior) | M (Married) | S&CD DEV (KDC SECTOR) | TAXI OPERATOR | 27 Oct | Yes (1) |

---

### 7. REGISTER 42 (Page 2 of 2)
- **Register No.:** REGISTER 42
- **Page:** Page 2 of 2
- **Meeting Place:** MAKAKATLELA (BETWEEN STREAM & TARRED ROAD TO THE CLINIC)
- **Group Leader:** SEGALE VINCENT MONGALE (Cell: 78568739)
- **Second Leader:** Blank on Page 2 (PAUL SMUTS LEAGAJANG, Cell: 71565537 on Page 1)
- **Meeting Time:** 1730 - 1830
- **Physical Books Given Note:** N/A (Page 2; Page 1 records Setswana: `10`, English: `12`)
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.56 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | MOLEFE | SEBIE | MALE | 42 | 73295312 | J (Junior) | S (Single) | S&CD DEV (KDC SECTOR) | FARMER | 27 Oct | Yes (1) |
| 14 | THEMBA | MABIRI | MALE | 41 | 71770104 | J (Junior) | S (Single) | S&CD DEV (KDC SECTOR) | FARMER | 27 Oct | Yes (1) |
| 15 | NCHEMELI FRANK | WESETSI | MALE | 27 | 78248899 | S (Senior) | S (Single) | S&CD DEV (KDC SECTOR) | FARMER | 27 Oct | Yes (1) |
| 16 | OSEGO | MABIRI | MALE | 36 | 72900463 | COLLEGE | S (Single) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 17 | BOIKHUTSO | LAKHWA | MALE | 43 | 78074659 | J (Junior) | S (Single) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 18 | FREDRICK | MOKONE | MALE | 73 | 71292944 | C (College) | M (Married) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 19 | JERRY | LETSHWITI | MALE | 54 | 76065961 | C (College) | S (Single) | — | FARMER | 27 Oct | Yes (1) |
| 20 | FAKUWE V. | MANGOLE | MALE | 66 | 71819090 | C (College) | M (Married) | S&CD DEV (KDC SECTOR) | RETIREE | 27 Oct | Yes (1) |
| 21 | DAVE | MOTSHEGWA | M | 53 | 71569764 | J (Junior) | S (Single) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |
| 22 | JOHNNY ONTHWESE | THEKISO | M | 41 | 72138831 | S (Senior) | S (Single) | S&CD DEV (KDC SECTOR) | SELF | 27 Oct | Yes (1) |

---

### 8. REGISTER 43 (Page 1 of 2)
- **Register No.:** REGISTER 43
- **Page:** Page 1 of 2
- **Meeting Place:** CORNERSTONE CHURCH
- **Group Leader:** SEGALE V. MONGALE (Cell: 78568739)
- **Second Leader:** None
- **Meeting Time:** 1800 HRS
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.55 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BOIKHUTSO | MOLEFE | F | — | 75588129 | J (Junior) | S (Single) | CFI | SELF | 27 Oct | Yes (1) |
| 2 | LERATO | MOLEFE | F | — | 71476178 | J (Junior) | S (Single) | CFI | SELF | 27 Oct | Yes (1) |
| 3 | MMALETSATSI | LEAGAJANG | F | 63 | 77650490 | S (Senior) | M (Married) | CFI | RETIRED | 27 Oct | Yes (1) |
| 4 | GALEBOE | RAMOTSEI | F | 50 | 76123894 | J (Junior) | M (Married) | ELOH CHURCH | SELF | 27 Oct | Yes (1) |
| 5 | HILDA | SEBAKO | F | 63 | 75974353 | J (Junior) | S (Single) | HAWKER | HAWKER | 27 Oct | Yes (1) |
| 6 | KITSO A. | MONGALE | F | 59 | 71636400 | U (University) | M (Married) | CFI | ADMINISTRATOR | 27 Oct | Yes (1) |
| 7 | WATHUTO K. | MONGALE | F | 28 | 77501494 | U (University) | S (Single) | CFI | ECONOMIST | 27 Oct | Yes (1) |
| 8 | MORGAN | LEAGAJANG | M | 58 | 72231053 | J (Junior) | M (Married) | HAWKER | HAWKER | 27 Oct | Yes (1) |
| 9 | MOKGOSI | LEAGAJANG | M | 69 | 75726410 | J (Junior) | M (Married) | DEBT COLLECTOR | DEBT COLLECTOR | 27 Oct | Yes (1) |
| 10 | LAWRENCE | LEAGAJANG | M | 71 | 71565537 | S (Senior) | M (Married) | FARMER | FARMER | 27 Oct | Yes (1) |

---

### 9. REGISTER 44 (Page 1 of 2)
- **Register No.:** REGISTER 44
- **Page:** Page 1 of 2
- **Meeting Place:** My Home Place
- **Group Leader:** Maria Lekgowe (Cell: 74658287)
- **Second Leader:** Blank Name (Cell: 77481960)
- **Meeting Time:** 18:00
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.56 (1).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Simon | Merenyane | M | 45 | 76154179 | JC | M (Married) | not working | — | 27 Oct, 28 Oct | Yes (1) |
| 2 | Sisi | Masilo | F | 49 | 75622683 | JC | M (Married) | working | Attorney General | 27 Oct, 28 Oct | Yes (1) |
| 3 | Lucky | Mosikare | F | 50 | 71814558 | JC | M (Married) | working | Dental Clinic | 27 Oct, 28 Oct | Yes (1) |
| 4 | Lorato | Lekgowe | F | 34 | 71745669 | Form 5 | S (Single) | not working | — | 27 Oct, 28 Oct | Yes (1) |
| 5 | Tshepo | Ratladi | M | 33 | 72472304 | Form 5 | S (Single) | not working | — | 27 Oct, 28 Oct | Yes (1) |
| 6 | Lizzy | Mangole | F | 57 | 77356418 | Form 5 | S (Single) | working | Teacher | 27 Oct, 28 Oct | Yes (1) |
| 7 | Lepogang | Mabalise | F | 31 | 76726018 | JC | S (Single) | not working | — | 27 Oct, 28 Oct | Yes (1) |
| 8 | Lucky | Kgote | F | 45 | 75155241 | JC | S (Single) | working | DRM | 27 Oct, 28 Oct | Yes (1) |
| 9 | Lorato | Sepako | F | 45 | 71366172 | JC | M (Married) | not working | — | 27 Oct, 28 Oct | Yes (1) |

---

### 10. REGISTER 45 (Page 1 of 2)
- **Register No.:** REGISTER 45
- **Page:** Page 1 of 2
- **Meeting Place:** Supplies / Stores
- **Group Leader:** Molatlhegi M. Kgakge (Cell: 71799232)
- **Second Leader:** None
- **Meeting Time:** 12:00
- **Physical Books Given Note:** Setswana: Blank | English: Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.06.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | MOKGATLE | L. W | M | 39 | 72137891 | DIPLOMA | SINGLE | KGATLENG LAND BOARD | PROCUREMENT | 27 Oct | Yes (1) |
| 2 | DINTSI | G. B | M | 46 | 75239847 | NCC | MARRIED | KGATLENG LAND BOARD | BUILDINGS | 27 Oct | Yes (1) |
| 3 | MMAWANE | O. | M | 56 | 71219009 | NCC | MARRIED | KGATLENG LAND BOARD | Auto Works | 27 Oct | Yes (1) |
| 4 | Masego | Segobaetso | F | 59 | 71536470 | JC | Married | Kgatleng Land Board | Driver | 27 Oct | Yes (1) |
| 5 | Nonofo | Pilane | M | 36 | 74435535 | — | Single | KGATLENG LAND BOARD | Driver | 27 Oct | Yes (1) |
| 6 | Amantle Motlhabani | Phirinyane | F | 57 | 71647616 | ADVANCED DIPLOMA | SINGLE | KGATLENG LAND BOARD | Procurement | 27 Oct | Yes (1) |
| 7 | Mpho | Moamogwa (Moganana) | M | — | 76550412 | — | Single | LandBoard | Driver | None | Yes (1) |
| 8 | David | Mosweu | M | — | 71452649 | — | Married | LandBoard | Driver | None | Yes (1) |
| 9 | Mongake | Mosala | M | — | 74574064 | — | Married | LandBoard | Driver | None | Yes (1) |
| 10 | Mmoloki | Mogotsi | M | — | 74557902 | — | Single | LandBoard | Auto Works | None | Yes (1) |
| 11 | Matshidiso | Pholo | M | — | 76765825 | — | Married | LandBoard | Driver | None | Yes (1) |
| 12 | Tebogo | Moagi | M | — | 71702060 | — | Married | LandBoard | Driver | None | Yes (1) |

---

## 5. Reference Appendix B: The 4 Remaining Unnumbered Register Groups (5 Pages, 54 Participants)

> [!NOTE]
> **AWAITING REGISTER NUMBERS.** These 4 groups did not have a register number written at the top right of the physical sheet. Do not import them under a numbered form until the user assigns form numbers to them.

### Unnumbered Group #1 — Boseja Central Ward (Page 2 of 2 | 10 Participants)
- **Register No.:** `[Unnumbered #1]`
- **Page:** Page 2 of 2
- **Meeting Place:** BOSEJA CENTRAL WARD
- **Group Leader:** Gomolemo S. Mmeko (Cell: `74498158`)
- **Second Leader:** Dimpho Tlhankane (Cell: `76938844`)
- **Meeting Time:** 12:00
- **Physical Books Given Note:** Collected 8 Setswana, 2 English
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.38.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Naledi Badiri | Ramokgwane | F | 42 | 74842542 / 76184121 | JC | Single | Ikageng | — | 27 Oct | Yes (1) |
| 14 | Tshegofatso | Ntshe | F | 40 | 74815086 / 75572252 | Cambridge | Single | Ikageng | — | 27 Oct | Yes (1) |
| 15 | Khomotso | Molemi | F | 51 | 71995842 / 72316342 | JC | Single | Ikageng | — | 27 Oct | Yes (1) |
| 16 | Matshidiso | Matlhare | F | 46 | 71787453 / 75322691 | JC | Single | Ikageng | — | 27 Oct | Yes (1) |
| 17 | Tsholofelo | Molefe | F | 35 | 72957394 / 77065087 | JC | Single | Ikageng | — | 27 Oct | Yes (1) |
| 18 | Irene | Molefe | F | 31 | 77446631 / 76785719 | JC | Single | Ikageng | — | 27 Oct | Yes (1) |
| 19 | Kenemene | Pheko | F | 34 | 71537951 / 75280847 | JC | Single | Ikageng | — | 27 Oct | Yes (1) |
| 20 | Angela | Tlhankane | F | 23 | 75394456 | BGCSE | Single | — | — | 27 Oct | Yes (1) |
| 21 | Warona | Tsheko | F | 19 | 78378902 | BGCSE | Single | — | — | 27 Oct | Yes (1) |
| 22 | Kabo | Dmuo (Dino) | M | 32 | 74331563 | BGCSE | Single | VDC | — | 27 Oct | Yes (1) |

---

### Unnumbered Group #2 — Mochudi Old Mall Near Spar (Page 1 & Page 2 | 22 Participants)
- **Register No.:** `[Unnumbered #2]`
- **Page:** Page 1 of 2 & Page 2 of 2
- **Meeting Place:** MOCHUDI OLD MALL NEAR SPAR
- **Group Leader:** Mmamothobi Lesotho (Cell: `71284693 / 77951356`)
- **Second Leader:** Kato David Mongalechwane (Cell: `71641996 / 72362925`)
- **Meeting Time:** 11:30 HRS
- **Physical Books Given Note:** Setswana: `11` | English: `11`
- **Image Filenames:** Page 1: `WhatsApp Image 2026-10-28 at 20.47.47 (2).jpeg` | Page 2: `WhatsApp Image 2026-10-28 at 20.47.46.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Joban | Masike | M | 41 | 76978379 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 2 | Joel | Masege | M | 44 | 71625408 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 3 | Pono | Mabibi | M | 45 | 72955825 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 4 | Molotsi | Tshwane | M | 46 | 72239812 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 5 | Mothibedi | Mogau | M | 38 | 71766236 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 6 | Thapelo | Tlhaso | M | 27 | 71732799 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 7 | Banana | Kepaletswe | M | 57 | 71747704 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 8 | Enock | Modise | M | 37 | 76332265 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 9 | Thuto | Moje | M | 26 | 74362935 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 10 | Tefo | Tlhakane | M | 27 | 72443615 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 11 | Tumi | Molefi | M | 25 | 75153641 | — | — | TAXI OD | — | 27 Oct | Yes (1) |
| 12 | Thapelo | Gare | M | 43 | 71149886 | — | — | — | — | 27 Oct | Yes (1) |
| 13 | Joshua | Ngwai | M | 33 | 75482315 | — | — | — | — | 27 Oct | Yes (1) |
| 14 | Richard | Modise | M | 39 | 78374881 | — | — | — | — | 27 Oct | Yes (1) |
| 15 | Thabiso | Motshega | M | 54 | 75919510 | — | — | — | — | 27 Oct | Yes (1) |
| 16 | Tshepiso | Theko | M | 33 | 72950229 | — | — | — | — | 27 Oct | Yes (1) |
| 17 | Kgomotso | Moeng | M | 37 | 71485645 | — | — | — | — | 27 Oct | Yes (1) |
| 18 | Mogakolodi | Mabibe | M | 26 | 74915500 | — | — | — | — | 27 Oct | Yes (1) |
| 19 | Daniel | Masege | M | 28 | 75297230 | — | — | — | — | 27 Oct | Yes (1) |
| 20 | Otsile | Ramotswetla | M | 54 | 77670970 | — | — | — | — | 27 Oct | Yes (1) |
| 21 | Molosi | Montsho | M | 72 | 71725994 | — | — | — | — | 27 Oct | Yes (1) |
| 22 | Kabelo | Moremi | M | 53 | 76180920 | — | — | — | — | 27 Oct | Yes (1) |

---

### Unnumbered Group #3 — Morwa Kgotla (Page 1 of 2 | 11 Participants)
- **Register No.:** `[Unnumbered #3]`
- **Page:** Page 1 of 2
- **Meeting Place:** Morwa Kgotla
- **Group Leader:** Boineelo Ipotseng (Cell: `75570423`)
- **Second Leader:** None
- **Meeting Time:** 11:45 hrs
- **Physical Books Given Note:** Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.47.56.jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Eric | Ntshole | M | 60 | 71744088 | S | M | Morwa Tribal | Kgosi | 27 Oct | Yes (1) |
| 2 | Kgetse | Ntshole | M | 78 | 71429379 | J | D | Tribal | Kgosana | 27 Oct | Yes (1) |
| 3 | Barongwa | Setlhabi | M | 48 | 71726676 | J | S | Tribal | Kgosana | 27 Oct | Yes (1) |
| 4 | Thabiso | Motsu | M | 58 | 71520245 | J | M | Tribal | Kgosana | 27 Oct | Yes (1) |
| 5 | Thabiso | Tladi | M | 64 | 76645955 | J | M | Tribal | Kgosana | 27 Oct | Yes (1) |
| 6 | Lebotse | Kgosi | M | 67 | 73868137 | S | S | Tribal | Kgosana | 27 Oct | Yes (1) |
| 7 | Pamela | Ntshole | F | 35 | 74677810 | S | S | Police | Police Officer | 27 Oct | Yes (1) |
| 8 | Boitumelo | Baatweng | F | 28 | 77725111 | S | M | Police | Police Officer | 27 Oct | Yes (1) |
| 9 | Dimpho | Motsamai | F | 39 | 77636577 | P | C | Tribal | Cleaner | 27 Oct | Yes (1) |
| 10 | Masiti | Masisi | F | 41 | 73701464 | J | M | Tribal | Court Bailiff | 27 Oct | Yes (1) |
| 11 | Onica | Kwapa | F | 31 | 75228262 | P | C | Police | Police Officer | 27 Oct | Yes (1) |

---

### Unnumbered Group #4 — Kgatleng Land Board (Page 1 of 2 | 11 Participants)
- **Register No.:** `[Unnumbered #4]`
- **Page:** Page 1 of 2
- **Meeting Place:** KGATLENG LAND BOARD
- **Group Leader:** Lesedi Gaone Kaone (Cell: `74430804`)
- **Second Leader:** None
- **Meeting Time:** 14:00 hrs
- **Physical Books Given Note:** Blank
- **Image Filename:** `WhatsApp Image 2026-10-28 at 20.48.03 (2).jpeg`

| Row | First Name | Last Name | Gender | Age | Contact | Education | Marital Status | Organisation / Workplace | Occupation | Attendance Marked (Dates) | Book Given |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Sesame | Letlhompha | F | 29 | 76163879 | Degree | M | Kgatleng LB | Attorney | 27 Oct | Yes (1) |
| 2 | Makang | Kgopole | F | 29 | 76286835 | Degree / U | S | Kgatleng LB | Attorney | 27 Oct | Yes (1) |
| 3 | Kedidimetse | Moroka | M | 36 | 71449744 | Degree / U | S | Kgatleng LB | IT | 27 Oct | Yes (1) |
| 4 | Patrick | David | M | 36 | 76022132 | Diploma | M | Kgatleng LB | Land Overseer | 27 Oct | Yes (1) |
| 5 | T. B. | Lekgowa | F | 43 | 73843316 | Diploma | S | KLB | POS | 27 Oct | Yes (1) |
| 6 | M. | Mogotsi | F | 43 | 75271035 | Degree | M | Kgatleng | Auditor | 27 Oct | Yes (1) |
| 7 | D. V. | Kiti | M | 52 | 77627477 | Deg | W | Kgatleng | LBS | 27 Oct | Yes (1) |
| 8 | Keitumetse | Modise | F | 46 | 73606838 | U | D | KLB | PHRAO | 27 Oct | Yes (1) |
| 9 | Onkgopotse | Sloma | F | 43 | 73863835 | U | S | KLB | HRO | 27 Oct | Yes (1) |
| 10 | Lesedi | Mpotokwane | F | 40 | 73601455 | U | D | SHRO (KLB) | KLB | 27 Oct | Yes (1) |
| 11 | Tiny | Sitang | F | 43 | 74843945 | U | S | Adjudication (KLB) | KLB | 27 Oct | Yes (1) |
