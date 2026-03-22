-- =============================================
-- SQL Spark — Fix Team Leave/Update RLS Policies
-- Run this in your Supabase SQL Editor
-- =============================================

-- Drop existing UPDATE policies that trap users (WITH CHECK trap & JSON object format trap)
DROP POLICY IF EXISTS "Team members and hackathon admins can update team" ON public.teams;
DROP POLICY IF EXISTS "Team members can update their teams" ON public.teams;

-- Recreate UPDATE policy with relaxed WITH CHECK
-- USING (old row): Evaluates if they have permission to initiate the update
-- WITH CHECK (new row): We must allow true, otherwise when they remove themselves, the new row is rejected!
CREATE POLICY "Team members and hackathon admins can update team"
    ON public.teams FOR UPDATE TO authenticated 
    USING (
        created_by = auth.jwt()->>'email'
        OR 
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
        OR
        -- Handle both JSON objects and plain string arrays from CSV imports safely
        members::text LIKE '%' || (auth.jwt()->>'email') || '%'
    )
    WITH CHECK (
        true
    );

-- Drop existing DELETE policies
DROP POLICY IF EXISTS "Team creators and hackathon admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON public.teams;

-- Recreate DELETE policy
-- Ensures that if someone is the very last member in a team (even if they didn't create it via CSV import), they can delete it.
CREATE POLICY "Team creators, admins, and sole remaining members can delete teams"
    ON public.teams FOR DELETE TO authenticated USING (
        created_by = auth.jwt()->>'email'
        OR 
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
        OR
        -- Allow deletion if they are the exact 1 sole remaining member in the array
        (
           members::text LIKE '%' || (auth.jwt()->>'email') || '%'
           AND jsonb_array_length(CASE WHEN jsonb_typeof(members) = 'array' THEN members ELSE '[]'::jsonb END) <= 1
        )
    );
