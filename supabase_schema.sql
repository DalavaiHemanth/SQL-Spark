-- =============================================
-- SQL Spark — Supabase Database Schema
-- Run this in Supabase SQL Editor (once)
-- =============================================

-- ========== HACKATHONS ==========
create table if not exists hackathons (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    description text,
    status text default 'draft' check (status in ('draft', 'registration_open', 'in_progress', 'completed')),
    max_teams integer default 50,
    db_schema text,
    created_by text,
    created_date timestamptz default now(),
    -- Added columns
    hackathon_code text,
    start_time timestamptz,
    end_time timestamptz,
    results_published boolean default false,
    database_file_url text,
    hackathon_database_ids jsonb default '[]'::jsonb
);

-- ========== CHALLENGES ==========
create table if not exists challenges (
    id uuid default gen_random_uuid() primary key,
    hackathon_id uuid references hackathons(id) on delete cascade,
    title text not null,
    description text,
    difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
    points integer default 100,
    expected_output text,
    solution_query text,
    hints jsonb default '[]'::jsonb,
    required_keywords jsonb default '[]'::jsonb,
    forbidden_keywords jsonb default '[]'::jsonb,
    "order" integer default 0,
    created_date timestamptz default now(),
    -- Added columns
    order_sensitive boolean default false,
    database_id uuid,
    database_name text
);

-- ========== TEAMS ==========
create table if not exists teams (
    id uuid default gen_random_uuid() primary key,
    hackathon_id uuid references hackathons(id) on delete cascade,
    name text not null,
    join_code text,
    members jsonb default '[]'::jsonb,
    total_score integer default 0,
    challenges_completed integer default 0,
    created_by text,
    created_date timestamptz default now(),
    -- Added columns
    custom_db_id uuid,
    custom_db_url text,
    assigned_challenge_ids jsonb default '[]'::jsonb,
    violations jsonb
);

-- ========== SUBMISSIONS ==========
create table if not exists submissions (
    id uuid default gen_random_uuid() primary key,
    team_id uuid references teams(id) on delete cascade,
    challenge_id uuid references challenges(id) on delete cascade,
    hackathon_id uuid references hackathons(id) on delete cascade,
    query text,
    status text default 'pending' check (status in ('pending', 'correct', 'incorrect')),
    score integer default 0,
    hints_used integer default 0,
    feedback text,
    execution_time_ms integer,
    created_date timestamptz default now(),
    -- Added columns
    violations jsonb
);

-- ========== ROW LEVEL SECURITY ==========

-- Enable RLS on all tables
alter table hackathons enable row level security;
alter table challenges enable row level security;
alter table teams enable row level security;
alter table submissions enable row level security;

-- Allow all authenticated users to read all data
create policy "Authenticated users can read hackathons"
    on hackathons for select to authenticated using (true);

create policy "Authenticated users can read challenges"
    on challenges for select to authenticated using (true);

create policy "Authenticated users can read teams"
    on teams for select to authenticated using (true);

create policy "Authenticated users can read submissions"
    on submissions for select to authenticated using (true);

-- Allow authenticated users to insert/update/delete (app logic handles permissions)
create policy "Authenticated users can insert hackathons"
    on hackathons for insert to authenticated with check (true);

create policy "Authenticated users can update hackathons"
    on hackathons for update to authenticated using (true);

create policy "Authenticated users can delete hackathons"
    on hackathons for delete to authenticated using (true);

create policy "Authenticated users can insert challenges"
    on challenges for insert to authenticated with check (true);

create policy "Authenticated users can update challenges"
    on challenges for update to authenticated using (true);

create policy "Authenticated users can delete challenges"
    on challenges for delete to authenticated using (true);

create policy "Authenticated users can insert teams"
    on teams for insert to authenticated with check (true);

create policy "Authenticated users can update teams"
    on teams for update to authenticated using (true);

create policy "Authenticated users can delete teams"
    on teams for delete to authenticated using (true);

create policy "Authenticated users can insert submissions"
    on submissions for insert to authenticated with check (true);

create policy "Authenticated users can update submissions"
    on submissions for update to authenticated using (true);

create policy "Authenticated users can delete submissions"
    on submissions for delete to authenticated using (true);
