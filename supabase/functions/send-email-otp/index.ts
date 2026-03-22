// Supabase Edge Function: send-email-otp
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.7";
import { Buffer } from "node:buffer";

globalThis.Buffer = Buffer;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { email, type = 'register' } = await req.json();
        if (!email) throw new Error('Email is required');

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase.from('email_otps').delete().eq('email', email);
        const { error } = await supabase
            .from('email_otps')
            .insert([{ email, otp_code: otpCode, expires_at: expiresAt }]);

        if (error) throw error;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: Deno.env.get('SMTP_USER'),
                pass: Deno.env.get('SMTP_PASS'),
            },
        });

        const isReset = type === 'reset';
        const subject = isReset ? `Password Reset Code: ${otpCode}` : `Verification Code: ${otpCode}`;
        const actionText = isReset ? 'reset your SQL Spark password' : 'verify your SQL Spark account';

        await transporter.sendMail({
            from: `"SQL Spark" <${Deno.env.get('SMTP_USER')}>`,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e7ef; padding: 32px; border-radius: 12px; background: #f8fafc;">
                    <h1 style="color: #059669; font-size: 48px; letter-spacing: 12px; text-align: center; margin: 0;">${otpCode}</h1>
                    <p style="text-align: center; color: #475569; margin-top: 16px;">Enter this code to ${actionText}.</p>
                    <p style="text-align: center; color: #94a3b8; font-size: 0.875rem;">Code expires in <strong>10 minutes</strong>. Do not share this code.</p>
                    <hr style="border: none; border-top: 1px solid #e1e7ef; margin: 20px 0;" />
                    <p style="color: #cbd5e1; font-size: 0.75rem; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `,
        });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (err) {
        console.error('Edge Function Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
