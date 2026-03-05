import Dexie from 'dexie';

/**
 * HFF_Offline_DB — Enketo XML submission queue
 * 
 * NOTE: This is a SEPARATE database from HFF_Dashboard_V2 (see dexieDb.js).
 * - HFF_Offline_DB: stores raw Enketo XML submissions for sync to the Express/Next.js backend
 * - HFF_Dashboard_V2: stores structured registrations/participants for sync to Supabase
 * 
 * The syncManager.js orchestrates both sync pipelines.
 */
export const db = new Dexie('HFF_Offline_DB');

db.version(1).stores({
  submissions: '++id, uuid, status, createdAt, updatedAt',
});

/**
 * Saves a new submission to the offline database.
 */
export async function saveSubmission(modelXml) {
  const submission = {
    uuid: crypto.randomUUID(),
    modelXml,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return await db.submissions.add(submission);
}

/**
 * Gets all pending submissions.
 */
export async function getPendingSubmissions() {
  return await db.submissions.where('status').equals('pending').toArray();
}

/**
 * Marks a submission as synced.
 */
export async function markAsSynced(id) {
  return await db.submissions.update(id, {
    status: 'synced',
    updatedAt: new Date(),
  });
}

/**
 * Deletes a submission.
 */
export async function deleteSubmission(id) {
  return await db.submissions.delete(id);
}
