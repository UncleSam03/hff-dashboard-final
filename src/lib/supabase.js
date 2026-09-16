// Legacy compatibility shim.
// Supabase has been fully replaced by Firebase.
// This file exists only so old import statements don't break at build time.
// All cloud sync now flows through firebaseSync.js.

export const supabase = null;
export const isConfigured = false;
