-- SQL Spark: OTP Setup (safe to re-run)
-- Creates email_otps table and adds is_verified column if it already exists without it

CREATE TABLE IF NOT EXISTS public.email_otps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_verified column if table existed before without it
ALTER TABLE public.email_otps
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps(email);
