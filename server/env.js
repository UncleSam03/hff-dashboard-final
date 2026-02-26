import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load local overrides first, then defaults
dotenv.config({ path: path.resolve(process.cwd(), ".env.development.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export function getEnv(name, { required = false, defaultValue } = {}) {
  const v = process.env[name] ?? defaultValue;
  if (required && (v == null || String(v).trim() === "")) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function resolveCredentialsPath() {
  // 1. Direct JSON string from env (best for Vercel/Cloud)
  const rawJson = process.env.HFF_GOOGLE_CREDENTIALS;
  if (rawJson && rawJson.trim().startsWith("{")) {
    try {
      // Return the object directly if it looks like JSON
      return JSON.parse(rawJson);
    } catch (e) {
      console.warn("HFF_GOOGLE_CREDENTIALS found but failed to parse as JSON.");
    }
  }

  // 2. Explicit path
  const explicit = process.env.HFF_GOOGLE_CREDENTIALS_PATH;
  if (explicit && String(explicit).trim() !== "") return path.resolve(process.cwd(), explicit);

  // 3. Fallback: look for a service account JSON in project root named like hff-dashboard-*.json
  const root = process.cwd();
  const files = fs.readdirSync(root, { withFileTypes: true });
  const match = files.find(
    (d) =>
      d.isFile() &&
      d.name.startsWith("hff-dashboard-") &&
      d.name.endsWith(".json")
  );
  if (!match) {
    throw new Error(
      "Could not resolve Google credentials. Set HFF_GOOGLE_CREDENTIALS (JSON string) or HFF_GOOGLE_CREDENTIALS_PATH in your environment."
    );
  }
  return path.resolve(root, match.name);
}

