-- SQL Migration: Automatic Team Score Synchronization
-- This script ensures that teams.total_score and teams.challenges_completed 
-- are always in sync with the submissions table.

-- 1. Create the sync function
create or replace function sync_team_stats()
returns trigger as $$
begin
    -- Update the team's total score and completed challenges count
    -- based on 'correct' submissions only.
    update teams
    set 
        total_score = (
            select coalesce(sum(score), 0)
            from submissions
            where team_id = coalesce(new.team_id, old.team_id)
            and status = 'correct'
        ),
        challenges_completed = (
            select count(distinct challenge_id)
            from submissions
            where team_id = coalesce(new.team_id, old.team_id)
            and status = 'correct'
        )
    where id = coalesce(new.team_id, old.team_id);
    
    return null;
end;
$$ language plpgsql;

-- 2. Create the trigger
-- We use a trigger that fires after insert, update, or delete on submissions
drop trigger if exists trg_sync_team_stats on submissions;
create trigger trg_sync_team_stats
after insert or update or delete on submissions
for each row
execute function sync_team_stats();

-- 3. Initial sync (Optional but recommended to fix any existing drift)
update teams t
set 
    total_score = (
        select coalesce(sum(score), 0)
        from submissions
        where team_id = t.id
        and status = 'correct'
    ),
    challenges_completed = (
        select count(distinct challenge_id)
        from submissions
        where team_id = t.id
        and status = 'correct'
    );
