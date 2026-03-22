-- =============================================
-- SQL Spark — Supabase IDOR Prevention (SELECT Policies)
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop the overly permissive SELECT policies that caused IDORs
DROP POLICY IF EXISTS "Authenticated users can read hackathons" ON hackathons;
DROP POLICY IF EXISTS "Authenticated users can read challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can read submissions" ON submissions;

-- (We intentionally DO NOT drop the teams SELECT policy, as the leaderboard requires all teams to be readable)

-- 1. HACKATHONS
-- Users can only read hackathons they created or that are published (not drafts)
CREATE POLICY "Users can read published hackathons or their own"
    ON hackathons FOR SELECT TO authenticated USING (
        status != 'draft' OR created_by = auth.jwt()->>'email'
    );

-- 2. CHALLENGES
-- Users can read challenges if they created the hackathon, OR if the hackathon is active/completed 
-- AND they are currently a member of a team in that hackathon.
CREATE POLICY "Creators and active participants can read challenges"
    ON challenges FOR SELECT TO authenticated USING (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
        OR
        (
            hackathon_id IN (SELECT id FROM hackathons WHERE status IN ('in_progress', 'completed'))
            AND 
            EXISTS (
                SELECT 1 FROM teams 
                WHERE teams.hackathon_id = challenges.hackathon_id 
                AND (teams.members::text LIKE '%' || (auth.jwt()->>'email') || '%')
            )
        )
    );

-- 3. SUBMISSIONS
-- Users can only read submissions from their own team, or if they are the hackathon admin.
CREATE POLICY "Users can read their own team's submissions or if admin"
    ON submissions FOR SELECT TO authenticated USING (
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
        OR
        team_id IN (
            SELECT id FROM teams 
            WHERE teams.members::text LIKE '%' || (auth.jwt()->>'email') || '%'
        )
    );
