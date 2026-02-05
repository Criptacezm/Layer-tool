# Gmail SMTP Setup for Supabase - Step-by-Step Guide

This guide will walk you through setting up Gmail SMTP in Supabase to enable email notifications for team invitations.

---

## 🎯 Quick Start: Where to Find SMTP Settings

**Exact Location in Supabase:**
1. **Supabase Dashboard** → https://supabase.com/dashboard
2. **Select your project**
3. **Left Sidebar** → Click **"Authentication"** (key/lock icon)
4. **Top Tabs** → Click **"Settings"** tab
5. **Scroll Down** → Find **"SMTP Settings"** section
6. **Enable** → Turn on "Custom SMTP" toggle
7. **Fill in** → Enter Gmail SMTP details (see Step 4 below)

**Can't find it?** See "If You Can't Find SMTP Settings" section below for alternative paths.

---

## 📋 Prerequisites

- A Gmail account
- Access to your Supabase project dashboard
- 5-10 minutes

---

## Step 1: Enable 2-Factor Authentication on Gmail

**Why?** Gmail requires 2FA to generate App Passwords for SMTP.

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/
   - Sign in with your Gmail account

2. **Enable 2-Step Verification**
   - Click "Security" in the left sidebar
   - Find "2-Step Verification" section
   - Click "Get started" or "Turn on"
   - Follow the prompts to set up 2FA (you can use your phone)

3. **Verify 2FA is Enabled**
   - You should see "2-Step Verification: On" in green

---

## Step 2: Generate Gmail App Password

**What is an App Password?** A special password for apps (like Supabase) to access your Gmail account securely.

1. **Go to App Passwords Page**
   - Visit: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords

2. **Select App and Device**
   - **Select app**: Choose "Mail" (or "Other" and type "Supabase")
   - **Select device**: Choose "Other" and type "Supabase Email Service"
   - Click "Generate"

3. **Copy the App Password**
   - A 16-character password will appear (like: `abcd efgh ijkl mnop`)
   - **IMPORTANT**: Copy this password NOW - you won't see it again!
   - Remove the spaces when using it (should be: `abcdefghijklmnop`)
   - Save it somewhere safe (password manager, notes, etc.)

---

## Step 3: Get Gmail SMTP Settings

**Where do these values come from?** Here's where to find each setting:

### Gmail SMTP Settings Reference

| Setting | Value | Where to Get It |
|---------|-------|-----------------|
| **SMTP Host** | `smtp.gmail.com` | ✅ **Standard Gmail setting** - Always use this (no need to look it up) |
| **SMTP Port** | `587` (TLS) or `465` (SSL) | ✅ **Standard Gmail setting** - Always use 587 or 465 |
| **Security** | TLS (recommended) or SSL | ✅ **Standard Gmail setting** - Use TLS with port 587 |
| **Username** | Your full Gmail address | ✅ **Your Gmail account** - e.g., `yourname@gmail.com` |
| **Password** | 16-character App Password | ✅ **From Step 2** - Generated at https://myaccount.google.com/apppasswords |
| **Sender Email** | Your full Gmail address | ✅ **Your Gmail account** - Same as Username |
| **Sender Name** | "Layer Team" (optional) | ✅ **You choose** - Any name you want |

### Quick Answer: Where Do I Get These?

**✅ You DON'T need to look these up - they're standard Gmail settings:**

- **SMTP Host**: `smtp.gmail.com` ← This is ALWAYS the same for Gmail
- **SMTP Port**: `587` ← This is ALWAYS the same for Gmail (or 465)
- **Security**: `TLS` ← This is ALWAYS the same for Gmail

**✅ You DO need to provide these from your account:**

- **Username**: Your Gmail email address (you know this)
- **Password**: The App Password you generated in Step 2
- **Sender Email**: Same as your Gmail address
- **Sender Name**: You can type anything (like "Layer Team")

**Note**: 
- Port `587` with TLS is recommended (more secure)
- Port `465` with SSL also works
- Port `25` is usually blocked by ISPs, so don't use it

---

## Step 4: Configure SMTP in Supabase

### Exact Navigation Path:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Sign in with your account
   - **Select your project** from the project list (if you have multiple projects)

2. **Navigate to Authentication Settings**
   - **Look at the LEFT SIDEBAR** (vertical menu on the left side)
   - Find and **click on "Authentication"** (it has a key/lock icon)
   - This will open the Authentication page

3. **Find the Settings Tab**
   - At the TOP of the Authentication page, you'll see tabs:
     - "Users" (default)
     - "Policies"
     - **"Settings"** ← Click this one!
   - Click on **"Settings"** tab

4. **Scroll to SMTP Settings Section**
   - On the Settings page, scroll down
   - Look for a section called **"SMTP Settings"** or **"Email Settings"**
   - It might be under "Email" or "SMTP Configuration"
   - If you don't see it, look for "Custom SMTP" or "Email Provider"

5. **Enable Custom SMTP**
   - Find the toggle/switch that says **"Enable Custom SMTP"** or **"Use Custom SMTP"**
   - **Turn it ON** (click the toggle to enable it)
   - Once enabled, you'll see input fields appear below

6. **Enter Gmail SMTP Settings**

   **You should now see these fields. Fill them in exactly:**

   **Field 1: SMTP Host**
   - Label: "SMTP Host" or "Host" or "Server"
   - **Enter**: `smtp.gmail.com`
   - (This is the Gmail SMTP server address)

   **Field 2: SMTP Port**
   - Label: "SMTP Port" or "Port"
   - **Enter**: `587`
   - (Alternative: `465` if 587 doesn't work)

   **Field 3: SMTP User / Username**
   - Label: "SMTP User", "Username", or "User"
   - **Enter**: Your full Gmail address
   - Example: `yourname@gmail.com`
   - (Use the same email you used to generate the App Password)

   **Field 4: SMTP Password**
   - Label: "SMTP Password" or "Password"
   - **Enter**: Your 16-character App Password (NO SPACES!)
   - Example: `abcdefghijklmnop`
   - ⚠️ **Important**: Remove all spaces from the App Password
   - ⚠️ **Important**: This is NOT your regular Gmail password!

   **Field 5: Sender Email**
   - Label: "Sender Email", "From Email", or "Email"
   - **Enter**: Your full Gmail address (same as above)
   - Example: `yourname@gmail.com`

   **Field 6: Sender Name (Optional)**
   - Label: "Sender Name" or "From Name"
   - **Enter**: `Layer Team` (or any name you want)
   - This is what recipients will see as the sender name

   **Field 7: Security / Encryption**
   - Label: "Security", "Encryption", or "Connection Type"
   - **Select**: `TLS` (for port 587) or `SSL` (for port 465)
   - **Recommended**: Choose `TLS` if using port 587

7. **Save Settings**
   - Scroll down to find the **"Save"** or **"Update"** button
   - Click **"Save"** or **"Update"**
   - Wait for a success message (usually green notification at top)
   - If you see an error, check all fields are filled correctly

### Visual Guide (What You Should See):

```
Supabase Dashboard
├── Left Sidebar
│   ├── Table Editor
│   ├── SQL Editor
│   ├── Authentication ← CLICK HERE
│   ├── Storage
│   └── ...
│
Authentication Page
├── Top Tabs
│   ├── Users
│   ├── Policies
│   └── Settings ← CLICK HERE
│
Settings Page
├── [Scroll down...]
└── SMTP Settings Section
    ├── ☑ Enable Custom SMTP ← TURN ON
    ├── SMTP Host: [smtp.gmail.com]
    ├── SMTP Port: [587]
    ├── SMTP User: [yourname@gmail.com]
    ├── SMTP Password: [abcdefghijklmnop]
    ├── Sender Email: [yourname@gmail.com]
    ├── Sender Name: [Layer Team]
    ├── Security: [TLS ▼]
    └── [Save] button
```

### If You Can't Find SMTP Settings:

**🔍 Try These Alternative Navigation Paths:**

**Path 1: Through Project Settings**
1. Click on your **project name** (top left) or gear icon ⚙️
2. Click **"Project Settings"** or **"Settings"**
3. Look for **"Auth"** or **"Authentication"** in the left menu
4. Click **"Auth"** → Look for **"SMTP"** or **"Email"** section

**Path 2: Direct URL (if available)**
- Try going directly to: `https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/auth/settings`
- Replace `[YOUR_PROJECT_ID]` with your actual project ID (found in URL)

**Path 3: Through API Settings**
1. Go to **"Settings"** (gear icon)
2. Click **"API"** or **"Configuration"**
3. Look for **"Auth"** or **"Email"** settings

**Path 4: Search in Dashboard**
1. Use browser search: Press `Ctrl+F` (Windows) or `Cmd+F` (Mac)
2. Type: `SMTP` or `smtp` or `email`
3. Look for highlighted text on the page

**Path 5: Check All Menu Items**
- Look through ALL items in the left sidebar:
  - Authentication
  - Settings
  - Project Settings
  - Configuration
  - API Settings

**Still Can't Find It?**

1. **Check Supabase Version**
   - Newer Supabase: Authentication → Settings → SMTP Settings
   - Older Supabase: Settings → Auth → Email Settings
   - Some projects: Project Settings → Auth → SMTP

2. **Contact Supabase Support**
   - Go to: https://supabase.com/support
   - Ask: "Where can I find SMTP settings for email configuration?"

3. **Alternative: Use Edge Functions**
   - If SMTP settings aren't available, you can use Edge Functions instead
   - See "Option B" in `TEAM_SETUP_GUIDE.md`

**💡 Pro Tip:**
- Take a screenshot of your Supabase dashboard
- Look for any section mentioning "Email", "SMTP", "Auth", or "Settings"
- The SMTP settings are usually in the Authentication or Settings area

---

## Step 5: Test Email Configuration

1. **Send a Test Email**
   - Look for "Send Test Email" or "Test SMTP" button
   - Enter your own email address
   - Click "Send Test Email"

2. **Check Your Inbox**
   - Check your email inbox (and spam folder)
   - You should receive a test email from Supabase
   - If you receive it, SMTP is working! ✅

3. **If Test Fails**
   - Check all settings are correct
   - Verify App Password is correct (no spaces)
   - Try port 465 with SSL instead of 587 with TLS
   - Check Gmail account security settings

---

## Step 6: Test Team Invitation Email

Now test if team invitations work:

1. **Go to Your Layer App**
   - Navigate to your application
   - Sign in with Google

2. **Send a Test Invitation**
   - Go to Team tab
   - Click "Add People"
   - Enter your own email (or a test email)
   - Click "Send Invitation"

3. **Check Email**
   - Check the recipient's inbox
   - You should receive an invitation email
   - Email should be from "Layer Team" (or your sender name)

---

## 🔧 Troubleshooting

### Issue: "Authentication failed" or "Invalid credentials"

**Solutions:**
1. Double-check your App Password (no spaces, all 16 characters)
2. Make sure 2FA is enabled on your Gmail account
3. Verify your Gmail address is correct
4. Try generating a new App Password

### Issue: "Connection timeout" or "Cannot connect"

**Solutions:**
1. Check your internet connection
2. Verify SMTP host: `smtp.gmail.com` (not `smtp.google.com`)
3. Try port `465` with SSL instead of `587` with TLS
4. Check if your firewall is blocking the connection

### Issue: "Port 587 blocked"

**Solutions:**
1. Use port `465` with SSL instead
2. Check with your network administrator (if on corporate network)

### Issue: "Test email not received"

**Solutions:**
1. Check spam/junk folder
2. Wait a few minutes (emails can be delayed)
3. Verify sender email is correct
4. Check Gmail account for security alerts
5. Try sending to a different email address

### Issue: "Too many emails sent" or "Rate limit exceeded"

**Solutions:**
1. Gmail has daily sending limits (500 emails/day for free accounts)
2. Wait 24 hours or upgrade to Google Workspace
3. Consider using a dedicated email service (SendGrid, Mailgun) for production

---

## 📊 Gmail SMTP Limits

Be aware of Gmail's limits:

- **Free Gmail**: 500 emails per day
- **Google Workspace**: 2,000 emails per day
- **Rate limit**: ~100 emails per hour

**For Production**: Consider using a dedicated email service:
- SendGrid (free tier: 100 emails/day)
- Mailgun (free tier: 5,000 emails/month)
- AWS SES (very cheap, pay per email)

---

## ✅ Quick Reference

### Gmail SMTP Settings Summary

```
Host: smtp.gmail.com
Port: 587 (TLS) or 465 (SSL)
Username: yourname@gmail.com
Password: [16-character App Password]
Sender: yourname@gmail.com
```

### Where to Get Settings

- **SMTP Host & Port**: Standard Gmail settings (always `smtp.gmail.com` and `587`/`465`)
- **Username**: Your Gmail address
- **Password**: Generated at https://myaccount.google.com/apppasswords
- **Sender**: Your Gmail address

---

## 🎉 You're Done!

Once SMTP is configured:
- ✅ Team invitations will send emails
- ✅ Follow requests will send notifications
- ✅ Project invitations will send emails
- ✅ Welcome emails will work

**Next Steps:**
1. Test sending an invitation
2. Check that emails are received
3. Start inviting team members!

---

## 📞 Need Help?

If you're still having issues:
1. Check Supabase logs: Dashboard → Logs
2. Verify all settings match this guide exactly
3. Try generating a new App Password
4. Test with a different Gmail account

---

**Last Updated**: 2024
**Version**: 1.0
