# Team Management & Google OAuth Setup Guide

This guide will help you set up the complete team management system with Google OAuth authentication and real-time communication features.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google OAuth Setup](#google-oauth-setup)
3. [Supabase SQL Schema Setup](#supabase-sql-schema-setup)
4. [Email Functions Configuration](#email-functions-configuration)
5. [Testing the Setup](#testing-the-setup)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:
- A Supabase account (free tier works)
- A Google Cloud Platform (GCP) account
- Access to your Supabase project dashboard
- Basic knowledge of SQL

---

## Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
   - Also enable "Google Identity Services API"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     ```
     https://uqfnadlyrbprzxgjkvtc.supabase.co/auth/v1/callback
     ```
   - Click "Create"
   - **Save the Client ID and Client Secret** - you'll need these!

### Step 2: Configure Supabase Google OAuth

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication Settings**
   - Click "Authentication" in the left sidebar
   - Click "Providers"
   - Find "Google" and click to configure

3. **Enter Google OAuth Credentials**
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
   - **Enabled**: Toggle ON
   - Click "Save"

4. **Configure Redirect URLs**
   - In Google Cloud Console, make sure you've added:
     - `https://uqfnadlyrbprzxgjkvtc.supabase.co/auth/v1/callback`
     - Your production domain callback URL (if applicable)

---

## Supabase SQL Schema Setup

### Step 1: Access SQL Editor

1. **Open Supabase Dashboard**
   - Go to your project dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

### Step 2: Run the Schema

1. **Copy the Schema**
   - Open `layer-schema.sql` from your project
   - Copy the entire contents

2. **Paste and Execute**
   - Paste the SQL into the Supabase SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for execution to complete (should show "Success")

3. **Verify Tables Created**
   - Go to "Table Editor" in Supabase
   - You should see these tables:
     - `profiles`
     - `followers`
     - `team_invitations`
     - `project_invitations`
     - `user_presence`
     - And all other tables from the schema

### Step 3: Verify Row Level Security (RLS)

1. **Check RLS Policies**
   - Go to "Authentication" > "Policies"
   - Verify policies are created for:
     - `followers` table
     - `team_invitations` table
     - `profiles` table

2. **Test RLS (Optional)**
   - Create a test user
   - Verify they can only see their own data

---

## Email Functions Configuration

### Step 1: Set Up Email Provider

You have two options:

#### Option A: Use Supabase Built-in Email (Recommended for Development)

**📖 For detailed step-by-step instructions, see: `GMAIL_SMTP_SETUP.md`**

**Quick Setup Steps:**

1. **Enable 2-Factor Authentication on Gmail**
   - Go to: https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate Gmail App Password**
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Supabase)"
   - Copy the 16-character password (remove spaces when using)

3. **Configure SMTP in Supabase**
   - Go to Supabase Dashboard → "Authentication" → "Settings"
   - Scroll to "SMTP Settings"
   - Enable "Custom SMTP"
   - Enter these settings:
     ```
     SMTP Host: smtp.gmail.com
     SMTP Port: 587
     SMTP User: yourname@gmail.com
     SMTP Password: [16-character App Password - no spaces]
     Sender Email: yourname@gmail.com
     Sender Name: Layer Team
     Security: TLS
     ```

4. **Test Email**
   - Click "Send Test Email"
   - Check your inbox for the test email

**📖 Full detailed guide with troubleshooting: See `GMAIL_SMTP_SETUP.md`**

#### Option B: Use Supabase Edge Functions (Recommended for Production)

The project already includes Edge Functions for sending emails:
- `send-follower-notification`
- `send-project-invitation`
- `send-welcome-email`

### Step 2: Configure Edge Functions

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Link Your Project**
   ```bash
   supabase link --project-ref uqfnadlyrbprzxgjkvtc
   ```

3. **Set Environment Variables**
   - For each function, you may need to set email service credentials
   - Go to "Edge Functions" > "Settings" > "Secrets"
   - Add secrets like:
     - `SENDGRID_API_KEY` (if using SendGrid)
     - `MAILGUN_API_KEY` (if using Mailgun)
     - Or configure SMTP settings

4. **Deploy Functions** (if needed)
   ```bash
   supabase functions deploy send-follower-notification
   supabase functions deploy send-project-invitation
   supabase functions deploy send-welcome-email
   ```

### Step 3: Test Email Function

1. **Test from Application**
   - Sign in with Google
   - Go to Team tab
   - Click "Add People"
   - Invite someone by email
   - Check if email is sent

2. **Check Function Logs**
   - Go to "Edge Functions" > "Logs"
   - Look for any errors

---

## Additional Google Services (Optional)

### Google Calendar Integration (Future)

If you want to integrate Google Calendar:

1. **Enable Google Calendar API**
   - In Google Cloud Console
   - Enable "Google Calendar API"
   - Add scope: `https://www.googleapis.com/auth/calendar`

2. **Update OAuth Scopes in Supabase**
   - In Authentication > Providers > Google
   - Add additional scopes:
     ```
     https://www.googleapis.com/auth/calendar
     https://www.googleapis.com/auth/calendar.events
     ```

### Google Drive Integration (Future)

For document sharing:

1. **Enable Google Drive API**
   - Enable "Google Drive API" in GCP
   - Add scope: `https://www.googleapis.com/auth/drive`

---

## Testing the Setup

### Test 1: Google OAuth Sign-In

1. **Open Your Application**
   - Navigate to your Layer app
   - Click "Sign In"
   - Click "Sign in with Google"
   - You should be redirected to Google
   - After authorization, you should be signed in

2. **Verify User Profile**
   - Check if your profile is created in `profiles` table
   - Go to Supabase > Table Editor > `profiles`
   - Your user should appear

### Test 2: Team Invitation

1. **Invite a Team Member**
   - Sign in with Google
   - Go to Team tab
   - Click "Add People"
   - Enter an email address
   - Click "Send Invitation"

2. **Check Database**
   - Go to Supabase > Table Editor > `team_invitations`
   - You should see the invitation record

3. **Check Email**
   - The invitee should receive an email
   - Check spam folder if not in inbox

### Test 3: Accept Invitation

1. **As Invitee**
   - Sign in with Google (using the invited email)
   - Go to Team tab
   - Check for pending invitations
   - Accept the invitation

2. **Verify Follow Relationship**
   - Go to Supabase > Table Editor > `followers`
   - Status should be "accepted"

---

## Troubleshooting

### Issue: Google OAuth Not Working

**Symptoms:**
- Redirects back but not signed in
- Error: "redirect_uri_mismatch"

**Solutions:**
1. Check redirect URI in Google Cloud Console matches exactly:
   ```
   https://uqfnadlyrbprzxgjkvtc.supabase.co/auth/v1/callback
   ```
2. Verify Client ID and Secret in Supabase match Google Cloud Console
3. Clear browser cache and cookies
4. Check browser console for errors

### Issue: SQL Schema Errors

**Symptoms:**
- Errors when running SQL
- Tables not created

**Solutions:**
1. Run SQL in sections (don't run all at once if errors occur)
2. Check if extensions are enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
3. Verify you have proper permissions in Supabase
4. Check for duplicate table/column errors (they're safe to ignore)

### Issue: Emails Not Sending

**Symptoms:**
- Invitations sent but no email received
- Function errors in logs

**Solutions:**
1. Check SMTP settings in Supabase
2. Verify email function is deployed
3. Check Edge Function logs for errors
4. Verify email service credentials (API keys, etc.)
5. Check spam folder
6. For Gmail, ensure "Less secure app access" is enabled OR use App Password

### Issue: Team Members Not Showing

**Symptoms:**
- Invited users but they don't appear in team list

**Solutions:**
1. Verify invitation status in `team_invitations` table
2. Check if user accepted the invitation
3. Verify `followers` table has "accepted" status
4. Refresh the page
5. Check browser console for JavaScript errors

### Issue: RLS (Row Level Security) Blocking Access

**Symptoms:**
- Can't see team members
- "Permission denied" errors

**Solutions:**
1. Verify RLS policies are created (check SQL schema)
2. Ensure user is authenticated
3. Check if policies allow viewing:
   ```sql
   -- Check followers policy
   SELECT * FROM pg_policies WHERE tablename = 'followers';
   ```
4. Temporarily disable RLS for testing (NOT recommended for production):
   ```sql
   ALTER TABLE followers DISABLE ROW LEVEL SECURITY;
   ```

---

## Security Best Practices

1. **Never commit secrets**
   - Keep Client IDs and Secrets in environment variables
   - Use Supabase secrets for sensitive data

2. **Enable RLS on all tables**
   - Always use Row Level Security
   - Test policies thoroughly

3. **Use HTTPS in production**
   - OAuth requires HTTPS
   - Supabase provides HTTPS by default

4. **Regular security audits**
   - Review RLS policies periodically
   - Check for exposed API keys
   - Monitor function logs for suspicious activity

---

## Next Steps

After setup is complete:

1. ✅ Test Google OAuth sign-in
2. ✅ Test team invitations
3. ✅ Test email notifications
4. ✅ Add real team members
5. ✅ Configure production email service
6. ✅ Set up monitoring and alerts
7. ✅ Document your specific configuration

---

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard > Logs
2. Check browser console for JavaScript errors
3. Review Edge Function logs
4. Verify all credentials are correct
5. Check Supabase status: https://status.supabase.com/

---

## Quick Reference

### Important URLs

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Google Cloud Console**: https://console.cloud.google.com/
- **Supabase Project**: https://uqfnadlyrbprzxgjkvtc.supabase.co

### Important Tables

- `profiles` - User profiles
- `followers` - Team member relationships
- `team_invitations` - Pending invitations
- `user_presence` - Online status

### Key Functions

- `signInWithGoogle()` - Google OAuth sign-in
- `sendTeamInvitation()` - Send team invitation
- `getFollowers()` - Get team members
- `acceptFollowRequest()` - Accept invitation

---

**Last Updated**: 2024
**Version**: 1.0
