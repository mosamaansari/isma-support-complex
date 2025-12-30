# WhatsApp Notification Setup Guide

This application uses Twilio WhatsApp API to send bill notifications to customers when payments are made.

## Required Environment Variables

Add these variables to your `.env` file:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Your Twilio WhatsApp number
WHATSAPP_COUNTRY_CODE=92  # Default country code (92 for Pakistan)
SHOP_CONTACT=+92 300 1234567  # Your shop contact number for WhatsApp messages
```

## Twilio Setup

1. **Create a Twilio Account**
   - Go to https://www.twilio.com/
   - Sign up for a free account
   - Verify your phone number

2. **Get Twilio Credentials**
   - Go to Twilio Console → Account → API Keys & Tokens
   - Copy your Account SID and Auth Token

3. **Set up WhatsApp Sandbox (for testing)**
   - Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
   - Follow instructions to join the sandbox
   - You'll get a WhatsApp number like `whatsapp:+14155238886`

4. **Upgrade to Production (for live use)**
   - For production, you need to:
     - Apply for WhatsApp Business API access
     - Get approved by Twilio
     - Use your approved WhatsApp Business number

## Phone Number Format

The system automatically formats phone numbers:
- If phone starts with `+`, it uses as is
- Otherwise, it adds country code (default: 92 for Pakistan)
- Removes leading zeros
- Formats as `whatsapp:+92XXXXXXXXXX`

## Features

1. **Payment Notification** - When payment is added to a sale, customer receives WhatsApp message with:
   - Bill number
   - Customer name
   - Total amount
   - Paid amount
   - Remaining balance (if any)

2. **New Sale Notification** - When a new sale is created with completed payment, customer receives notification

## Testing

If Twilio credentials are not configured, the application will log a warning but continue to function normally. WhatsApp notifications will not be sent in this case.

## Cost

- Twilio WhatsApp messages are charged per message
- Check Twilio pricing: https://www.twilio.com/whatsapp/pricing
- Sandbox messages are free for testing

## Alternative Options

If you don't want to use Twilio, you can:
1. Use WhatsApp Business API directly (requires Meta Business account)
2. Use other WhatsApp API providers
3. Disable WhatsApp notifications (app will work normally)













