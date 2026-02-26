import Dexie from 'dexie';

export const db = new Dexie('HFF_Dashboard_V2');

// Schema Setup: UUID, name, gender, age, 12-day attendance array, sync_status
// Schema Setup: UUID, name, gender, age, 12-day attendance array, sync_status
db.version(1).stores({
    participants: '++id, uuid, name, gender, age, sync_status'
});

db.version(2).stores({
    participants: '++id, uuid, name, gender, age, sync_status',
    registrations: '++id, uuid, first_name, last_name, type, facilitator_uuid, sync_status'
});

db.version(5).stores({
    participants: '++id, uuid, name, gender, age, sync_status, created_at, updated_at',
    registrations: '++id, uuid, first_name, last_name, type, facilitator_uuid, sync_status, created_at, updated_at, education, marital_status'
});

export default db;
