import { google } from "googleapis";
import { resolveCredentialsPath, getEnv } from "./server/env.js";

async function listSheets() {
    const creds = resolveCredentialsPath();
    const authOptions = {
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    };

    if (typeof creds === "string") {
        authOptions.keyFile = creds;
    } else {
        authOptions.credentials = creds;
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = getEnv("HFF_SPREADSHEET_ID", { required: true });

    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        const sheetTitles = response.data.sheets.map(s => s.properties.title);
        console.log("Sheet titles found:", sheetTitles);
    } catch (error) {
        console.error("Error fetching spreadsheet:", error.message);
        if (error.response && error.response.data) {
            console.error("Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

listSheets();
