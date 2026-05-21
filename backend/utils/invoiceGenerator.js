/**
 * Invoice Generator - Creates professional HTML/PDF invoices for orders
 */

function generateInvoiceHTML(order) {
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const itemsHTML = order.items.map((item, index) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">${index + 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">
        ${item.product.name || 'Unknown Product'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; color: #555;">
        ${item.weight ? item.weight + ' kg' : item.quantity + ' unit(s)'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #555;">
        NGN${item.pricePerUnit?.toLocaleString() || 0}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #555;">
        NGN${item.subtotal?.toLocaleString() || 0}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice - 365extra</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #ffd700; padding-bottom: 20px; }
        .logo { font-size: 32px; font-weight: bold; color: #0d0d0b; }
        .logo-subtitle { font-size: 12px; color: #999; letter-spacing: 2px; text-transform: uppercase; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 24px; font-weight: bold; color: #0d0d0b; margin-bottom: 10px; }
        .invoice-details { font-size: 13px; color: #666; line-height: 1.8; }
        .invoice-details strong { color: #0d0d0b; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 12px; text-transform: uppercase; color: #0d0d0b; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px; }
        .buyer-info, .seller-info { display: inline-block; width: 48%; vertical-align: top; font-size: 13px; }
        .buyer-info { }
        .seller-info { text-align: right; }
        .buyer-info p, .seller-info p { margin-bottom: 8px; color: #555; }
        .buyer-info strong, .seller-info strong { color: #0d0d0b; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #f0f0f0; padding: 12px; text-align: left; font-weight: 600; color: #0d0d0b; font-size: 13px; border-bottom: 2px solid #ddd; }
        td { padding: 12px; }
        .summary { float: right; width: 40%; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .summary-row.total { border-bottom: 2px solid #ffd700; border-top: 2px solid #ffd700; padding: 12px 0; margin: 10px 0; font-weight: bold; font-size: 16px; color: #0d0d0b; }
        .summary-row.total-label, .summary-row.total-value { color: #0d0d0b; }
        .clearfix { clear: both; }
        .notes { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; background: #f9f9f9; padding: 15px; border-radius: 5px; }
        .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
        @media print { 
          body { background: white; }
          .container { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div>
            <div class="logo">🌾 365extra</div>
            <div class="logo-subtitle">Premium Agricultural Exports</div>
          </div>
          <div class="invoice-info">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-details">
              <p><strong>Invoice #:</strong> ${order._id}</p>
              <p><strong>Date:</strong> ${orderDate}</p>
              <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">PAID</span></p>
            </div>
          </div>
        </div>

        <!-- Buyer & Seller Info -->
        <div class="section">
          <div class="buyer-info">
            <div class="section-title">Bill To</div>
            <p><strong>${order.buyer.firstName} ${order.buyer.lastName}</strong></p>
            <p>${order.buyer.email}</p>
            ${order.buyer.phone ? `<p>📱 ${order.buyer.phone}</p>` : ''}
            ${order.shippingAddress ? `<p>📍 <strong>Delivery Address:</strong><br>
              ${order.shippingAddress.street || 'N/A'}<br>
              ${order.shippingAddress.city || ''} ${order.shippingAddress.state || ''} ${order.shippingAddress.postalCode || ''}<br>
              ${order.shippingAddress.country || 'Nigeria'}
            </p>` : ''}
          </div>
          <div class="seller-info">
            <div class="section-title">From</div>
            <p><strong>365extra Heritage Ltd.</strong></p>
            <p>Lagos, Nigeria</p>
            <p>📧 support@365extra.com</p>
            <p>🌐 www.365extra.com</p>
          </div>
        </div>

        <!-- Items Table -->
        <div class="section">
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">No.</th>
                <th style="width: 40%;">Item Description</th>
                <th style="width: 15%; text-align: center;">Quantity</th>
                <th style="width: 20%; text-align: right;">Unit Price</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div class="clearfix"></div>
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>NGN${order.subtotal?.toLocaleString() || 0}</span>
          </div>
          <div class="summary-row">
            <span>Tax (${(order.tax ? ((order.tax / order.subtotal) * 100).toFixed(0) : 10)}%):</span>
            <span>NGN${order.tax?.toLocaleString() || 0}</span>
          </div>
          ${order.shippingCost > 0 ? `
          <div class="summary-row">
            <span>Shipping:</span>
            <span>NGN${order.shippingCost?.toLocaleString() || 0}</span>
          </div>
          ` : ''}
          <div class="summary-row total">
            <span class="total-label">TOTAL:</span>
            <span class="total-value">NGN${order.total?.toLocaleString() || 0}</span>
          </div>
        </div>

        <div class="clearfix"></div>

        <!-- Notes -->
        ${order.notes ? `
        <div class="notes">
          <strong>Order Notes:</strong><br>
          ${order.notes}
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>Thank you for your purchase! Your order is being processed.</p>
          <p>For support, contact us via Telegram or email: support@365extra.com</p>
          <p style="margin-top: 10px; color: #bbb;">365extra Heritage © 2026. All Rights Reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateInvoiceHTML
};

