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

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Step 1: Find the OTP — only check email + code + expiry (not is_verified)
        const { data: otpRecord, error: otpError } = await supabase
            .from('email_otps')
            .select('*')
            .eq('email', email)
            .eq('otp_code', otp_code)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (otpError) throw new Error('Database error: ' + otpError.message);
        if (!otpRecord) throw new Error('Invalid verification code. Please request a new one.');

        // Check expiry
        if (new Date() > new Date(otpRecord.expires_at)) {
            throw new Error('Verification code has expired. Please request a new one.');
        }

        // Step 2: Find user by email using admin list (with high perPage to avoid pagination miss)
        const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000
        });

        if (listError) throw new Error('Could not look up account: ' + listError.message);

        const user = userList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (!user) throw new Error('No account found with this email address.');

        // Step 3: Update password via Admin API
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: new_password }
        );

        if (updateError) throw new Error('Failed to update password: ' + updateError.message);

        // Step 4: Delete the used OTP so it can't be reused
        await supabase.from('email_otps').delete().eq('id', otpRecord.id);

        return new Response(
            JSON.stringify({ success: true, message: 'Password updated successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return new Response(
            JSON.stringify({ error: message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
