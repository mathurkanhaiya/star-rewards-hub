/**
 * Data migration script: old Supabase project → new Supabase project
 * Run with: npx tsx scripts/migrate-data.ts
 *
 * Reads data from old project (anon key) → writes to new project (service role key)
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL  = 'https://utfkqzmrcdfbnjdkjais.supabase.co';
const OLD_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Zmtxem1yY2RmYm5qZGtqYWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjY0MTIsImV4cCI6MjA4NzEwMjQxMn0.zrgDL29jdu6WcmqMEolBDID_21zsir5ASo0b1TKYL6k';

const NEW_URL  = 'https://sxuffcmantqbfhcxvwij.supabase.co';
const NEW_SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!NEW_SRK) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY env var not set');
  process.exit(1);
}

const oldDb = createClient(OLD_URL, OLD_ANON);
const newDb = createClient(NEW_URL, NEW_SRK);

// Tables ordered by dependency (parents first)
const TABLES_IN_ORDER = [
  'users',
  'balances',
  'settings',
  'promos',
  'tasks',
  'contests',
  'referrals',
  'user_roles',
  'transactions',
  'daily_claims',
  'spin_results',
  'ad_logs',
  'user_tasks',
  'promo_claims',
  'contest_entries',
  'tower_leaderboard',
  'tower_runs',
  'crash_leaderboard',
  'crash_rounds',
  'miner_progress',
  'miner_leaderboard',
  'lab_progress',
  'lab_leaderboard',
  'notifications',
  'withdrawals',
  'broadcasts',
  'admin_logs',
  'weekly_kings',
];

async function migrateTable(table: string): Promise<void> {
  process.stdout.write(`  Migrating ${table}... `);

  // Fetch all rows from old project (paginated)
  let allRows: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await (oldDb as any)
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      // Table might not exist or no SELECT permission — skip
      console.log(`⚠  skipped (${error.message})`);
      return;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  if (allRows.length === 0) {
    console.log('(empty)');
    return;
  }

  // Insert into new project in batches
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += batchSize) {
    const batch = allRows.slice(i, i + batchSize);
    const { error } = await (newDb as any)
      .from(table)
      .upsert(batch, { ignoreDuplicates: true });

    if (error) {
      console.log(`\n    ❌ insert error: ${error.message}`);
      return;
    }
    inserted += batch.length;
  }

  console.log(`✅ ${inserted} rows`);
}

async function main() {
  console.log('=== Supabase Data Migration ===');
  console.log(`FROM: ${OLD_URL}`);
  console.log(`TO:   ${NEW_URL}`);
  console.log('');

  // First, verify new project is reachable with the service role key
  const { error: pingError } = await newDb.from('users').select('id').limit(1);
  if (pingError && !pingError.message.includes('does not exist')) {
    console.error('❌ Cannot connect to new Supabase project:', pingError.message);
    console.error('   Make sure the SUPABASE_SERVICE_ROLE_KEY is correct.');
    process.exit(1);
  }

  if (pingError?.message.includes('does not exist')) {
    console.error('⚠️  Database schema not yet applied to new project!');
    console.error('   Please run supabase/schema.sql in the Supabase SQL Editor first.');
    console.error('   Then re-run this migration script.');
    process.exit(1);
  }

  console.log('✅ Connected to new project\n');

  for (const table of TABLES_IN_ORDER) {
    await migrateTable(table);
  }

  console.log('\n=== Migration complete! ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
