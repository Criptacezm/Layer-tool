// Supabase Edge Function to send project invitation emails
// Deploy this function to: supabase/functions/send-project-invitation/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@yourdomain.com'

serve(async (req) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { to, projectName, projectId, inviterName, inviterEmail, projectLink, invitationId } = await req.json()

    if (!to || !projectName || !projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You've been invited to collaborate!</h1>
            </div>
            <div class="content">
              <p>Hi there,</p>
              <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to collaborate on the project:</p>
              <h2 style="color: #7c3aed; margin: 20px 0;">${projectName}</h2>
              <p>Click the button below to view the project and start collaborating:</p>
              <div style="text-align: center;">
                <a href="${projectLink}" class="button">View Project</a>
              </div>
              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                Or copy and paste this link into your browser:<br>
                <a href="${projectLink}" style="color: #7c3aed; word-break: break-all;">${projectLink}</a>
              </p>
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                If you don't have an account yet, you can sign up at <a href="${new URL(projectLink).origin}" style="color: #7c3aed;">${new URL(projectLink).origin}</a>
              </p>
            </div>
            <div class="footer">
              <p>This invitation was sent from Layer workspace.</p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
You've been invited to collaborate!

${inviterName} (${inviterEmail}) has invited you to collaborate on the project: ${projectName}

View the project: ${projectLink}

If you don't have an account yet, you can sign up at ${new URL(projectLink).origin}

This invitation was sent from Layer workspace.
      `

      // Send email via Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
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
        throw new Error(`Resend API error: ${JSON.stringify(error)}`)
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
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      // If Resend is not configured, return instructions
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          message: 'Please set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables in your Supabase project settings'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})


