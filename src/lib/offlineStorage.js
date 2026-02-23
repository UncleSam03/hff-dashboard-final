import Dexie from 'dexie';

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
