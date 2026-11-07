import json
import re
import glob

# Load current audit
with open('scripts/group_audit_results.json', 'r', encoding='utf-8') as f:
    groups = json.load(f)

# Master lookup dictionary for register headers
# We extract headers from all markdown files in Registers/
header_lookup = {}

md_files = glob.glob('C:/Users/samuk/Documents/Registers/*.md')
for md_path in md_files:
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    current_reg = None
    for line in lines:
        m_reg = re.search(r'REGISTER\s+([0-9]+[A-Z]?(?:\s+[A-Z])?)', line, re.IGNORECASE)
        if m_reg and ('####' in line or '###' in line or '**REGISTER' in line or '| REGISTER' in line or '| Grp' in line):
            current_reg = m_reg.group(1).strip().upper()
            if current_reg not in header_lookup:
                header_lookup[current_reg] = {}
        
        # Check table line e.g. | REGISTER 22 | Page 1 of 2 | Lerato L. Morei (72123212) | Ntshinoge Next to Medoland Shop (17:00) |
        if '|' in line and current_reg:
            parts = [p.strip() for p in line.split('|')]
            for p in parts:
                if re.search(r'REGISTER\s+' + current_reg, p, re.IGNORECASE):
                    # Table row!
                    # Often: [empty, Grp/Reg, Page, Leader(Phone), Place(Time), ...]
                    pass
        
        if current_reg:
            m_leader = re.search(r'\*\*Group Leader(?:\(s\))?:\*\*\s*`?([^`|\(\n]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)\n]+)`?\))?', line, re.IGNORECASE)
            if m_leader:
                name = m_leader.group(1).strip()
                cell = m_leader.group(2).strip() if m_leader.group(2) else ''
                if name and not name.lower().startswith('unassigned') and not name.lower().startswith('none'):
                    header_lookup[current_reg]['leader'] = name
                if cell:
                    header_lookup[current_reg]['cell'] = cell
            
            m_place = re.search(r'\*\*Meeting Place:\*\*\s*`?([^`|\(\n]+)`?(?:\s*\(`?([^`\)\n]+)`?\))?', line, re.IGNORECASE)
            if m_place:
                place = m_place.group(1).strip()
                time = m_place.group(2).strip() if m_place.group(2) else ''
                if place and not place.lower().startswith('none'):
                    header_lookup[current_reg]['place'] = place
                if time:
                    header_lookup[current_reg]['time'] = time
            
            m_time = re.search(r'\*\*Meeting Time:\*\*\s*`?([^`\n]+)`?', line, re.IGNORECASE)
            if m_time:
                time = m_time.group(1).strip()
                if time and not time.lower().startswith('none'):
                    header_lookup[current_reg]['time'] = time

# Add manual overrides from Remaining_Registers_Notes.pdf
pdf_headers = {
    '22': {'leader': 'Lerato L. Morei', 'cell': '72123212', 'place': 'Ntshinoge Next to Medoland Shop', 'time': '17:00'},
    '25': {'leader': 'Mogomotsi Chelane & Karabo Mmakgotso', 'cell': '72765626 / 74330188', 'place': 'Makakatlela Kgotla', 'time': '12:00'},
    '26': {'leader': 'Olebile Leslie Mokgweetsi', 'cell': '71477094', 'place': 'Kgatleng Land Board - Main', 'time': '12:00'},
    '27': {'leader': 'Mogapi Molebatsi', 'cell': '75888535', 'place': 'Mochudi Sub Land Board', 'time': '14:00 HR'},
    '28': {'leader': 'Pulapela Pilane', 'cell': '74884465', 'place': 'Mabodisa Kgotla', 'time': '7:00 - 7:30 hrs'},
    '30': {'leader': 'Dikeledi Keikaletswe', 'cell': '73393319', 'place': 'Boseja 2 Clinic', 'time': 'Not specified'},
    '32': {'leader': 'Lesedi Ramabokwa & Salang Bino Maje', 'cell': '75097958 / 71575472', 'place': 'Rehabilitation Department', 'time': '14:00 hrs'},
    '34': {'leader': 'Monicah Modise & Itumeleng Modise', 'cell': '71674801 / 75693603', 'place': 'Boseja', 'time': '5pm - 6pm'},
    '39': {'leader': 'Katlego Dintsi & Thatayaone Mhico', 'cell': '71565240 / 71606805', 'place': 'Kgatleng Regional Office', 'time': '15:00 HRS'},
    '42': {'leader': 'Sefako Vincent Mongale & Paul Sports Leagatjang', 'cell': '78568739 / 71565537', 'place': 'Makakatlela', 'time': '17:30 - 18:30'},
    '43': {'leader': 'Sefako V. Mongale', 'cell': '78568739', 'place': 'Cornerstone Church', 'time': '18:00 HRS'},
    '44': {'leader': 'Maria Lekgowe', 'cell': '74658287 / 77481960', 'place': 'My Home Place', 'time': '18:00'},
    '45': {'leader': 'Madalatsi M. Kg...', 'cell': '71799232', 'place': 'Supplies / Stores — Kgatleng Land Board', 'time': '12:00'},
    '53': {'leader': 'Pulapela Pilane', 'cell': '74884465', 'place': 'Pulapela Home, Mabodisa', 'time': '16:00 - 16:45'},
    '54': {'leader': 'Lone Tshegofatso Moitoi', 'cell': '71689270', 'place': 'Lone home Mabalisa', 'time': '17:00'},
    '58': {'leader': 'Khutsafalo Kgodungwe & Malebogo Setlhabi', 'cell': '72728148 / 78675522', 'place': 'Mmusi P. School', 'time': '16:30'},
    '59': {'leader': 'Babedi Moroope & Tebogo E. Modisagae', 'cell': '75854127 / 76193699', 'place': 'Tigers F Club', 'time': '5:00'},
    '60': {'leader': 'Babedi Moroope & Estheri Modisagae', 'cell': '75854127 / 76193699', 'place': 'Makgophana Kgotla', 'time': '12:00'},
    '63': {'leader': 'Tebogo E. Modisagae & Babetli Moraope', 'cell': '76193699 / 75854127', 'place': 'Makgophana Kgotla', 'time': '7:00'},
    '65': {'leader': 'Sharon T. B. Phiri', 'cell': '72804348', 'place': 'Home Mabodisa', 'time': '17:30'},
    '72': {'leader': 'Seakgosing Nkope Molefe & Tefo Simane', 'cell': '72422804 / 72799040', 'place': 'VDC offices Moganetsi Kgotla', 'time': '7:30'},
    '73': {'leader': 'Neo Matlhaga', 'cell': '77036887', 'place': 'Masiana Kgotla', 'time': '17:00 HRS'},
    '75': {'leader': 'Seanokeng Selala & Rivonia M. Tlhase', 'cell': '71803346 / 77060006', 'place': 'Ntshinoge, Next to Kagiso Bar', 'time': '11:30'},
    '85': {'leader': 'Bogo Moitoi & Matlhodi Sarah Molefe', 'cell': '76418118 / 78354037', 'place': 'Makgophana Ward', 'time': '12:30 HRS'},
    '98': {'leader': 'Alecah Kotsedi & Phatsima Sello', 'cell': '74190365 / 78247718', 'place': 'Pilane Kgotla', 'time': '12:00'},
    '104': {'leader': 'Josephine Mathibe & Mpho Ramotho', 'cell': '71565643 / 75009303', 'place': 'Boseja', 'time': '03:00 pm'},
    '106': {'leader': 'Lebogang Makgae', 'cell': '75966118', 'place': 'Boseja Behind IPCC', 'time': '5:00 - 6:30 PM'},
    '107': {'leader': 'Thabang P. Modimakwane', 'cell': '72993400', 'place': 'Lady Mitchison School / Neighbours', 'time': '07:30 hrs'},
    '108': {'leader': 'Onkarabile Mlambo', 'cell': '73192609', 'place': 'Plot 8285 Boseja South', 'time': '16:30'},
    '116': {'leader': 'Oikabetse K. Ramoele & Onkabetse Ramotsele', 'cell': '75349459 / 75686300', 'place': 'Morema, Plot 19518 After Main Kgotla', 'time': '17:00'},
    '121': {'leader': 'Bojelo Mmakgabo & Lesego Mothofela', 'cell': '77649305 / 77040635', 'place': 'Pavement Route 9 / Paving Slabs', 'time': '2:00 pm'},
    '128': {'leader': 'Boago Leshomo & Wabo Venda', 'cell': '77826267 / 74406246', 'place': 'Wildlife & National Parks', 'time': '14:00 HRS'},
    '129': {'leader': 'Boago Leshomo & Wabo Venda', 'cell': '77826267 / 74406246', 'place': 'Wildlife & National Parks', 'time': '14:00 HRS'},
    '132': {'leader': 'Onica Rammapa', 'cell': '71464954', 'place': 'Magophana', 'time': '14:00 HRS'},
    '136': {'leader': 'Olebogeng Fedwane & Boitumelo Moeng', 'cell': '75991025 / 75412919', 'place': 'Makgophana Clinic', 'time': '13:00'},
    '141': {'leader': 'Mrs. S. Sikwane', 'cell': '75493040', 'place': 'Mmadipamo P. School', 'time': '14:30 hrs'},
    '143': {'leader': 'Thato Mosate / Bakang Modise / Bakeng Molefe', 'cell': '78719592 / 74704731 / 76312112', 'place': 'Makgophana / Bogatsu Primary School', 'time': '07:00 / 12:30'},
    '159': {'leader': 'Botsalo Leungo Rakgole', 'cell': '72110158', 'place': "Madiane's house", 'time': '12:00'},
    '171': {'leader': 'Bomme Ba Thapelo & Gagoipone Tsheko', 'cell': '71611285 / 74291406', 'place': 'Clinic 1 Mochudi', 'time': '2:00 pm'},
    '172': {'leader': 'Dineo Sereko & Boledi P. Tsoane', 'cell': '72522488 / 72600130', 'place': 'Rankoa P. School', 'time': '14:30'},
    '174 A': {'leader': 'Selinah Sefakwe', 'cell': '72395409 / 74515520', 'place': 'Morula route 5', 'time': '6:00 am'},
    '174 B': {'leader': 'Selinah Sefakwe', 'cell': '72395409 / 74515520', 'place': 'Kgotla Boseja South', 'time': '7:00 am'},
    '175': {'leader': 'Emmanuel Katlego Ketsitlile', 'cell': '76931562', 'place': 'Fire Dept', 'time': '07:30'},
    '182': {'leader': 'Tseone B. Lemogo', 'cell': '71770905', 'place': 'Plot 10226 Phaphane', 'time': '8:00 PM'},
    '183': {'leader': 'Tshegofatso Lebotse & Nicolas Sefako / Onalepelo Dipogiso', 'cell': '73495184 / 76934521', 'place': 'Seingwaeng P. School', 'time': '07:30 - 08:00 am'},
    '185': {'leader': 'Kagiso Moitoi & Kabo Maxala', 'cell': '77777169 / 72958870', 'place': 'Education Regional Office', 'time': '15:00 hrs'},
    '188': {'leader': 'Lesego F. Tlhage & Mma Kgwetane', 'cell': '74173510', 'place': 'Isang P. School', 'time': '13:00 PM'},
    '189': {'leader': 'Segametsi Setshwane & Ahueng Masaka', 'cell': '71542193 / 74441865', 'place': 'At home', 'time': '8:00 pm'},
    '190': {'leader': 'Segametsi Setshwane & Mmamokola Gouwe', 'cell': '71542193 / 72509327', 'place': 'At home', 'time': '20:00'},
    '196': {'leader': 'Otshegeditswe Mofisa', 'cell': '75512007', 'place': 'Mmathubudukwane Police Station', 'time': '15:00'},
    '197': {'leader': 'Olebogeng Tona', 'cell': '72795831', 'place': 'Mmathubudukwane', 'time': '07:30'},
    '198': {'leader': 'Boitshelo Tshukudu', 'cell': '74875510', 'place': 'Malotwana Kgotla / Police', 'time': '08:00'},
    '201': {'leader': 'Raymond Baiphethi & Kenewang Ramontsho', 'cell': '71374706 / 71430259', 'place': 'Mochudi State Prison', 'time': '12:30 - 14:00'},
    '202': {'leader': 'Katlego Nkatswang & Botho Lindi Phiri', 'cell': '78247743 / 76616081', 'place': 'Kgamanyane School', 'time': '14:00'},
    '220': {'leader': 'Onneile Makwatse / Oarabile Mokgatse', 'cell': '76263830', 'place': 'Main Land Board', 'time': '15:00'},
    '222': {'leader': 'Boineelo Ipotseng', 'cell': '75570423', 'place': 'Morwa Kgotla', 'time': '11:45 hrs'},
    '225': {'leader': 'Mmapula Rammala', 'cell': '72569127', 'place': 'MOREMA WARD VDC OFFICE', 'time': '17:00 hrs'},
    '36': {'leader': 'Tony Maripe / Phemelo Babusi Team', 'cell': '77657552 / 72968392', 'place': 'Mochudi Central', 'time': '14:00'},
}

# Merge all into header_lookup
for k, v in pdf_headers.items():
    if k not in header_lookup:
        header_lookup[k] = {}
    for sub_k, sub_v in v.items():
        header_lookup[k][sub_k] = sub_v

# Enrich groups
enriched_count = 0
for g in groups:
    key = g['formNumber'].upper()
    alt_key = re.sub(r'\D', '', key)
    
    match_meta = header_lookup.get(key) or header_lookup.get(alt_key)
    if match_meta:
        if ('Unassigned' in g['facilitatorName'] or not g['facilitatorName']) and match_meta.get('leader'):
            g['facilitatorName'] = match_meta['leader']
            enriched_count += 1
        if (g['contact'] == 'Not provided' or not g['contact']) and match_meta.get('cell'):
            g['contact'] = match_meta['cell']
            enriched_count += 1
        if (g['meetingPlace'] == 'Not provided' or g['meetingPlace'] == 'Mochudi' or not g['meetingPlace']) and match_meta.get('place'):
            g['meetingPlace'] = match_meta['place']
            enriched_count += 1
        if (g['meetingTime'] == 'Not specified' or not g['meetingTime']) and match_meta.get('time'):
            g['meetingTime'] = match_meta['time']
            enriched_count += 1

print(f"Enriched {enriched_count} metadata points across groups.")

with open('scripts/group_audit_enriched.json', 'w', encoding='utf-8') as f:
    json.dump(groups, f, indent=2)

print("Saved enriched audit to scripts/group_audit_enriched.json")
