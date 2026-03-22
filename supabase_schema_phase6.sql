-- =============================================
-- SQL Spark — Phase 6: Time-Based Hackathons & Results Control
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add time-based columns to hackathons
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS end_time timestamptz;

-- 2. Add results publishing control
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS results_published boolean DEFAULT false;

-- 3. Add violation tracking to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS violation_data jsonb;
