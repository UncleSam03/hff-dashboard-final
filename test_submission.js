import fetch from 'node-fetch';

const testXml = `
<data id="hff_register">
    <first_name>Test</first_name>
    <last_name>Participant</last_name>
    <Bong>2</Bong>
    <age>25</age>
    <education>University</education>
    <marital_status>Single</marital_status>
    <attendance_day>5</attendance_day>
    <meta>
        <instanceID>uuid:test-submission-${Date.now()}</instanceID>
    </meta>
</data>
`;

async function runTest() {
    console.log("Sending test submission...");
    try {
        const resp = await fetch('http://localhost:8787/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xml: testXml })
        });

        const json = await resp.json();
        console.log("Submission Response:", JSON.stringify(json, null, 2));

        if (resp.ok) {
            console.log("\nVerifying DB...");
            const statsResp = await fetch('http://localhost:8787/api/stats', {
                headers: { 'x-api-key': 'hff_v2_2026_sec_78e9a2b4' }
            });
            const stats = await statsResp.json();
            const latest = stats.participants[stats.participants.length - 1];

            console.log("Latest Participant:");
            console.log(JSON.stringify(latest, null, 2));
            console.log("\nCampaign Dates available:", JSON.stringify(stats.campaignDates));

            const day5Key = stats.campaignDates[4]; // Day 5
            console.log(`\nChecking key '${day5Key}': ${latest.attendance[day5Key] ? 'PRESENT' : 'ABSENT'}`);
        }
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

runTest();
