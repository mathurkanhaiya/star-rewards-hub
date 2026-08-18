import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Backend V2. Environment variables can override these values per deployment.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoppaqrqlpyqoizohoba.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
