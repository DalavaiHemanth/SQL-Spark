-- Enable Realtime for the teams table
-- This allows the Global Leaderboard to update instantly when scores change

-- 1. Add the table to the supabase_realtime publication
alter publication supabase_realtime add table teams;

-- 2. Ensure RLS policies allow for viewing (usually already done, but for safety)
-- The leaderboard is global, so authenticated users should be able to see the results.
-- These lines are just reminders, yours may vary based on your existing setup.
-- alter table teams replica identity full;
