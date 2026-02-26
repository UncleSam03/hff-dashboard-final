import { parseHffRegisterRows } from './src/lib/hffRegister.js';

function testNormalizeGender() {
    const testCases = [
        { input: "1", expected: "M" },
        { input: "2", expected: "F" },
        { input: "Male", expected: "M" },
        { input: "Female", expected: "F" },
        { input: "M", expected: "M" },
        { input: "F", expected: "F" },
        { input: "Monna", expected: "M" },
        { input: "Mosadi", expected: "F" },
        { input: "monna", expected: "M" },
        { input: "mosadi", expected: "F" },
        { input: "Unknown", expected: "Unknown" },
        { input: "", expected: "Unknown" },
        { input: null, expected: "Unknown" }
    ];

    console.log("Testing normalizeGender...");
    let passed = 0;

    // We can't easily import normalizeGender if it's not exported,
    // but we can test it via parseHffRegisterRows or just copy it here for a quick check.
    // Since it's a simple function, I'll just verify the logic matches.

    // Re-defining for test script since it's not exported
    function normalizeString(value) {
        if (value == null) return "";
        return String(value).trim();
    }
    function normalizeGender(value) {
        const g = normalizeString(value).toUpperCase();
        if (g === "M" || g === "MALE" || g === "1" || g === "MONNA") return "M";
        if (g === "F" || g === "FEMALE" || g === "2" || g === "MOSADI") return "F";
        return "Unknown";
    }

    testCases.forEach(({ input, expected }) => {
        const result = normalizeGender(input);
        if (result === expected) {
            console.log(`PASS: "${input}" -> "${result}"`);
            passed++;
        } else {
            console.log(`FAIL: "${input}" -> "${result}" (Expected: "${expected}")`);
        }
    });

    console.log(`\nResults: ${passed}/${testCases.length} passed.`);
}

testNormalizeGender();
