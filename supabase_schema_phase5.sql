-- =============================================
-- Phase 5: Database Library & Multi-DB Support
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create Database Library Table
create table if not exists database_library (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    file_url text not null,
    uploaded_by uuid references auth.users(id),
    is_public boolean default true,
    created_at timestamptz default now()
);

-- Enable RLS
alter table database_library enable row level security;

-- Policies for database_library
-- Everyone authenticated can read (so admins can see shared DBs)
create policy "Authenticated users can read database_library"
    on database_library for select to authenticated using (true);

-- Only admins/organizers can insert (handled by app logic, but good to have policy)
create policy "Authenticated users can insert database_library"
    on database_library for insert to authenticated with check (true);

-- Only uploader or admin can delete (simplified to all auth for now, app logic handles roles)
create policy "Authenticated users can delete database_library"
    on database_library for delete to authenticated using (true);


-- 2. Add custom_db_url to Teams table
alter table teams 
add column if not exists custom_db_url text;

-- (Existing RLS on teams allows update, so we are good)
