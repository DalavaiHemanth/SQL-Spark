-- =============================================
-- MULTI-ROUND HACKATHON MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- Add multi-round columns to hackathons table
ALTER TABLE hackathons
  ADD COLUMN IF NOT EXISTS total_rounds  int   DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_round int   DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rounds_config jsonb DEFAULT '[]';

-- rounds_config is an array of round objects:
-- [
--   { "round_number": 1, "name": "Round 1", "status": "upcoming"|"active"|"completed", "qualification_score": 50 },
--   { "round_number": 2, "name": "Round 2", "status": "upcoming", "qualification_score": null },
-- ]

-- Add per-round score tracking to teams
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS round_scores jsonb    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualified    boolean  DEFAULT true;

-- round_scores is a map of round_number (as string key) → score earned in that round
-- e.g., { "1": 120, "2": 80 }
-- total_score (already exists) = cumulative sum of all round scores

-- Add round_number to submissions so per-round results can be queried
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS round_number int DEFAULT 1;

-- Add round_number to challenges so they can be assigned to a specific round
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS round_number int DEFAULT 1;

-- Done! Existing hackathons default to 1 round (single-round behaviour unchanged)
