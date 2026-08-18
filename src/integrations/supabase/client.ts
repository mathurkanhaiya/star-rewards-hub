import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Backend V2 migration: force the app to the new project so stale Vercel env vars
// cannot silently route requests to the retired backend.
const SUPABASE_URL = 'https://eoppaqrqlpyqoizohoba.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
