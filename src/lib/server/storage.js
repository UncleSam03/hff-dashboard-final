import db from './db.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'server/data/campaign_data.json');

async function migrateIfNeeded() {
    if (!db) return;
    try {
        const hasData = db.prepare('SELECT count(*) as count FROM participants').get().count > 0;
        const hasMetadata = db.prepare('SELECT count(*) as count FROM metadata').get().count > 0;

        if (!hasData && !hasMetadata) {
            try {
                const content = await fs.readFile(DATA_FILE, 'utf-8');
                const rows = JSON.parse(content);
                console.log(`[DB] Migrating ${rows.length} rows from JSON to SQLite...`);

                if (rows.length >= 2) {
                    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('header_row_0', JSON.stringify(rows[0]));
                    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('header_row_1', JSON.stringify(rows[1]));
                }

                const insert = db.prepare(`
                    INSERT INTO participants (external_id, first_name, last_name, gender, age, other_1, education, marital_status, other_2, occupation, attendance)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const transaction = db.transaction((participantRows) => {
                    for (const row of participantRows) {
                        insert.run(
                            String(row[0]),
                            row[1],
                            row[2],
                            row[3],
                            row[4],
                            row[5],
                            row[6],
                            row[7],
                            row[8],
                            row[9],
                            JSON.stringify(row.slice(10))
                        );
                    }
                });

                if (rows.length > 2) {
                    transaction(rows.slice(2));
                }
                console.log('[DB] Migration complete.');
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error('[DB] Migration failed:', err);
                } else {
                    console.log('[DB] No JSON found, initializing defaults.');
                    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('header_row_0', JSON.stringify(["No.", "First Name", "Last Name", "Gender", "Age", "Other", "Education", "Marital Status", "Other", "Occupation", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Day 11", "Day 12"]));
                    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('header_row_1', JSON.stringify(["", "", "", "", "", "", "", "", "", "DATE:", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]));
                }
            }
        }
    } catch (e) {
        console.warn("DB migration skipped:", e.message);
    }
}

migrateIfNeeded();

export async function readLocalData() {
    if (!db) return [];

    const h0 = JSON.parse(db.prepare('SELECT value FROM metadata WHERE key = ?').get('header_row_0')?.value || '[]');
    const h1 = JSON.parse(db.prepare('SELECT value FROM metadata WHERE key = ?').get('header_row_1')?.value || '[]');

    const participants = db.prepare('SELECT * FROM participants ORDER BY id ASC').all();

    const rows = [h0, h1];
    for (const p of participants) {
        const attendance = JSON.parse(p.attendance || '[]');
        rows.push([
            p.external_id || p.id,
            p.first_name,
            p.last_name,
            p.gender,
            p.age,
            p.other_1,
            p.education,
            p.marital_status,
            p.other_2,
            p.occupation,
            ...attendance
        ]);
    }
    return rows;
}

export async function writeLocalData(rows) {
    if (!db || !Array.isArray(rows) || rows.length < 2) return;

    const transaction = db.transaction((allRows) => {
        db.prepare('DELETE FROM participants').run();
        db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('header_row_0', JSON.stringify(allRows[0]));
        db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('header_row_1', JSON.stringify(allRows[1]));

        const insert = db.prepare(`
            INSERT INTO participants (external_id, first_name, last_name, gender, age, other_1, education, marital_status, other_2, occupation, attendance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of allRows.slice(2)) {
            insert.run(
                String(row[0]),
                row[1],
                row[2],
                row[3],
                row[4],
                row[5],
                row[6],
                row[7],
                row[8],
                row[9],
                JSON.stringify(row.slice(10))
            );
        }
    });

    transaction(rows);
}

export async function appendLocalData(newRow) {
    if (!db) return;
    const insert = db.prepare(`
        INSERT INTO participants (external_id, first_name, last_name, gender, age, other_1, education, marital_status, other_2, occupation, attendance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
        String(newRow[0]),
        newRow[1],
        newRow[2],
        newRow[3],
        newRow[4],
        newRow[5],
        newRow[6],
        newRow[7],
        newRow[8],
        newRow[9],
        JSON.stringify(newRow.slice(10))
    );
}
