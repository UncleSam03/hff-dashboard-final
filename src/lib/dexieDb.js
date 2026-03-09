import Dexie from 'dexie';

export const db = new Dexie('HFF_Dashboard_V2');

/**
 * Dexie Schema History
 * 
 * Versions must be sequential for safe IndexedDB upgrades.
 * Versions 3-8 are backfill entries to bridge the gap from v2→v9.
 */

// v1: Initial — participants only
db.version(1).stores({
    participants: '++id, uuid, name, gender, age, sync_status'
});

// v2: Added registrations table
db.version(2).stores({
    participants: '++id, uuid, name, gender, age, sync_status',
    registrations: '++id, uuid, first_name, last_name, type, facilitator_uuid, sync_status'
});

// v3-v8: Bridge versions (same schema as v2, needed for sequential upgrade path)
const v2Schema = {
    participants: '++id, uuid, name, gender, age, sync_status',
    registrations: '++id, uuid, first_name, last_name, type, facilitator_uuid, sync_status'
};
db.version(3).stores(v2Schema);
db.version(4).stores(v2Schema);
db.version(5).stores(v2Schema);
db.version(6).stores(v2Schema);
db.version(7).stores(v2Schema);
db.version(8).stores(v2Schema);

// v9: Previous schema 
db.version(9).stores({
    participants: '++id, uuid, name, gender, age, sync_status, created_at, updated_at',
    registrations: '++id, uuid, first_name, last_name, type, facilitator_uuid, sync_status, created_at, updated_at, education, marital_status, processed, processed_at, is_deleted, attendance, books_received'
});

// v10: Added affiliation and occupation
db.version(10).stores({
    participants: '++id, uuid, name, gender, age, sync_status, created_at, updated_at',
    registrations: '++id, uuid, first_name, last_name, type, facilitator_uuid, sync_status, created_at, updated_at, education, marital_status, processed, processed_at, is_deleted, attendance, books_received, affiliation, occupation'
});

export default db;
