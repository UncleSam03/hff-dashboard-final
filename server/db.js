import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'server/data');
const DB_FILE = path.join(DB_DIR, 'campaign.db');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT,
        first_name TEXT,
        last_name TEXT,
        gender TEXT,
        age TEXT,
        other_1 TEXT,
        education TEXT,
        marital_status TEXT,
        other_2 TEXT,
        occupation TEXT,
        attendance TEXT -- JSON string array of 12 values
    );
`);

export default db;
