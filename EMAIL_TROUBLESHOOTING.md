# 📧 Email Invitation Troubleshooting Guide

## 🔍 Problem Analysis

Based on your setup and the code review, I've identified several issues preventing email invitations from working:

### 1. **Missing Environment Variables in Supabase**
Your Edge Functions need proper environment variables configured in Supabase dashboard.

### 2. **Functions Not Deployed**
The Edge Functions may not be deployed to Supabase yet.

### 3. **No Direct Gmail SMTP Integration**
Current functions use external services instead of direct Gmail SMTP.

---

## ✅ Solution Steps

### Step 1: Configure Environment Variables in Supabase

**Go to your Supabase Dashboard:**
1. https://supabase.com/dashboard
2. Select your project
3. Left sidebar → **Settings** → **Configuration** → **Environment Variables**

**Add these variables:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASSWORD=your-16-character-app-password
SENDER_NAME=Layer Team
SITE_URL=https://your-domain.com
```

**Important:** Replace with your actual Gmail address and App Password from the Gmail SMTP setup guide.

### Step 2: Deploy Edge Functions

**Option A: Using Supabase CLI (Recommended)**
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_ID

# Deploy functions
supabase functions deploy send-welcome-email
supabase functions deploy send-follower-notification
supabase functions deploy send-project-invitation
```

**Option B: Manual Deployment**
1. Go to Supabase Dashboard
2. Left sidebar → **Edge Functions**
3. Click **"New Function"**
4. Upload each function file from `/supabase/functions/`

### Step 3: Test Email Configuration

**In Supabase Dashboard:**
1. Go to **Authentication** → **Settings**
2. Scroll to **SMTP Settings**
3. Click **"Send Test Email"**
4. Enter your email address
5. Check if you receive the test email

### Step 4: Test Team Invitations

**In your Layer app:**
1. Sign in with Google
2. Go to a project
3. Click **"Add People"** or **"Invite Team Member"**
4. Enter a test email address
5. Click **"Send Invitation"**
6. Check the recipient's inbox (and spam folder)

---

## 🔧 Alternative Solutions

### Option 1: Use Resend (Easier Setup)
If Gmail SMTP continues to have issues, consider using Resend:

1. Sign up at https://resend.com
2. Get your API key
3. Set environment variables:
   ```
   RESEND_API_KEY=your-resend-api-key
   RESEND_FROM_EMAIL=Layer Team <team@yourdomain.com>
   ```

### Option 2: Use SendGrid
Another reliable email service:

1. Sign up at https://sendgrid.com
2. Get your API key
3. Configure in environment variables

---

## 🛠️ Debugging Commands

**Check function logs in Supabase:**
```bash
# View function logs
supabase functions logs send-welcome-email
supabase functions logs send-follower-notification
```

**Test function locally:**
```bash
# Serve functions locally
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/send-welcome-email \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
```

---

## 📋 Common Issues & Fixes

### Issue: "Authentication failed"
**Solution:**
- Double-check your App Password (16 characters, no spaces)
- Ensure 2FA is enabled on your Gmail account
- Generate a new App Password

### Issue: "Connection timeout"
**Solution:**
- Try port 465 with SSL instead of 587 with TLS
- Check if your network/firewall blocks SMTP ports
- Test with a different network

### Issue: "Email not received"
**Solution:**
- Check spam/junk folder
- Wait 5-10 minutes (emails can be delayed)
- Check Gmail security alerts
- Try sending to a different email provider

### Issue: "Function not found"
**Solution:**
- Verify functions are deployed
- Check function names match exactly
- Redeploy functions

---

## 🎯 Quick Verification Checklist

- [ ] Gmail 2FA enabled
- [ ] App Password generated
- [ ] Environment variables set in Supabase
- [ ] Edge Functions deployed
- [ ] SMTP test email works
- [ ] Team invitation test works
- [ ] Email received in inbox (not spam)

---

## 📞 Need More Help?

If you're still having issues:

1. **Check Supabase Logs:**
   - Dashboard → Logs → Function Logs
   - Look for error messages

2. **Verify Configuration:**
   - Double-check all environment variables
   - Ensure no typos in Gmail address or App Password

3. **Test Step by Step:**
   - First: SMTP test email in Supabase dashboard
   - Second: Welcome email when signing in
   - Third: Team invitation email

4. **Contact Support:**
   - Supabase Discord: https://discord.supabase.com
   - Gmail Support: https://support.google.com/mail

---

**Last Updated:** February 5, 2026
**Version:** 1.0