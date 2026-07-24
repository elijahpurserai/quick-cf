import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase credentials missing in .env');
}

// Service role client for server-side operations (bypasses RLS)
export const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');
