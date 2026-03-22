-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Function to get all users (Admin only)
create or replace function get_users()
returns table (
  id uuid,
  email varchar,
  role text,
  last_sign_in_at timestamptz,
  created_at timestamptz
) 
security definer
as $$
begin
  -- Check if the caller is an admin
  if (auth.jwt() -> 'user_metadata' ->> 'role') != 'admin' then
    raise exception 'Access denied: Admin only';
  end if;

  return query
  select 
    au.id,
    au.email::varchar,
    (au.raw_user_meta_data->>'role')::text as role,
    au.last_sign_in_at,
    au.created_at
  from auth.users au
  order by au.created_at desc;
end;
$$ language plpgsql;

-- 2. Function to update user role (Admin only)
create or replace function update_user_role(target_email text, new_role text)
returns void
security definer
as $$
begin
  -- Check if the caller is an admin
  if (auth.jwt() -> 'user_metadata' ->> 'role') != 'admin' then
    raise exception 'Access denied: Admin only';
  end if;

  update auth.users
  set raw_user_meta_data = 
    case 
      when raw_user_meta_data is null then jsonb_build_object('role', new_role)
      else raw_user_meta_data || jsonb_build_object('role', new_role)
    end
  where email = target_email;
end;
$$ language plpgsql;
