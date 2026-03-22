-- Add missing columns to hackathons table
alter table hackathons 
add column if not exists sample_data text,
add column if not exists database_source text default 'manual',
add column if not exists database_file_url text,
add column if not exists database_schema text;

-- storage bucket
insert into storage.buckets (id, name, public)
values ('hackathon-assets', 'hackathon-assets', true)
on conflict (id) do nothing;

-- storage policies (drop first so re-running is safe)
drop policy if exists "Hackathon Assets Public Access" on storage.objects;
drop policy if exists "Hackathon Assets Upload Access" on storage.objects;
drop policy if exists "Hackathon Assets Update Access" on storage.objects;

create policy "Hackathon Assets Public Access"
  on storage.objects for select
  using ( bucket_id = 'hackathon-assets' );

create policy "Hackathon Assets Upload Access"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'hackathon-assets' );

create policy "Hackathon Assets Update Access"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'hackathon-assets' );

-- =============================================
-- DATABASE LIBRARY TABLE (add this if missing)
-- =============================================
create table if not exists database_library (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    file_url text,
    uploaded_by uuid references auth.users(id) on delete set null,
    is_public boolean default false,
    created_at timestamptz default now()
);

-- Enable RLS
alter table database_library enable row level security;

-- Admins can see their own + all public databases
create policy "Users can view own or public databases"
    on database_library for select
    to authenticated
    using (uploaded_by = auth.uid() or is_public = true);

-- Only the uploader can insert
create policy "Users can insert databases"
    on database_library for insert
    to authenticated
    with check (uploaded_by = auth.uid());

-- Only the uploader can update their own
create policy "Users can update own databases"
    on database_library for update
    to authenticated
    using (uploaded_by = auth.uid());

-- Only the uploader can delete their own
create policy "Users can delete own databases"
    on database_library for delete
    to authenticated
    using (uploaded_by = auth.uid());

-- =============================================
-- PHASE 1: Per-challenge database association
-- =============================================
alter table challenges
    add column if not exists database_id uuid references database_library(id) on delete set null;

-- =============================================
-- PHASE 1: Per-team database + challenge assignment
-- =============================================
alter table teams
    add column if not exists custom_db_id uuid references database_library(id) on delete set null,
    add column if not exists assigned_challenge_ids uuid[] default '{}';
