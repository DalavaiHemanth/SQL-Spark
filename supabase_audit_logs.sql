-- =============================================
-- SQL Spark — Supabase Audit Logs Schema
-- Run this in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    event_type text NOT NULL CHECK (event_type IN ('auth', 'api', 'abuse', 'security', 'general')),
    message text,
    details jsonb,
    user_email text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert by authenticated AND anonymous users (to capture failed logins)
CREATE POLICY "Anyone can insert logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- Implicitly nobody is granted SELECT, UPDATE, or DELETE access, protecting the integrity of the logs.
-- You can view these logs directly in the Supabase Dashboard interface.
