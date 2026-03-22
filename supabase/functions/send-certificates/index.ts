import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { hackathonId, hackathonTitle, participants } = await req.json();

    if (!participants || !Array.isArray(participants)) {
      throw new Error('Invalid participants list');
    }

    // Process in batches of 10 to avoid hitting limits or timeouts
    const BATCH_SIZE = 10;
    let successfulSends = 0;
    
    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
        const batch = participants.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (p) => {
            try {
                // If the app is hosted, we could point to the actual URL, e.g., `https://sqlspark.app/verify/${p.id}`
                // For this demo, we'll provide a generic claim message with the hackathon URL
                const typeText = p.type === 'winner' ? 'Winner' : 'Participation';
                const rankText = p.rank ? `(Rank ${p.rank})` : '';
                
                // 1. We just send an email with the direct link back to their results page to download the PDF.
                // Sending an actual generated PDF directly from the edge function requires a headless browser (Puppeteer) in Deno, 
                // which is very heavy on edge functions. Better to guide them to the app.

                const emailResponse = await resend.emails.send({
                    from: 'SQL Spark <onboarding@resend.dev>',
                    to: p.email,
                    subject: `Your ${typeText} Certificate: ${hackathonTitle}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Congratulations, ${p.name}!</h2>
                            <p>Thank you for participating in <strong>${hackathonTitle}</strong>.</p>
                            <p>Your <strong>${typeText} Certificate</strong> ${rankText} is now ready to download.</p>
                            
                            <div style="margin: 30px 0;">
                                <a href="https://sqlspark.tech/hackathons/${hackathonId}/results" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                    Download My Certificate
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                If the button above doesn't work, you can copy and paste this link into your browser:<br>
                                https://sqlspark.tech/hackathons/${hackathonId}/results
                            </p>
                            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
                            <p style="color: #999; font-size: 12px;">Powered by SQL Spark</p>
                        </div>
                    `
                });
                
                console.log(`Email sent to ${p.email}:`, emailResponse);
                successfulSends++;
            } catch (err) {
                console.error(`Failed to send to ${p.email}:`, err);
            }
        }));
    }

    return new Response(
      JSON.stringify({ success: true, count: successfulSends }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
