import { DOMParser } from '@xmldom/xmldom';

/**
 * Parses Enketo XML and returns a row for the HFF Register.
 */
export function enketoToHffRow(xml, nextId = "") {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        const getValue = (tagName) => {
            const elements = doc.getElementsByTagName(tagName);
            if (elements && elements.length > 0) {
                return elements[0].textContent || "";
            }
            const allElements = doc.documentElement.getElementsByTagName("*");
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i].localName === tagName) {
                    return allElements[i].textContent || "";
                }
            }
            return "";
        };

        const firstName = getValue('first_name');
        const lastName = getValue('last_name');

        if (!firstName && !lastName) {
            console.warn('[Mapper] Empty submission ignored (no name found)');
            return null;
        }

        const dayStr = getValue('attendance_day') || getValue('day');
        const dayNum = parseInt(dayStr, 10);

        const attendance = Array(12).fill("");
        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 12) {
            attendance[dayNum - 1] = "1";
        }

        const genderTags = ['gender', 'Sex', 'sex', 'q_gender', 'participant_gender', 'Bong'];
        let genderValue = "";
        for (const tag of genderTags) {
            genderValue = getValue(tag);
            if (genderValue) break;
        }

        return [
            nextId,                 // 0: No.
            firstName,              // 1: First Name
            lastName,               // 2: Last Name
            genderValue,            // 3: Gender
            getValue('age'),        // 4: Age
            "",                     // 5: Other
            getValue('education'),  // 6: Education
            getValue('marital_status'), // 7: Marital Status
            "",                     // 8: Other
            getValue('occupation'), // 9: Occupation
            ...attendance           // 10-21: Day 1-12
        ];

    } catch (e) {
        console.error('[Mapper] Error parsing Enketo XML:', e);
        return null;
    }
}
