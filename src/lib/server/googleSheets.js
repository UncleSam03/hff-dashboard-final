import { google } from "googleapis";
import { getEnv, resolveCredentialsPath } from "./env.js";

let cached = null;

async function getSheetsClient() {
    if (cached) return cached;

    const creds = resolveCredentialsPath();
    const authOptions = {
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    };

    if (!creds) {
        throw new Error("Google credentials not found for sheets integration.");
    }

    if (typeof creds === "string") {
        authOptions.keyFile = creds;
    } else {
        authOptions.credentials = creds;
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    cached = google.sheets({ version: "v4", auth });
    return cached;
}

export function getSpreadsheetConfig() {
    const spreadsheetId = getEnv("HFF_SPREADSHEET_ID", { required: true });
    const registerSheetName = getEnv("HFF_REGISTER_SHEET_NAME", { defaultValue: "Register" });
    const readRange = getEnv("HFF_REGISTER_READ_RANGE", {
        defaultValue: `${registerSheetName}!A1:ZZ5000`,
    });

    return { spreadsheetId, registerSheetName, readRange };
}

export async function readRegisterValues() {
    const sheets = await getSheetsClient();
    const { spreadsheetId, readRange } = getSpreadsheetConfig();

    const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: readRange,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
    });

    return resp.data.values || [];
}

export async function clearRegister() {
    const sheets = await getSheetsClient();
    const { spreadsheetId, registerSheetName } = getSpreadsheetConfig();

    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${registerSheetName}!A1:ZZ5000`,
    });
}

export async function writeRegister(values) {
    const sheets = await getSheetsClient();
    const { spreadsheetId, registerSheetName } = getSpreadsheetConfig();

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${registerSheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: {
            majorDimension: "ROWS",
            values,
        },
    });
}

export async function appendRegister(rows) {
    const sheets = await getSheetsClient();
    const { spreadsheetId, registerSheetName } = getSpreadsheetConfig();

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${registerSheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: rows,
        },
    });
}

export async function getAvailableSheets() {
    const sheets = await getSheetsClient();
    const spreadsheetId = getEnv("HFF_SPREADSHEET_ID", { required: true });

    const resp = await sheets.spreadsheets.get({
        spreadsheetId,
    });

    return resp.data.sheets.map((s) => s.properties.title);
}
