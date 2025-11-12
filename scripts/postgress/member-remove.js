import dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL and/or Anon Key are not set in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);


async function removeMember(uid) {
    try {
        const { data, error } = await supabase
            .from('userdata')
            .delete()
            .eq('uid', uid)   // 👈 add this filter
            .select()

        if (error) {
            console.error('Supabase query error:', error);
            process.exit(1);
        }
        console.log("Successfully deleted")
        console.table(data);
    } catch (e) {
        console.error('Unexpected error:', e);
        process.exit(1);
    }
}

const uid = process.env.ID;

if (!uid) {
  console.error('Please provide ID as environment variable.');
  process.exit(1);
}
removeMember(uid);