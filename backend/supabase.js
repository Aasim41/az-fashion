const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://qvbxzddasskinpasoszm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2Ynh6ZGRhc3NraW5wYXNvc3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODcxNTIyNSwiZXhwIjoyMTA0MjkxMjI1fQ.Z-39dbO6c8Yx9PE0ID2rLJ_lItMr78qx7i4nSAO-Zxg';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
