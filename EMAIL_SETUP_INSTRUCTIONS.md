# Email Invitation Setup Instructions

To enable automatic email sending for project invitations, you need to set up a Supabase Edge Function with an email service provider.

## Quick Setup: Using Resend (Recommended - 5 minutes)

### Step 1: Get Resend API Key
1. Sign up for free at [resend.com](https://resend.com) (free tier: 3,000 emails/month)
2. Go to API Keys in your dashboard
3. Create a new API key and copy it
4. Add and verify your domain (or use Resend's test domain for testing)

### Step 2: Deploy the Edge Function

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref uqfnadlyrbprzxgjkvtc
   ```
   (Replace with your actual project ref if different)

4. **Deploy the function**:
   ```bash
   supabase functions deploy send-project-invitation
   ```

### Step 3: Set Environment Variables

In your Supabase dashboard:
1. Go to **Project Settings** > **Edge Functions** > **Secrets**
2. Click **Add new secret** and add:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (starts with `re_`)
   
3. Add another secret:
   - **Name**: `RESEND_FROM_EMAIL`
   - **Value**: Your verified email (e.g., `noreply@yourdomain.com` or use Resend's test email)

### Step 4: Test

1. Try inviting a member to a project
2. Check the invited user's email inbox
3. The email should arrive within seconds!

## Alternative: Using EmailJS (No Server Setup Required)

If you prefer not to use Edge Functions, you can use EmailJS:

1. Sign up at [emailjs.com](https://www.emailjs.com)
2. Create an email service (Gmail, Outlook, etc.)
3. Create an email template
4. Get your Service ID, Template ID, and Public Key
5. Add EmailJS script to `layer.html`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
   ```
6. Update the constants in `functionality.js` (line ~12490) with your EmailJS credentials

## Troubleshooting

- **Function not found**: Make sure you've deployed the Edge Function using `supabase functions deploy`
- **Email not sending**: 
  - Check your Resend API key is correct
  - Verify your FROM email is verified in Resend
  - Check Supabase Edge Function logs in the dashboard
- **Unauthorized error**: The function automatically handles authentication - make sure you're signed in
- **"Email service not configured"**: The Edge Function wasn't found - deploy it first

## File Location

The Edge Function code is located at:
`supabase/functions/send-project-invitation/index.ts`

You can modify this file to use a different email service (SendGrid, Mailgun, etc.) if preferred.
