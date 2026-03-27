import fs from "node:fs";
import path from "node:path";

export function getEnv(name, { required = false, defaultValue } = {}) {
    const v = process.env[name] ?? defaultValue;
    if (required && (v == null || String(v).trim() === "")) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return v;
}
