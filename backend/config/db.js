const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

// Service-role client — bypasses RLS, for backend use only
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Quick connectivity check
(async () => {
  try {
    const { error } = await supabase.from('potholes').select('id', { count: 'exact', head: true });
    if (error) {
      // Table may not exist yet — that's okay on first run
      if (error.code === '42P01') {
        console.warn('⚠️  Supabase connected but tables do not exist yet. Run schema.sql in the Supabase SQL Editor.');
      } else {
        console.error('❌ Supabase connectivity check failed:', error.message);
      }
    } else {
      console.log('✅ Supabase database connected successfully');
    }
  } catch (err) {
    console.error('❌ Failed to connect to Supabase:', err.message);
  }
})();

module.exports = supabase;
