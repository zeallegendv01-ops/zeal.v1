const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🌾 Verify Your AgroCrown Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0d0d0b 0%, #1a1a18 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #ffd700; margin: 0;">AgroCrown</h1>
            <p style="color: #ccc; margin: 10px 0 0 0;">Premium Agricultural Exports</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0d0d0b; margin-top: 0;">Welcome, ${user.firstName}!</h2>
            
            <p style="color: #555; line-height: 1.6;">
              Thank you for creating your AgroCrown account. To complete your registration and start exploring premium agricultural exports, please verify your email address.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #ffd700; color: #0d0d0b; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px;">
              Or copy and paste this link in your browser:<br>
              <a href="${verificationUrl}" style="color: #ffd700; text-decoration: none; word-break: break-all;">
                ${verificationUrl}
              </a>
            </p>
            
            <p style="color: #555; margin-top: 30px; line-height: 1.6;">
              This verification link will expire in 24 hours.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you did not create this account, please ignore this email.<br>
              © 2026 AgroCrown Heritage. All Rights Reserved.
            </p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  async sendWelcomeEmail(user) {
    const telegramPhone = process.env.TELEGRAM_PHONE_NUMBER || '+234 8132120227';
    const telegramUsername = process.env.TELEGRAM_USERNAME || 'AgroCrown_Bot';
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🌾 Welcome to AgroCrown - Your Premium Agricultural Gateway',
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 650px; margin: 0 auto; background: #f5f5f5;">
          <!-- Hero Section -->
          <div style="background: linear-gradient(135deg, #0d0d0b 0%, #1a1a18 100%); padding: 50px 30px; text-align: center;">
            <h1 style="color: #ffd700; font-size: 36px; margin: 0; font-weight: bold;">🌾 AgroCrown</h1>
            <p style="color: #ccc; margin: 8px 0 0 0; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">Premium Agricultural Exports</p>
          </div>

          <!-- Welcome Content -->
          <div style="background: white; padding: 40px 30px;">
            <h2 style="color: #0d0d0b; font-size: 24px; margin: 0 0 20px 0;">Welcome, ${user.firstName}! 🎉</h2>
            
            <p style="color: #555; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0;">
              Your email has been verified, and your AgroCrown account is now fully activated. You're ready to explore our curated selection of premium, heritage-driven agricultural exports from West Africa.
            </p>

            <!-- Account Info Box -->
            <div style="background: linear-gradient(135deg, #f9f9f9 0%, #f0f0f0 100%); border-left: 4px solid #ffd700; padding: 20px; margin: 25px 0; border-radius: 5px;">
              <p style="margin: 0; color: #0d0d0b; font-weight: bold; font-size: 14px;">Account Details</p>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">
                <strong>Name:</strong> ${user.firstName} ${user.lastName}<br>
                <strong>Email:</strong> ${user.email}<br>
                <strong>Account Type:</strong> ${user.accountType}
              </p>
            </div>

            <!-- What You Can Do -->
            <h3 style="color: #0d0d0b; font-size: 16px; margin: 30px 0 15px 0; font-weight: bold;">What You Can Do Now</h3>
            <ul style="color: #555; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Browse our exclusive collection of premium agricultural products</li>
              <li>Add items to your cart and proceed to checkout</li>
              <li>Track your orders in real-time</li>
              <li>Manage your account and preferences</li>
              <li>Subscribe to our newsletter for market updates</li>
            </ul>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:8000'}" style="background-color: #ffd700; color: #0d0d0b; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 15px; transition: background 0.3s;">
                Explore Products →
              </a>
            </div>

            <hr style="border: none; border-top: 2px solid #f0f0f0; margin: 30px 0;">

            <!-- Support Section -->
            <h3 style="color: #0d0d0b; font-size: 16px; margin: 25px 0 15px 0; font-weight: bold;">Need Help or Have Questions?</h3>
            <p style="color: #555; font-size: 14px; line-height: 1.8; margin: 0 0 15px 0;">
              We're here to assist you! Connect with our support team through your preferred channel:
            </p>

            <!-- Telegram Contact Box -->
            <div style="background: linear-gradient(135deg, #0d0d0b 0%, #1a1a18 100%); padding: 25px; border-radius: 8px; margin: 20px 0;">
              <div style="display: flex; align-items: center; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <div style="text-align: center;">
                  <p style="color: #ccc; font-size: 12px; margin: 0 0 8px 0; letter-spacing: 1px; text-transform: uppercase;">Telegram Support</p>
                  <a href="https://t.me/${telegramUsername}" style="color: #ffd700; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block;">
                    <i style="font-style: italic;">📱 ${telegramPhone}</i>
                  </a>
                  <p style="color: #999; font-size: 11px; margin: 5px 0 0 0;">Available 24/7 for your inquiries</p>
                </div>
              </div>
            </div>

            <!-- Additional Info -->
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #0d0d0b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Why Choose AgroCrown?</h4>
              <ul style="color: #666; font-size: 13px; line-height: 1.7; margin: 0; padding-left: 20px;">
                <li>✓ 100% Organic Certified Products</li>
                <li>✓ Direct from West African Heritage Producers</li>
                <li>✓ Premium Quality Assurance</li>
                <li>✓ Global Export Network (12+ Nations)</li>
                <li>✓ Sustainable & Fair Trade Practices</li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #0d0d0b; padding: 30px; text-align: center; border-top: 3px solid #ffd700;">
            <p style="color: #ccc; font-size: 12px; margin: 0 0 12px 0; line-height: 1.6;">
              Questions? Visit our website or reach out via Telegram.<br>
              We're committed to providing you with the finest agricultural exports.
            </p>
            <p style="color: #999; font-size: 11px; margin: 0;">
              © 2026 AgroCrown Heritage. All Rights Reserved. | Est. 2026 | Nigeria
            </p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Welcome email send error:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '🌾 Reset Your AgroCrown Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0d0d0b 0%, #1a1a18 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #ffd700; margin: 0;">AgroCrown</h1>
            <p style="color: #ccc; margin: 10px 0 0 0;">Premium Agricultural Exports</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0d0d0b; margin-top: 0;">Password Reset Request</h2>
            
            <p style="color: #555; line-height: 1.6;">
              We received a request to reset your AgroCrown password. Click the button below to create a new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #ffd700; color: #0d0d0b; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px;">
              Or copy and paste this link in your browser:<br>
              <a href="${resetUrl}" style="color: #ffd700; text-decoration: none; word-break: break-all;">
                ${resetUrl}
              </a>
            </p>
            
            <p style="color: #555; margin-top: 30px; line-height: 1.6;">
              This reset link will expire in 1 hour.<br>
              If you did not request a password reset, please ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2026 AgroCrown Heritage. All Rights Reserved.
            </p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  async sendInvoiceEmail(order, invoiceHTML) {
    const invoiceFileName = `Invoice-${order._id}.html`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: order.buyer.email,
      subject: `🌾 Invoice & Receipt - AgroCrown Order #${order._id}`,
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 650px; margin: 0 auto;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0d0d0b 0%, #1a1a18 100%); padding: 50px 30px; text-align: center;">
            <h1 style="color: #ffd700; font-size: 36px; margin: 0; font-weight: bold;">🌾 AgroCrown</h1>
            <p style="color: #ccc; margin: 8px 0 0 0; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">Premium Agricultural Exports</p>
          </div>

          <!-- Content -->
          <div style="background: white; padding: 40px 30px;">
            <h2 style="color: #0d0d0b; font-size: 24px; margin: 0 0 10px 0;">Invoice & Receipt</h2>
            <p style="color: #999; font-size: 12px; margin: 0 0 20px 0;">Order #${order._id}</p>
            
            <p style="color: #555; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0;">
              Thank you for your purchase, <strong>${order.buyer.firstName}</strong>! Your order has been successfully processed and payment received.
            </p>

            <!-- Order Summary Box -->
            <div style="background: linear-gradient(135deg, #f9f9f9 0%, #f0f0f0 100%); border-left: 4px solid #ffd700; padding: 20px; margin: 25px 0; border-radius: 5px;">
              <p style="margin: 0 0 12px 0; color: #0d0d0b; font-weight: bold; font-size: 14px;">Order Summary</p>
              <p style="margin: 8px 0; color: #666; font-size: 13px;">
                <strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
                <strong>Items:</strong> ${order.items.length} product(s)<br>
                <strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">✓ Payment Completed</span>
              </p>
            </div>

            <!-- Amount Box -->
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                <span style="color: #555;">Subtotal:</span>
                <span style="color: #0d0d0b; font-weight: 600;">NGN${order.subtotal?.toLocaleString() || 0}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                <span style="color: #555;">Tax:</span>
                <span style="color: #0d0d0b; font-weight: 600;">NGN${order.tax?.toLocaleString() || 0}</span>
              </div>
              ${order.shippingCost > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                <span style="color: #555;">Shipping:</span>
                <span style="color: #0d0d0b; font-weight: 600;">NGN${order.shippingCost?.toLocaleString() || 0}</span>
              </div>
              ` : ''}
              <div style="border-top: 2px solid #ffd700; padding-top: 10px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
                <span style="color: #0d0d0b;">Total Amount Paid:</span>
                <span style="color: #ffd700;">NGN${order.total?.toLocaleString() || 0}</span>
              </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; margin: 25px 0; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;">
                  <th style="padding: 10px; text-align: left; color: #0d0d0b; font-weight: 600;">Product</th>
                  <th style="padding: 10px; text-align: center; color: #0d0d0b; font-weight: 600;">Qty</th>
                  <th style="padding: 10px; text-align: right; color: #0d0d0b; font-weight: 600;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; color: #555;">${item.product.name || 'Product'}</td>
                    <td style="padding: 10px; text-align: center; color: #555;">${item.weight ? item.weight + ' kg' : item.quantity + ' unit(s)'}</td>
                    <td style="padding: 10px; text-align: right; color: #555;">NGN${item.subtotal?.toLocaleString() || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Invoice Download -->
            <div style="background: linear-gradient(135deg, #2a4a1e 0%, #1a3a0d 100%); padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <p style="margin: 0 0 12px 0; color: white; font-size: 14px; font-weight: bold;">📄 Full Invoice Attached</p>
              <p style="margin: 0; color: #ccc; font-size: 12px;">A detailed HTML invoice has been attached to this email. You can download, print, or save it for your records.</p>
            </div>

            <!-- Delivery Info -->
            <div style="background: #f9f9f9; padding: 20px; border-left: 4px solid #2a4a1e; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #0d0d0b; font-weight: bold; font-size: 13px;">📦 What's Next?</p>
              <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 13px; line-height: 1.8;">
                <li>Your order is being processed and prepared for shipment</li>
                <li>You'll receive tracking information via email within 24 hours</li>
                <li>You can monitor your order status anytime in your account dashboard</li>
                <li>For urgent inquiries, contact us via Telegram</li>
              </ul>
            </div>

            <!-- Support -->
            <div style="background: linear-gradient(135deg, #0d0d0b 0%, #1a1a18 100%); padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <p style="margin: 0 0 12px 0; color: #ccc; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">Need Help?</p>
              <p style="margin: 0; color: #ffd700; font-size: 14px; font-weight: bold;">
                📱 Contact us on Telegram<br>
                📧 support@agrocrown.com
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #0d0d0b; padding: 30px; text-align: center; border-top: 3px solid #ffd700;">
            <p style="color: #ccc; font-size: 12px; margin: 0 0 12px 0; line-height: 1.6;">
              Thank you for choosing AgroCrown for premium agricultural products.<br>
              We're committed to providing you with the finest exports from West Africa.
            </p>
            <p style="color: #999; font-size: 11px; margin: 0;">
              © 2026 AgroCrown Heritage. All Rights Reserved. | EST. 2026 | NIGERIA
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: invoiceFileName,
          content: invoiceHTML,
          contentType: 'text/html'
        }
      ]
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('[SUCCESS] Invoice email sent to:', order.buyer.email);
      return true;
    } catch (error) {
      console.error('Invoice email send error:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
