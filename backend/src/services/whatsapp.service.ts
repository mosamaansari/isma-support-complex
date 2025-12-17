import twilio from "twilio";
import logger from "../utils/logger";
import prisma from "../config/database";

class WhatsAppService {
  private client: twilio.Twilio | null = null;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // Format: whatsapp:+14155238886

    if (accountSid && authToken && whatsappFrom) {
      this.client = twilio(accountSid, authToken);
    } else {
      logger.warn("Twilio credentials not configured. WhatsApp notifications will not be sent.");
    }
  }

  async sendBillNotification(
    phoneNumber: string,
    billNumber: string,
    customerName: string,
    total: number,
    paid: number,
    remaining: number,
    billImageUrl?: string
  ) {
    try {
      if (!this.client) {
        logger.warn("WhatsApp client not initialized. Notification not sent.");
        return { success: false, message: "WhatsApp not configured" };
      }

      // Format phone number (remove spaces, add country code if needed)
      let formattedPhone = phoneNumber.replace(/\s+/g, "");
      
      // If phone doesn't start with +, assume it's a local number and add country code
      if (!formattedPhone.startsWith("+")) {
        // Default to Pakistan country code if not specified
        const countryCode = process.env.WHATSAPP_COUNTRY_CODE || "92";
        formattedPhone = `whatsapp:+${countryCode}${formattedPhone.replace(/^0+/, "")}`;
      } else {
        formattedPhone = `whatsapp:${formattedPhone}`;
      }

      const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || "";
      
      // Create message text
      const message = `🏪 *Isma Sports Complex*\n\n` +
        `📄 *Bill Receipt*\n\n` +
        `Bill Number: *${billNumber}*\n` +
        `Customer: *${customerName}*\n` +
        `Total Amount: *Rs. ${total.toFixed(2)}*\n` +
        `Paid: *Rs. ${paid.toFixed(2)}*\n` +
        `${remaining > 0 ? `Remaining: *Rs. ${remaining.toFixed(2)}*\n` : ""}` +
        `\nThank you for your business! 🙏\n\n` +
        `For any queries, contact us at: ${process.env.SHOP_CONTACT || ""}`;

      // Send text message
      const messageResponse = await this.client.messages.create({
        from: whatsappFrom,
        to: formattedPhone,
        body: message,
      });

      logger.info(`WhatsApp message sent to ${formattedPhone}: ${messageResponse.sid}`);

      // If bill image URL is provided, send it as media
      if (billImageUrl) {
        try {
          await this.client.messages.create({
            from: whatsappFrom,
            to: formattedPhone,
            mediaUrl: [billImageUrl],
            body: "📄 Your bill receipt",
          });
          logger.info(`WhatsApp bill image sent to ${formattedPhone}`);
        } catch (mediaError: any) {
          logger.error(`Error sending WhatsApp media: ${mediaError.message}`);
          // Don't fail the whole operation if media fails
        }
      }

      return { success: true, messageSid: messageResponse.sid };
    } catch (error: any) {
      logger.error(`Error sending WhatsApp notification to ${phoneNumber}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendBillNotificationWithImage(
    phoneNumber: string,
    sale: any,
    imageBuffer?: Buffer
  ) {
    try {
      if (!this.client) {
        logger.warn("WhatsApp client not initialized. Notification not sent.");
        return { success: false, message: "WhatsApp not configured" };
      }

      // Format phone number
      let formattedPhone = phoneNumber.replace(/\s+/g, "");
      if (!formattedPhone.startsWith("+")) {
        const countryCode = process.env.WHATSAPP_COUNTRY_CODE || "92";
        formattedPhone = `whatsapp:+${countryCode}${formattedPhone.replace(/^0+/, "")}`;
      } else {
        formattedPhone = `whatsapp:${formattedPhone}`;
      }

      const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || "";
      const payments = (sale.payments as Array<{ type: string; amount: number; date?: string }>) || [];
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const remaining = Number(sale.remainingBalance || 0);

      // Create message
      const message = `🏪 *Isma Sports Complex*\n\n` +
        `📄 *Payment Receipt*\n\n` +
        `Bill Number: *${sale.billNumber}*\n` +
        `Customer: *${sale.customerName || "Walk-in"}*\n` +
        `Total Amount: *Rs. ${Number(sale.total).toFixed(2)}*\n` +
        `Total Paid: *Rs. ${totalPaid.toFixed(2)}*\n` +
        `${remaining > 0 ? `Remaining: *Rs. ${remaining.toFixed(2)}*\n` : "✅ *Fully Paid*\n"}` +
        `\nThank you for your payment! 🙏\n\n` +
        `For any queries, contact us.`;

      // Send message
      const messageResponse = await this.client.messages.create({
        from: whatsappFrom,
        to: formattedPhone,
        body: message,
      });

      logger.info(`WhatsApp payment notification sent to ${formattedPhone}: ${messageResponse.sid}`);

      // If image buffer is provided, upload to a temporary URL or send via Twilio Media
      // For now, we'll just send the text message
      // To send images, you'd need to upload the image to a public URL first

      return { success: true, messageSid: messageResponse.sid };
    } catch (error: any) {
      logger.error(`Error sending WhatsApp notification:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new WhatsAppService();






