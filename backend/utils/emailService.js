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
}

module.exports = new EmailService();
