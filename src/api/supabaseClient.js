import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'SQL Spark: Supabase credentials missing. Switching to Mock Mode (LocalStorage).'
    );
    window.IS_MOCK_MODE = true;

    // Fallback dummy client to prevent app crash
    supabase = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signUp: async () => ({ error: { message: 'Supabase not configured' } }),
            signInWithPassword: async () => ({ error: { message: 'Supabase not configured' } }),
            signOut: async () => ({ error: null }),
        },
        from: () => ({
            select: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                eq: () => ({
                    single: () => Promise.resolve({ data: null, error: null }),
                    select: () => ({ single: () => Promise.resolve({ data: null, error: null }) })
                }),
                single: () => Promise.resolve({ data: null, error: null })
            }),
            insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
            update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        })
    };
} else {
    window.IS_MOCK_MODE = false;
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
