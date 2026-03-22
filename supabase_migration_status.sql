-- Add status column to teams to track disqualifications
ALTER TABLE teams ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
