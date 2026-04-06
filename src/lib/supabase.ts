import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Trūksta SUPABASE_URL arba SUPABASE_KEY aplinkos kintamųjų',
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
