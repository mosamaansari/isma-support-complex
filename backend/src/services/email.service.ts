import nodemailer from "nodemailer";
import logger from "../utils/logger";

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn("SMTP credentials not configured. Email not sent.");
        return { success: false, message: "SMTP not configured" };
      }

      const mailOptions = {
        from: `"Isma Sports Complex" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error(`Error sending email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendAccountCreatedEmail(email: string, name: string, username: string) {
    const subject = "Welcome to Isma Sports Complex - Your Account Has Been Created";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #465fff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #465fff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Isma Sports Complex</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your account has been successfully created!</p>
            <p><strong>Account Details:</strong></p>
            <ul>
              <li><strong>Username:</strong> ${username}</li>
              <li><strong>Email:</strong> ${email}</li>
            </ul>
            <p>You can now log in to your account using your username and password.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br>Isma Sports Complex Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendLoginEmail(email: string, name: string, loginTime: string, ipAddress?: string) {
    const subject = "Login Notification - Isma Sports Complex";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #465fff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: #fff; padding: 15px; border-left: 4px solid #465fff; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Login Notification</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>You have successfully logged into your Isma Sports Complex account.</p>
            <div class="info-box">
              <p><strong>Login Time:</strong> ${loginTime}</p>
              ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ""}
            </div>
            <p>If this was not you, please contact our support team immediately and change your password.</p>
            <p>Best regards,<br>Isma Sports Complex Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendForgotPasswordEmail(email: string, name: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
    const subject = "Password Reset Request - Isma Sports Complex";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #465fff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #465fff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>We received a request to reset your password for your Isma Sports Complex account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <div class="warning">
              <p><strong>Important:</strong> This link will expire in 1 hour. If you did not request this password reset, please ignore this email.</p>
            </div>
            <p>Best regards,<br>Isma Sports Complex Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendPasswordResetSuccessEmail(email: string, name: string) {
    const subject = "Password Reset Successful - Isma Sports Complex";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .success-box { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Successful</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <div class="success-box">
              <p><strong>Your password has been successfully reset!</strong></p>
            </div>
            <p>You can now log in to your account using your new password.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <p>Best regards,<br>Isma Sports Complex Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendPasswordChangedEmail(email: string, name: string) {
    const subject = "Password Changed - Isma Sports Complex";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #465fff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: #fff; padding: 15px; border-left: 4px solid #465fff; margin: 20px 0; }
          .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <div class="info-box">
              <p>Your password has been successfully changed.</p>
            </div>
            <div class="warning">
              <p><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
            </div>
            <p>Best regards,<br>Isma Sports Complex Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendLowStockAlertEmail(email: string, name: string, products: Array<{ name: string; currentStock: number; minStock: number }>) {
    const subject = "Low Stock Alert - Isma Sports Complex";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff6b6b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #465fff; color: white; }
          .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Low Stock Alert</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>The following products are running low on stock:</p>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Current Stock</th>
                  <th>Minimum Stock</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.currentStock}</td>
                    <td>${p.minStock}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div class="warning">
              <p><strong>Action Required:</strong> Please restock these products as soon as possible.</p>
            </div>
            <p>Best regards,<br>Isma Sports Complex Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(email, subject, html);
  }
}

export default new EmailService();














