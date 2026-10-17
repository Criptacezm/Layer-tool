// Supabase Edge Function to send welcome emails
// This function is triggered when a user signs in with Google

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@yourdomain.com'

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

    // If Resend API key is configured, use Resend to send email
    if (RESEND_API_KEY) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
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

      // Send email via Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + RESEND_API_KEY
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [email],
          subject: 'Welcome to Layer!',
          html: emailHtml,
          text: emailText
        })
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.json()
        throw new Error('Resend API error: ' + JSON.stringify(error))
      }

      const resendData = await resendResponse.json()
      console.log('Welcome email sent via Resend:', resendData)

      return new Response(
        JSON.stringify({ success: true, message: 'Welcome email sent successfully', emailId: resendData.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // If Resend is not configured, return instructions
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          message: 'Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables in your Supabase project settings'
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