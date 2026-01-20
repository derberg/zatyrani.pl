import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and/or Anon Key are not set in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const name = process.env.NAME;
const phone = process.env.PHONE;

if (!name || !phone) {
  console.error('Please provide both name and phone as environment variables.');
  process.exit(1);
}

async function addMember() {
  try {
    const { data, error } = await supabase
      .from('members')
      .insert([{ name, phone }])
      .select();

    if (error) {
      console.error('Supabase query error:', error);
      process.exit(1);
    }

    console.log('Successfully added member:');
    console.table(data);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
}

addMember();