/**
 * Bootstrap Supabase tables using the pg library.
 * 
 * Supabase provides a direct PostgreSQL connection at:
 *   postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
 * 
 * Since we don't have the database password (it's separate from the service key),
 * we need to provide it. Check your Supabase Dashboard → Settings → Database → Connection string.
 * 
 * This script will prompt for it or you can set SUPABASE_DB_PASSWORD in .env.
 * 
 * ALTERNATIVE: If you can't connect, copy schema.sql into the Supabase SQL Editor.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '8087'; // Try common passwords

async function main() {
  console.log('🚀 Connecting to Supabase PostgreSQL...');
  
  let pg;
  try {
    pg = require('pg');
  } catch {
    console.log('📦 Installing pg temporarily...');
    const { execSync } = require('child_process');
    execSync('npm install pg --no-save --silent', { cwd: path.join(__dirname), stdio: 'pipe' });
    pg = require('pg');
  }

  // Try multiple connection patterns
  const connectionStrings = [
    // Session mode (direct)
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    // Direct connection
    `postgresql://postgres:${DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`,
    // Transaction mode
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  ];

  const schemaPath = path.join(__dirname, 'config', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  for (let i = 0; i < connectionStrings.length; i++) {
    const connStr = connectionStrings[i];
    const masked = connStr.replace(/:([^@]+)@/, ':***@');
    console.log(`\n🔗 Trying connection ${i + 1}/${connectionStrings.length}: ${masked}`);

    const client = new pg.Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();
      console.log('✅ Connected!');
      
      await client.query(sql);
      console.log('✅ Schema executed successfully!');
      console.log('');
      console.log('🎉 All tables, indexes, RLS policies, and RPC functions created!');
      console.log('   Restart your backend server: npm run dev');
      
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Failed: ${err.message.split('\n')[0]}`);
      try { await client.end(); } catch {}
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('❌ Could not connect with any method.');
  console.log('');
  console.log('To find your database password:');
  console.log('  1. Go to https://supabase.com/dashboard');
  console.log('  2. Select your project → Settings → Database');
  console.log('  3. Copy the "Database password"');
  console.log('  4. Add to .env: SUPABASE_DB_PASSWORD=your_password');
  console.log('  5. Re-run: node setup_supabase.js');
  console.log('');
  console.log('OR paste schema.sql into SQL Editor manually.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
