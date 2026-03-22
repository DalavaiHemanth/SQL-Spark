import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, type = 'register' } = await req.json();

        if (!email) {
            throw new Error('Email is required');
        }

        // Initialize Supabase admin client to bypass RLS when inserting OTP
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Expires in 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

        // 1. Store OTP in database
        const { error: dbError } = await supabase
            .from('email_otps')
            .insert([{ email, otp_code: otpCode, expires_at: expiresAt, is_verified: false }]);

        if (dbError) {
            console.error('Database Error:', dbError);
            throw new Error('Failed to save OTP to database: ' + dbError.message);
        }

        // 2. Send email via Gmail SMTP
        const smtpUser = Deno.env.get('SMTP_USERNAME');
        const smtpPass = Deno.env.get('SMTP_PASSWORD');

        if (!smtpUser || !smtpPass) {
            throw new Error('SMTP credentials are not configured in edge function secrets.');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        let subject = 'SQL Spark - Your Verification Code';
        let text = `Your verification code is: ${otpCode}. It will expire in 15 minutes.`;

        if (type === 'reset') {
            subject = 'SQL Spark - Password Reset Code';
            text = `Your password reset code is: ${otpCode}. It will expire in 15 minutes. Please enter this code to create a new password.`;
        }

        const mailOptions = {
            from: `"SQL Spark" <${smtpUser}>`,
            to: email,
            subject: subject,
            text: text,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #059669; text-align: center;">SQL Spark</h2>
                    <p style="font-size: 16px; color: #374151;">Hello,</p>
                    <p style="font-size: 16px; color: #374151;">
                        ${type === 'reset' ? 'You requested a password reset. Here is your code:' : 'Here is your verification code:'}
                    </p>
                    <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">${otpCode}</span>
                    </div>
                    <p style="font-size: 14px; color: #6b7280; text-align: center;">This code will expire in 15 minutes.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return new Response(
            JSON.stringify({ success: true, message: 'OTP sent successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
