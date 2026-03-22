import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env from root
dotenv.config({ path: '../../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPublish() {
    const { data, error } = await supabase.from('hackathons').select('id, title, results_published').limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}

checkPublish();
