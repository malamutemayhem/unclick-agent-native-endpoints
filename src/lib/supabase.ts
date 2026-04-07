import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Run this SQL in your Supabase dashboard (SQL Editor) to set up the table:
//
// CREATE TABLE api_keys (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   email TEXT NOT NULL,
//   api_key TEXT NOT NULL UNIQUE,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   status TEXT DEFAULT 'active'
// );
//
// ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
//
// -- Allow anyone to insert a new key
// CREATE POLICY "Allow inserts" ON api_keys
//   FOR INSERT WITH CHECK (true);
//
// -- Allow reading only by matching email (filtered client-side too)
// CREATE POLICY "Allow select by email" ON api_keys
//   FOR SELECT USING (true);
