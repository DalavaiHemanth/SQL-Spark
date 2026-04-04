-- =============================================
-- SQL Spark — Performance & Concurrency Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create Normalized Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'member',
    created_at timestamptz DEFAULT now(),
    UNIQUE(team_id, email)
);

-- 2. Migrate Existing Data (Safe)
-- This copies data from teams.members (JSONB) to the new table
INSERT INTO team_members (team_id, email, full_name, role)
SELECT 
    t.id as team_id,
    m->>'email' as email,
    m->>'name' as full_name,
    COALESCE(m->>'role', 'member') as role
FROM teams t, jsonb_array_elements(t.members) AS m
ON CONFLICT (team_id, email) DO NOTHING;

-- 3. Add High-Performance Indexes
-- For Submission queries and Triggers
CREATE INDEX IF NOT EXISTS idx_submissions_team_status ON submissions(team_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions(challenge_id);
-- For RLS Membership checks
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- 4. Refactor RLS Policies (The "Speed Boost")
-- First remove the old slow policies
DROP POLICY IF EXISTS "Team members and hackathon admins can update team" ON teams;
DROP POLICY IF EXISTS "Team members can insert submissions" ON submissions;

-- NEW EFFECIENT POLICIES using EXISTS
CREATE POLICY "Team members (fast) update team"
    ON teams FOR UPDATE TO authenticated USING (
        created_by = auth.jwt()->>'email'
        OR 
        hackathon_id IN (SELECT id FROM hackathons WHERE created_by = auth.jwt()->>'email')
        OR
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE team_id = teams.id AND email = auth.jwt()->>'email'
        )
    );

CREATE POLICY "Team members (fast) insert submissions"
    ON submissions FOR INSERT TO authenticated WITH CHECK (
        team_id IN (
            SELECT id FROM teams 
            WHERE created_by = auth.jwt()->>'email' 
            OR EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_id = teams.id AND email = auth.jwt()->>'email'
            )
        )
    );

-- Enable RLS on the new table
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own memberships"
    ON team_members FOR SELECT TO authenticated USING (
        email = auth.jwt()->>'email' OR 
        team_id IN (SELECT id FROM teams WHERE created_by = auth.jwt()->>'email')
    );

-- 5. Optimized Sync Trigger
-- (Updates total_score only when necessary)
CREATE OR REPLACE FUNCTION sync_team_stats_optimized()
RETURNS trigger AS $$
BEGIN
    UPDATE teams
    SET 
        total_score = (
            SELECT COALESCE(SUM(sub.max_score), 0)
            FROM (
                SELECT MAX(score) as max_score
                FROM submissions
                WHERE team_id = COALESCE(new.team_id, old.team_id)
                AND status = 'correct'
                GROUP BY challenge_id
            ) sub
        ),
        challenges_completed = (
            SELECT COUNT(DISTINCT challenge_id)
            FROM submissions
            WHERE team_id = COALESCE(new.team_id, old.team_id)
            AND status = 'correct'
        )
    WHERE id = COALESCE(new.team_id, old.team_id);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Replace old trigger
DROP TRIGGER IF EXISTS trg_sync_team_stats ON submissions;
CREATE TRIGGER trg_sync_team_stats
AFTER INSERT OR UPDATE OR DELETE ON submissions
FOR EACH ROW
EXECUTE FUNCTION sync_team_stats_optimized();

-- 6. Update Join Team RPC to handle normalized table
CREATE OR REPLACE FUNCTION join_team(p_team_id uuid, p_join_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email text;
    v_user_name text;
    v_team record;
    v_now timestamptz := now();
    v_new_members jsonb;
    v_effective_status text;
BEGIN
    v_user_email := auth.jwt()->>'email';
    v_user_name := auth.jwt()->'user_metadata'->>'full_name';
    
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT t.*, h.status as h_status, h.start_time, h.end_time
    INTO v_team
    FROM teams t
    JOIN hackathons h ON t.hackathon_id = h.id
    WHERE t.id = p_team_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    IF UPPER(TRIM(v_team.join_code)) != UPPER(TRIM(p_join_code)) THEN
        RAISE EXCEPTION 'Invalid join code';
    END IF;

    -- Basic status check
    IF v_team.h_status NOT IN ('registration_open', 'in_progress') THEN
        RAISE EXCEPTION 'Registration is not open';
    END IF;

    -- Check if already a member in normalized table (Fast)
    IF EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND email = v_user_email) THEN
        RETURN jsonb_build_object('id', v_team.id, 'name', v_team.name, 'already_member', true);
    END IF;

    -- 1. Update JSONB (for backward compatibility during deployment)
    v_new_members := COALESCE(v_team.members, '[]'::jsonb) || jsonb_build_object(
        'email', v_user_email,
        'name', COALESCE(v_user_name, ''),
        'role', 'member'
    );

    UPDATE teams SET members = v_new_members WHERE id = p_team_id;

    -- 2. Insert into Normalized Table (For future performance)
    INSERT INTO team_members (team_id, email, full_name, role)
    VALUES (p_team_id, v_user_email, v_user_name, 'member')
    ON CONFLICT (team_id, email) DO NOTHING;

    RETURN jsonb_build_object('id', v_team.id, 'name', v_team.name, 'success', true);
END;
$$;
