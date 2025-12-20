# Email Configuration Guide

This application uses nodemailer to send emails for various events. Follow these steps to configure email functionality.

## Required Environment Variables

Add these variables to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173
```

## Gmail Setup

If using Gmail, you need to:

1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password in `SMTP_PASS`

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Custom SMTP
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false  # or true for port 465
```

## Email Features

The following emails are automatically sent:

1. **Account Creation** - When a new user is created
2. **Login Notification** - Every time a user logs in
3. **Forgot Password** - When user requests password reset
4. **Password Reset Success** - After successful password reset
5. **Password Changed** - When user changes password in profile
6. **Low Stock Alert** - When product stock goes below minimum level

## Testing

If SMTP credentials are not configured, the application will log a warning but continue to function normally. Emails will not be sent in this case.








