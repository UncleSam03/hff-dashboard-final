// Dummy file to replace the old Supabase integration.
// By exporting isConfigured = false, the app's components (like FacilitatorDashboard and FacilitatorOnboarding)
// will gracefully fall back to the offline-first Dexie database, and our new firebaseSync.js
// will handle pushing those local changes to Firebase in the background.

export const supabase = null;
export const isConfigured = false;
