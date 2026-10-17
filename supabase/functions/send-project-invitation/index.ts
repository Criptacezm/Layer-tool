// Supabase Edge Function to send project invitation emails
// Deploy this function to: supabase/functions/send-project-invitation/

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
    const { to, projectName, projectId, inviterName, inviterEmail, projectLink, invitationId } = await req.json()

    if (!to || !projectName || !projectId) {
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
            .google-auth { display: flex; align-items: center; gap: 10px; justify-content: center; margin: 15px 0; padding: 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You've been invited to collaborate!</h1>
            </div>
            <div class="content">
              <p>Hi there,</p>
              <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to join their team on:</p>
              <h2 style="color: #7c3aed; margin: 20px 0;">${projectName}</h2>
              
              <div class="info-box">
                <p style="margin: 0; font-weight: 600; color: #7c3aed;">📧 Quick Sign In with Google</p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">You can sign in instantly with your Google account - no password needed!</p>
              </div>
              
              <p>Click the button below to accept the invitation and start collaborating:</p>
              <div style="text-align: center;">
                <a href="${projectLink}" class="button">Accept Invitation & Join Project</a>
              </div>
              
              <div class="google-auth">
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span style="font-size: 14px; color: #6b7280;">Sign in with your Google account</span>
              </div>
              
              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                Or copy and paste this link into your browser:<br>
                <a href="${projectLink}" style="color: #7c3aed; word-break: break-all;">${projectLink}</a>
              </p>
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                <strong>New to Layer?</strong> No problem! When you click the link above, you can:
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Sign in instantly with your Google account</li>
                  <li>Or create a new account with email & password</li>
                </ul>
                Visit: <a href="${new URL(projectLink).origin}" style="color: #7c3aed;">${new URL(projectLink).origin}</a>
              </p>
            </div>
            <div class="footer">
              <p>This invitation was sent from Layer workspace.</p>
              <p style="margin-top: 10px;">© ${new Date().getFullYear()} Layer. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
🎉 You've been invited to collaborate!

${inviterName} (${inviterEmail}) has invited you to join their team on: ${projectName}

📧 QUICK SIGN IN WITH GOOGLE
You can sign in instantly with your Google account - no password needed!

Accept the invitation and join the project:
${projectLink}

NEW TO LAYER?
No problem! When you click the link above, you can:
- Sign in instantly with your Google account
- Or create a new account with email & password

Visit: ${new URL(projectLink).origin}

This invitation was sent from Layer workspace.
© ${new Date().getFullYear()} Layer. All rights reserved.
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
          to: [to],
          subject: `Invitation to join project: ${projectName}`,
          html: emailHtml,
          text: emailText
        })
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.json()
        throw new Error('Resend API error: ' + JSON.stringify(error))
      }

      const resendData = await resendResponse.json()
      console.log('Email sent via Resend:', resendData)

      // Update invitation status
      await supabase
        .from('project_invitations')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', invitationId)

      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully', emailId: resendData.id }),
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
    console.error('Error sending invitation email:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


