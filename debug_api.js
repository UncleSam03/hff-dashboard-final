// Native fetch available in Node v24

async function test() {
    const API_KEY = "hff_v2_2026_sec_78e9a2b4";
    const url = "http://localhost:8787/api/stats";

    console.log(`Testing ${url}...`);
    try {
        const resp = await fetch(url, {
            headers: { 'x-api-key': API_KEY }
        });

        console.log(`Status: ${resp.status}`);
        const text = await resp.text();
        console.log(`Response length: ${text.length}`);

        if (text.length === 0) {
            console.error("ERROR: Response body is EMPTY!");
        } else {
            const json = JSON.parse(text);
            console.log("JSON is valid.");
            console.log("Keys in response:", Object.keys(json));
            if (json.participants) {
                console.log(`Participants count: ${json.participants.length}`);
            }
        }
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

test();
