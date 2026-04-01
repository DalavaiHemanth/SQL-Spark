-- =============================================
-- SQL Spark — Team Join RPC
-- Safely handle joining teams by join code, bypassing RLS limitations for non-members.
-- Run this in your Supabase SQL Editor
-- =============================================

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
    -- 1. Get current user from auth context
    v_user_email := auth.jwt()->>'email';
    v_user_name := auth.jwt()->'user_metadata'->>'full_name';
    
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Fetch team and hackathon details
    SELECT t.*, h.status as h_status, h.start_time, h.end_time
    INTO v_team
    FROM teams t
    JOIN hackathons h ON t.hackathon_id = h.id
    WHERE t.id = p_team_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    -- 3. Verify join code (case-insensitive and trimmed)
    IF UPPER(TRIM(v_team.join_code)) != UPPER(TRIM(p_join_code)) THEN
        RAISE EXCEPTION 'Invalid join code';
    END IF;

    -- 4. Calculate effective status (mirroring JS logic in src/utils/index.ts)
    v_effective_status := v_team.h_status;
    IF v_team.h_status = 'registration_open' THEN
        IF v_now >= v_team.end_time THEN
            v_effective_status := 'completed';
        ELSIF v_now >= v_team.start_time THEN
            v_effective_status := 'in_progress';
        END IF;
    ELSIF v_team.h_status = 'in_progress' AND v_now >= v_team.end_time THEN
        v_effective_status := 'completed';
    END IF;

    IF v_effective_status != 'registration_open' THEN
        RAISE EXCEPTION 'Registration is not open for this hackathon (Status: %)', v_effective_status;
    END IF;

    -- 5. Check if already a member (standard member JSON structure)
    IF v_team.members::text LIKE '%' || v_user_email || '%' THEN
        RETURN jsonb_build_object(
            'id', v_team.id, 
            'name', v_team.name, 
            'already_member', true
        );
    END IF;

    -- 6. Add user to members array
    v_new_members := COALESCE(v_team.members, '[]'::jsonb) || jsonb_build_object(
        'email', v_user_email,
        'name', COALESCE(v_user_name, ''),
        'role', 'member'
    );

    -- 7. Perform the update as SECURITY DEFINER (bypasses RLS)
    UPDATE teams
    SET members = v_new_members
    WHERE id = p_team_id;

    -- 8. Return success data
    RETURN jsonb_build_object(
        'id', v_team.id, 
        'name', v_team.name, 
        'success', true
    );
END;
$$;
