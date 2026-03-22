-- Run this in your Supabase SQL Editor to add contribution tracking

ALTER TABLE teams ADD COLUMN IF NOT EXISTS member_scores jsonb default '{}'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_by text;
