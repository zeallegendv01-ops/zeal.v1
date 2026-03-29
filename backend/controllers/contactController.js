const telegramNotifier = require('../utils/telegramNotifier');

exports.sendContact = async (req, res, next) => {
  try {
    const { fullName, email, subject, message } = req.body;

    // Validation
    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Send to Telegram
    const telegramMessage = `
📨 <b>NEW CONTACT INQUIRY</b>

👤 <b>Name:</b> ${fullName}
📧 <b>Email:</b> ${email}
📝 <b>Subject:</b> ${subject}

💬 <b>Message:</b>
${message}

⏰ <b>Received:</b> ${new Date().toLocaleString()}
    `.trim();

    await telegramNotifier.sendMessage(
      process.env.ADMIN_TELEGRAM_ID,
      telegramMessage,
      { parseMode: 'HTML' }
    );

    res.status(200).json({
      success: true,
      message: 'Your inquiry has been sent successfully. We will get back to you soon!'
    });
  } catch (error) {
    console.error('Contact form error:', error);
    next(error);
  }
};
