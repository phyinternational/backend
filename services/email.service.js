const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.Gmail,
        pass: process.env.Gmailpass,
      },
    });
  }

  async sendMail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: process.env.Gmail,
        to,
        subject,
        html,
        text,
      };
      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to} - ${subject}`);
    } catch (err) {
      console.error('Error sending email to', to, err);
    }
  }

  async sendGuestOrderConfirmation(guestOrder) {
    try {
      const accountCreationLink = `${process.env.CLIENT_URL}/create-account?token=${guestOrder.conversionToken}`;
      const html = `
        <h2>Thank you for your order!</h2>
        <p>Dear ${guestOrder.guestInfo.firstName || ''},</p>
        <p>Your order has been placed successfully.</p>
        <p><strong>Order ID:</strong> ${guestOrder._id}</p>
        <p><strong>Total Amount:</strong> ₹${guestOrder.orderTotal?.finalAmount || ''}</p>
        <p><strong>Create an account to track your order and earn loyalty points:</strong></p>
        <a href="${accountCreationLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Create Account</a>
        <p>This link will expire in 7 days.</p>
        <p>Thank you for shopping with us!</p>
      `;

      await this.sendMail({
        to: guestOrder.guestInfo.email,
        subject: `Order Confirmation - ${guestOrder._id}`,
        html,
      });
    } catch (err) {
      console.error('sendGuestOrderConfirmation error', err);
    }
  }

  async sendOrderConfirmation(order, user) {
    try {
      // order may be populated or not. Try to extract email
      const email = (user && user.email) || order?.buyer?.email || order?.buyerEmail;

      const productList = (order.products || [])
        .map((p) => `- ${p.product?.displayName || p.product || ''} x ${p.quantity}`)
        .join('<br/>');

      const html = `
        <h2>Order Confirmation</h2>
        <p>Hi ${user?.name || order?.buyer?.displayName || ''},</p>
        <p>Thank you for your purchase. Your order has been placed successfully.</p>
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Amount:</strong> ₹${order.order_price || order.orderTotal?.finalAmount || ''}</p>
        <p><strong>Items:</strong><br/>${productList}</p>
        <p>We will notify you when your order ships.</p>
      `;

      if (!email) {
        console.warn('No recipient email found for order', order._id);
        return;
      }

      await this.sendMail({
        to: email,
        subject: `Order Confirmation - ${order._id}`,
        html,
      });
    } catch (err) {
      console.error('sendOrderConfirmation error', err);
    }
  }
}

module.exports = new EmailService();
