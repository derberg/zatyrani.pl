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

async function getMembers() {
  try {
    const { data, error } = await supabase.from('userdata').select('uid, name, phone');

    if (error) {
      console.error('Supabase query error:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('No members found.');
    } else {
      console.log('Members:');
      console.table(data);
    }
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
}

getMembers();