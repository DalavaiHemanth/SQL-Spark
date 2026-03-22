// Supabase Edge Function: process-password-reset
// Verifies OTP then uses Admin API to securely update the user's password.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { email, otp_code, new_password } = await req.json();

        if (!email || !otp_code || !new_password) {
            throw new Error('Email, OTP code, and new password are required');
        }
        if (new_password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        // Use service role to bypass RLS
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Step 1: Verify OTP
        const { data: otpRecord, error: otpError } = await supabase
            .from('email_otps')
            .select('*')
            .eq('email', email)
            .eq('otp_code', otp_code)
            .eq('is_verified', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) {
            throw new Error('Invalid or expired verification code');
        }

        // Check expiry
        if (new Date() > new Date(otpRecord.expires_at)) {
            throw new Error('Verification code has expired. Please request a new one.');
        }

        // Step 2: Find the user
        const { data: userList, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw new Error('Failed to look up user');

        const user = userList.users.find(u => u.email === email);
        if (!user) throw new Error('No account found with this email address');

        // Step 3: Update password via Admin API (reliable, no pgcrypto needed)
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: new_password }
        );

        if (updateError) throw new Error('Failed to update password: ' + updateError.message);

        // Step 4: Mark OTP as verified
        await supabase
            .from('email_otps')
            .update({ is_verified: true })
            .eq('id', otpRecord.id);

        return new Response(
            JSON.stringify({ success: true, message: 'Password updated successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
