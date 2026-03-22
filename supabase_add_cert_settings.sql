-- Run this in your Supabase SQL Editor
ALTER TABLE hackathons 
ADD COLUMN IF NOT EXISTS certificate_settings JSONB DEFAULT '{}'::jsonb;
