import fs from "node:fs";
import path from "node:path";

export function getEnv(name, { required = false, defaultValue } = {}) {
    const v = process.env[name] ?? defaultValue;
    if (required && (v == null || String(v).trim() === "")) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return v;
}

export function resolveCredentialsPath() {
    const rawJson = process.env.HFF_GOOGLE_CREDENTIALS;
    if (rawJson && rawJson.trim().startsWith("{")) {
        try {
            return JSON.parse(rawJson);
        } catch (e) {
            console.warn("HFF_GOOGLE_CREDENTIALS found but failed to parse as JSON.");
        }
    }

    const explicit = process.env.HFF_GOOGLE_CREDENTIALS_PATH;
    if (explicit && String(explicit).trim() !== "") return path.resolve(process.cwd(), explicit);

    const root = process.cwd();
    try {
        const files = fs.readdirSync(root, { withFileTypes: true });
        const match = files.find(
            (d) =>
                d.isFile() &&
                d.name.startsWith("hff-dashboard-") &&
                d.name.endsWith(".json")
        );
        if (!match) {
            // In Vercel, we often depend on JSON in environment variables, so we only throw if we absolutely need it
            return null;
        }
        return path.resolve(root, match.name);
    } catch (e) {
        return null;
    }
}
