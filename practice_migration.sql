-- =============================================
-- SQL Spark — Practice Hub Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add practice columns to challenges table
ALTER TABLE challenges
    ADD COLUMN IF NOT EXISTS is_practice BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS inline_schema TEXT,
    ADD COLUMN IF NOT EXISTS platform_source TEXT, -- 'LeetCode', 'HackerRank', 'SQLZoo', etc.
    ADD COLUMN IF NOT EXISTS platform_number TEXT;  -- e.g. '175', '626'

-- 2. Create practice_submissions table
CREATE TABLE IF NOT EXISTS practice_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,           -- from auth (email)
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    query TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('correct', 'incorrect')),
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS for practice_submissions
ALTER TABLE practice_submissions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own submissions
CREATE POLICY "Users can read own practice submissions"
    ON practice_submissions FOR SELECT TO authenticated
    USING (user_id = auth.jwt()->>'email');

CREATE POLICY "Users can insert own practice submissions"
    ON practice_submissions FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.jwt()->>'email');

-- 4. Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_practice_submissions_user_id ON practice_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_is_practice ON challenges(is_practice);
