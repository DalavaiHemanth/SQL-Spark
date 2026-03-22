-- SQL SPARK - Schema Fix Migration
-- Run this in your Supabase SQL Editor to ensure all required columns exist

-- Ensure hackathons table has all required columns for DB management
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS database_schema text;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS sample_data text;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS database_source text DEFAULT 'manual';
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS database_file_url text;

-- Ensure database_library table exists for shared DB management
CREATE TABLE IF NOT EXISTS database_library (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    file_url text NOT NULL,
    uploaded_by text,
    file_size bigint,
    created_date timestamptz DEFAULT now()
);

-- Ensure teams can have custom database URLs
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_db_url text;

-- RLS Policies for database_library (allow all authenticated users to read and write)
ALTER TABLE database_library ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'database_library' AND policyname = 'Authenticated users can read database_library'
    ) THEN
        CREATE POLICY "Authenticated users can read database_library"
            ON database_library FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'database_library' AND policyname = 'Authenticated users can insert database_library'
    ) THEN
        CREATE POLICY "Authenticated users can insert database_library"
            ON database_library FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'database_library' AND policyname = 'Authenticated users can update database_library'
    ) THEN
        CREATE POLICY "Authenticated users can update database_library"
            ON database_library FOR UPDATE TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'database_library' AND policyname = 'Authenticated users can delete database_library'
    ) THEN
        CREATE POLICY "Authenticated users can delete database_library"
            ON database_library FOR DELETE TO authenticated USING (true);
    END IF;
END
$$;

-- Ensure storage bucket exists for hackathon assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('hackathon-assets', 'hackathon-assets', true)
ON CONFLICT (id) DO NOTHING;
