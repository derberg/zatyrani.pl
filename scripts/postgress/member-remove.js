import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL and/or Anon Key are not set in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);


async function removeMember(id) {
    try {
        const { data, error } = await supabase
            .from('members')
            .delete()
            .eq('id', id)
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

const id = process.env.ID;

if (!id) {
  console.error('Please provide ID as environment variable.');
  process.exit(1);
}
removeMember(id);