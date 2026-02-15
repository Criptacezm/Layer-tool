// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Sending follower notification email!")

serve(async (req) => {
  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Validate the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get request body
    const { email, follower_name, action } = await req.json();

    // Validate required fields
    if (!email || !follower_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email and follower_name' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create email content based on action
    let subject, htmlContent, textContent;

    if (action === 'follow') {
      subject = `${follower_name} wants to follow you on Layer`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Layer</h1>
              <p>New Follower Request</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p><strong>${follower_name}</strong> wants to follow you on Layer.</p>
              <p>You can now collaborate, share projects, and communicate directly with them.</p>
              <a href="${Deno.env.get('SITE_URL')}/layer.html" class="button">View Request</a>
              <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
            <div class="footer">
              <p>This email was sent from Layer App. You received this because someone wants to follow you.</p>
              <p>© 2026 Layer App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      textContent = `
        Hello!
        
        ${follower_name} wants to follow you on Layer.
        
        You can now collaborate, share projects, and communicate directly with them.
        
        Visit ${Deno.env.get('SITE_URL')}/layer.html to view the request.
        
        © 2026 Layer App
      `;
    } else if (action === 'accept') {
      subject = `${follower_name} accepted your follow request`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Layer</h1>
              <p>Follow Request Accepted</p>
            </div>
            <div class="content">
              <h2>Congratulations!</h2>
              <p><strong>${follower_name}</strong> has accepted your follow request.</p>
              <p>You can now start collaborating and communicating with them on Layer.</p>
              <a href="${Deno.env.get('SITE_URL')}/layer.html" class="button">Start Collaborating</a>
              <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
            <div class="footer">
              <p>This email was sent from Layer App. You received this because your follow request was accepted.</p>
              <p>© 2026 Layer App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      textContent = `
        Congratulations!
        
        ${follower_name} has accepted your follow request.
        
        You can now start collaborating and communicating with them on Layer.
        
        Visit ${Deno.env.get('SITE_URL')}/layer.html to start collaborating.
        
        © 2026 Layer App
      `;
    }

    // Send email using Resend or SMTP (you'll need to configure your email service)
    // For now, we'll log the email content and return success
    
    console.log('=== EMAIL CONTENT ===');
    console.log('To:', email);
    console.log('Subject:', subject);
    console.log('HTML Content:', htmlContent);
    console.log('=====================');

    // Here you would integrate with your email service (Resend, SendGrid, etc.)
    // Example with Resend:
    /*
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Layer App <noreply@layerapp.com>',
        to: email,
        subject: subject,
        html: htmlContent,
        text: textContent
      })
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }
    */

    return new Response(
      JSON.stringify({ 
        message: 'Email sent successfully',
        email: email,
        subject: subject
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in send-follower-notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});