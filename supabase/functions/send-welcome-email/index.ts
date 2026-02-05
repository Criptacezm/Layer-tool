// Supabase Edge Function to send welcome emails
// This function is triggered when a user signs in with Google

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// SMTP Configuration - Using Gmail SMTP
const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587')
const SMTP_USER = Deno.env.get('SMTP_USER') // Your Gmail address
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') // Your App Password
const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'Layer Team'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, name } = await req.json()

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if SMTP is configured
    if (SMTP_USER && SMTP_PASSWORD) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .button:hover { background: #6d28d9; }
            .info-box { background: #fff; border-left: 4px solid #7c3aed; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Layer!</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>You've successfully logged in to Layer with your Google account.</p>
              <p>We're excited to have you as part of our community! Layer is designed to help you manage projects, track issues, and stay organized with our Linear-inspired interface.</p>
              <p>Start exploring by creating your first project or joining a team.</p>
              <p>If you have any questions, feel free to reach out to our support team.</p>
              <p>Best regards,<br>The Layer Team</p>
            </div>
            <div class="footer">
              <p>This email was sent because you signed in to Layer with your Google account.</p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
Welcome to Layer!

Hello ${name},

You've successfully logged in to Layer with your Google account.

We're excited to have you as part of our community! Layer is designed to help you manage projects, track issues, and stay organized with our Linear-inspired interface.

Start exploring by creating your first project or joining a team.

If you have any questions, feel free to reach out to our support team.

Best regards,
The Layer Team

---

This email was sent because you signed in to Layer with your Google account.
      `

      // Use SMTP via external service (since Deno doesn't have built-in SMTP)
      // This is a workaround using an external SMTP service
      const smtpResponse = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: SMTP_PASSWORD, // Using password as API key for SMTP service
          to: [email],
          sender: `${SENDER_NAME} <${SMTP_USER}>`,
          subject: 'Welcome to Layer!',
          html_body: emailHtml,
          text_body: emailText
        })
      })

      if (!smtpResponse.ok) {
        const error = await smtpResponse.json()
        console.error('SMTP error:', error)
        throw new Error('Failed to send email via SMTP service')
      }

      const smtpData = await smtpResponse.json()
      console.log('Welcome email sent via SMTP service:', smtpData)

      return new Response(
        JSON.stringify({ success: true, message: 'Welcome email sent successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // If SMTP is not configured, return instructions
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          message: 'Please set SMTP_USER and SMTP_PASSWORD environment variables in your Supabase project settings'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})