// Stub file to prevent bundler errors for Facilitator components
// that have not yet been migrated to Firebase.

export const supabase = {
    auth: {
        onAuthStateChange: () => {},
        signInWithPassword: () => {},
        signUp: () => {},
    },
    from: () => ({
        select: () => ({
            eq: () => ({
                single: () => ({ data: null }),
                maybeSingle: () => ({ data: null })
            })
        }),
        insert: () => ({ error: null }),
        update: () => ({ eq: () => ({ error: null }) })
    })
};

export const isConfigured = false;
