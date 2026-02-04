# Email Welcome Notification Setup

This document explains how to set up the welcome email notification that is sent to users when they sign in with Google to your Layer application.

## How It Works

When a user successfully signs in with their Google account, the application will automatically trigger a welcome email notification to their registered email address. This provides immediate confirmation that they've successfully logged in to Layer.

## Implementation Details

### 1. Frontend Integration
- The `signInWithGoogle()` function in `supabase-client.js` initiates the OAuth flow
- When authentication succeeds, an `authStateChanged` event is fired
- The event handler in `app.js` calls `window.LayerDB.sendWelcomeEmail()` with the user's email and name
- This triggers an HTTP request to the Supabase Edge Function

### 2. Backend Service (Supabase Edge Function)
- Located at `supabase/functions/send-welcome-email/index.ts`
- Receives the user's email and name via HTTP POST
- Contains both HTML and plain text email templates
- Designed to integrate with email services like Resend, SendGrid, etc.

## Required Setup for Production

### 1. Deploy the Supabase Edge Function
```bash
# Navigate to your Supabase project
supabase functions deploy send-welcome-email
```

### 2. Configure Email Service
The current implementation includes commented code for using Resend as the email service. To activate:

1. Sign up for an email service (recommended: [Resend](https://resend.com))
2. Obtain your API key
3. Uncomment and configure the email service code in `supabase/functions/send-welcome-email/index.ts`
4. Add your API key as a secret to Supabase:
```bash
supabase secrets set RESEND_API_KEY=your_api_key_here
```

### 3. Update CORS Settings
Ensure your Supabase project allows requests from your frontend origin by configuring CORS appropriately.

## Email Template

The welcome email includes:
- Personalized greeting with the user's name
- Confirmation of successful Google login
- Welcome message about Layer features
- Invitation to start using the application
- Professional footer with explanation of why the email was sent

## Security Considerations

- The email service is called server-side to prevent abuse
- Input validation occurs on the backend
- No sensitive information is included in the email
- Email sending is rate-limited by the email service provider

## Testing

During development, the function logs email requests to the console. When properly configured with an email service, it will send actual welcome emails to users upon signing in with Google.

## Troubleshooting

- If emails aren't being sent, check the browser console for errors
- Verify that the Supabase Edge Function is deployed and accessible
- Confirm your email service API keys are properly configured
- Check CORS settings if requests are being blocked