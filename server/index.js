import express from "express";
import path from "node:path";
import cors from "cors";

import { parseHffRegisterRows } from "../src/lib/hffRegister.js";
import { readLocalData, writeLocalData, appendLocalData } from "./storage.js";
import { getEnv } from "./env.js";

const app = express();

// Security: Enable CORS and JSON limits
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Security: API Key Middleware
const API_KEY = getEnv("HFF_API_KEY", { defaultValue: "" });

const authenticate = (req, res, next) => {
  if (!API_KEY) return next(); // Skip if no key is configured (dev mode)

  const authHeader = req.headers["x-api-key"] || req.query.api_key;
  if (authHeader !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
  }
  next();
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Protect data endpoints
app.get("/api/stats", authenticate, async (req, res) => {
  try {
    console.log(`[API] GET /api/stats from ${req.ip} (source=${req.query.source || 'default'})`);
    const useCloud = req.query.source === "cloud";
    let values;
    let sourceName = "sqlite_database";

    if (useCloud) {
      const { readRegisterValues } = await import("./googleSheets.js");
      values = await readRegisterValues();
      sourceName = "google_sheets";
      // Optional: Cache cloud results to DB
      await writeLocalData(values);
    } else {
      values = await readLocalData();
    }

    const parsed = parseHffRegisterRows(values);
    const responseData = { ...parsed, source: sourceName, rawRows: values };
    const jsonString = JSON.stringify(responseData);
    console.log(`[API] /api/stats sending ${jsonString.length} bytes`);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (err) {
    console.error('[API] /api/stats error:', err);
    res.status(500).json({
      error: "Failed to load stats",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/cloud/sync", authenticate, async (_req, res) => {
  try {
    const { writeRegister } = await import("./googleSheets.js");
    const values = await readLocalData();

    console.log(`[API] Syncing ${values.length} rows to Google Sheets...`);
    await writeRegister(values);

    res.json({ ok: true, message: "Successfully synced to Google Sheets" });
  } catch (err) {
    console.error('[API] /api/cloud/sync error:', err);
    res.status(500).json({
      error: "Failed to sync to cloud",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.put("/api/register", authenticate, async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || !rows.every((r) => Array.isArray(r))) {
      return res.status(400).json({ error: "Body must be { rows: any[][] }" });
    }

    await writeLocalData(rows);

    // Optional: Auto-sync to cloud on write if configured
    const autoSync = getEnv("HFF_AUTO_SYNC_CLOUD", { defaultValue: "false" }) === "true";
    if (autoSync) {
      try {
        const { writeRegister } = await import("./googleSheets.js");
        await writeRegister(rows);
        console.log("[API] Auto-synced to Google Sheets");
      } catch (cloudErr) {
        console.error("[API] Auto-sync failed:", cloudErr.message);
      }
    }

    const parsed = parseHffRegisterRows(rows);
    res.json({ ok: true, ...parsed, rawRows: rows });
  } catch (err) {
    console.error('[API] /api/register error:', err);
    res.status(500).json({
      error: "Failed to write register",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});


app.post("/api/submissions", async (req, res) => {
  try {
    const { xml } = req.body || {};
    if (!xml) {
      return res.status(400).json({ error: "Body must contain 'xml'" });
    }

    console.log('[API] Received Enketo submission XML');

    const { enketoToHffRow } = await import("./enketoMapper.js");

    // Fetch existing values to determine next ID
    const values = await readLocalData();
    // Header is 2 rows, so length-2 is the current count
    const nextId = values.length - 1;

    const row = enketoToHffRow(xml, nextId);
    if (!row) {
      return res.status(400).json({ error: "Failed to parse XML submission" });
    }

    await appendLocalData(row);

    res.json({ ok: true, id: nextId });
  } catch (err) {
    console.error('[API] /api/submissions error:', err);
    res.status(500).json({
      error: "Failed to sync submission",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Basic static hosting option for production build (optional)
const serveDist = getEnv("HFF_SERVE_DIST", { defaultValue: "false" }) === "true";
if (serveDist) {
  const distDir = path.resolve(process.cwd(), "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const port = Number(getEnv("HFF_API_PORT", { defaultValue: "8787" }));
app.listen(port, () => {
  console.log(`[hff-dashboard] API listening on http://localhost:${port}`);
});


