-- ========================================================
-- SQL SPARK — PUBLIC USER DATA FOR LEADERBOARD
-- ========================================================
-- This function allows everyone to see current display names 
-- and avatars for the leaderboard, even if the "teams" JSON 
-- is outdated or incomplete.

create or replace function get_public_leaderboard_users()
returns table (
  email text,
  full_name text,
  avatar_style text,
  avatar_seed text
) 
security definer
set search_path = public
as $$
begin
  return query
  select 
    au.email::text,
    (au.raw_user_meta_data->>'full_name')::text,
    (au.raw_user_meta_data->>'avatar_style')::text,
    (au.raw_user_meta_data->>'avatar_seed')::text
  from auth.users au;
end;
$$ language plpgsql;

-- Grant access to everyone (authenticated)
grant execute on function get_public_leaderboard_users() to authenticated;
grant execute on function get_public_leaderboard_users() to anon;
