-- Custom OTP Setup for Password Resets via Gmail SMTP

-- 1. Ensure the email_otps table exists
CREATE TABLE IF NOT EXISTS public.email_otps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps(email);

-- 2. Create RPC to securely reset password based on OTP
CREATE OR REPLACE FUNCTION public.reset_user_password(
    p_email TEXT,
    p_otp TEXT,
    p_new_password TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to bypass RLS and auth restrictions
SET search_path = public
AS $$
DECLARE
    v_otp_record RECORD;
    v_user_id UUID;
BEGIN
    -- Step 1: Verify the OTP
    SELECT * INTO v_otp_record
    FROM public.email_otps
    WHERE email = p_email
      AND otp_code = p_otp
      AND is_verified = false
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired verification code';
    END IF;

    -- Step 2: Get user ID from auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Step 3: Update password in auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = v_user_id;

    -- Step 4: Mark OTP as verified
    UPDATE public.email_otps
    SET is_verified = true
    WHERE id = v_otp_record.id;

    RETURN TRUE;
END;
$$;
