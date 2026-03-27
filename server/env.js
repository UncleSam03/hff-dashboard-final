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

