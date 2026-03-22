// Supabase Edge Function: process-password-reset
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { email, code, newPassword } = await req.json();
        if (!email || !code || !newPassword) throw new Error('Missing required fields');
        if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Verify OTP
        const { data: otpData, error: otpError } = await supabase
            .from('email_otps')
            .select('*')
            .eq('email', email)
            .eq('otp_code', code)
            .eq('is_verified', false)
            .single();

        if (otpError || !otpData) throw new Error('Invalid or expired verification code');

        if (new Date() > new Date(otpData.expires_at)) throw new Error('Code has expired. Please request a new one.');

        // 2. Find user by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        const targetUser = userData.users.find(u => u.email === email);
        if (!targetUser) throw new Error('No account found with this email');

        // 3. Update user's password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            targetUser.id,
            { password: newPassword }
        );
        if (updateError) throw updateError;

        // 4. Mark OTP as used
        await supabase.from('email_otps').update({ is_verified: true }).eq('id', otpData.id);

        return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (err) {
        console.error('process-password-reset Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
