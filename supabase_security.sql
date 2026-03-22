-- =============================================
-- SQL Spark — Supabase Security & RLS Updates
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Helper function to get secure server time for frontend timers
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT now();
$$;

-- 2. Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert hackathons" ON hackathons;
DROP POLICY IF EXISTS "Authenticated users can update hackathons" ON hackathons;
DROP POLICY IF EXISTS "Authenticated users can delete hackathons" ON hackathons;

DROP POLICY IF EXISTS "Authenticated users can insert challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can update challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can delete challenges" ON challenges;

DROP POLICY IF EXISTS "Authenticated users can insert teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON teams;

DROP POLICY IF EXISTS "Authenticated users can insert submissions" ON submissions;
DROP POLICY IF EXISTS "Authenticated users can update submissions" ON submissions;
DROP POLICY IF EXISTS "Authenticated users can delete submissions" ON submissions;

-- 3. Create Stricter Policies

-- HACKATHONS
CREATE POLICY "Users can insert hackathons"
    ON hackathons FOR INSERT TO authenticated WITH CHECK (auth.jwt()->>'email' IS NOT NULL);

CREATE POLICY "Creators can update their own hackathons"
    ON hackathons FOR UPDATE TO authenticated USING (created_by = auth.jwt()->>'email');

CREATE POLICY "Creators can delete their own hackathons"
    ON hackathons FOR DELETE TO authenticated USING (created_by = auth.jwt()->>'email');

-- CHALLENGES
CREATE POLICY "Hackathon creators can insert challenges"
    ON challenges FOR INSERT TO authenticated WITH CHECK (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
    );

CREATE POLICY "Hackathon creators can update challenges"
    ON challenges FOR UPDATE TO authenticated USING (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
    );

CREATE POLICY "Hackathon creators can delete challenges"
    ON challenges FOR DELETE TO authenticated USING (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
    );

-- TEAMS
CREATE POLICY "Users can create teams"
    ON teams FOR INSERT TO authenticated WITH CHECK (auth.jwt()->>'email' IS NOT NULL);

CREATE POLICY "Team members and hackathon admins can update team"
    ON teams FOR UPDATE TO authenticated USING (
        created_by = auth.jwt()->>'email'
        OR 
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
        OR
        EXISTS (
            SELECT 1 FROM jsonb_array_elements(members) AS m 
            WHERE m->>'email' = auth.jwt()->>'email'
        )
    );

CREATE POLICY "Team creators and hackathon admins can delete teams"
    ON teams FOR DELETE TO authenticated USING (
        created_by = auth.jwt()->>'email'
        OR 
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
    );

-- SUBMISSIONS
CREATE POLICY "Team members can insert submissions"
    ON submissions FOR INSERT TO authenticated WITH CHECK (
        team_id IN (
            SELECT id FROM teams 
            WHERE created_by = auth.jwt()->>'email' 
            OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(members) AS m 
                WHERE m->>'email' = auth.jwt()->>'email'
            )
        )
    );

CREATE POLICY "Hackathon admins can update submissions"
    ON submissions FOR UPDATE TO authenticated USING (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
    );

CREATE POLICY "Hackathon admins can delete submissions"
    ON submissions FOR DELETE TO authenticated USING (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
    );
