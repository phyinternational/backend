const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

class InvoiceService {
  
  // Generate PDF invoice for an order
  static async generateInvoice(order, user) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        
        // Create filename
        const fileName = `invoice-${order._id}-${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../temp', fileName);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(filePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Pipe document to file
        doc.pipe(fs.createWriteStream(filePath));
        
        // Add company header
        this.addHeader(doc);
        
        // Add invoice details
        this.addInvoiceDetails(doc, order, user);
        
        // Add customer details
        this.addCustomerDetails(doc, user, order.shippingAddress);
        
        // Add order items table
        this.addOrderItemsTable(doc, order);
        
        // Add totals
        this.addTotals(doc, order);
        
        // Add footer
        this.addFooter(doc);
        
        // Finalize the PDF
        doc.end();
        
        doc.on('end', () => {
          resolve({ filePath, fileName });
        });
        
        doc.on('error', (error) => {
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Add company header
  static addHeader(doc) {
    doc.fontSize(20)
       .text('JEWELRY STORE', 50, 50)
       .fontSize(10)
       .text('Premium Silver Jewelry', 50, 75)
       .text('123 Jewelry Street, City, State 12345', 50, 90)
       .text('Phone: +91 12345 67890 | Email: info@jewelrystore.com', 50, 105)
       .text('GST: 12ABCDE3456F7G8', 50, 120);
    
    // Add logo space (you can add actual logo here)
    doc.rect(450, 50, 100, 70).stroke();
    doc.fontSize(8).text('LOGO', 485, 80);
    
    // Add invoice title
    doc.fontSize(16)
       .text('INVOICE', 50, 160, { underline: true });
  }
  
  // Add invoice details
  static addInvoiceDetails(doc, order, user) {
    const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN');
    
    doc.fontSize(10)
       .text(`Invoice #: INV-${order._id.toString().substring(0, 8).toUpperCase()}`, 50, 190)
       .text(`Date: ${invoiceDate}`, 50, 205)
       .text(`Order ID: ${order._id}`, 50, 220)
       .text(`Payment Status: ${order.payment_status}`, 50, 235)
       .text(`Order Status: ${order.order_status}`, 50, 250);
  }
  
  // Add customer details
  static addCustomerDetails(doc, user, shippingAddress) {
    doc.fontSize(12)
       .text('Bill To:', 300, 190, { underline: true })
       .fontSize(10)
       .text(`${user.name}`, 300, 210)
       .text(`${user.email}`, 300, 225)
       .text(`${user.phoneNumber}`, 300, 240);
    
    if (shippingAddress) {
      doc.text('Ship To:', 300, 265, { underline: true })
         .text(`${shippingAddress.address}`, 300, 285)
         .text(`Pincode: ${shippingAddress.pincode}`, 300, 300);
    }
  }
  
  // Add order items table
  static addOrderItemsTable(doc, order) {
    const tableTop = 340;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 300;
    const priceX = 350;
    const amountX = 450;
    
    // Table headers
    doc.fontSize(10)
       .text('Item', itemCodeX, tableTop, { underline: true })
       .text('Description', descriptionX, tableTop, { underline: true })
       .text('Qty', quantityX, tableTop, { underline: true })
       .text('Price (₹)', priceX, tableTop, { underline: true })
       .text('Amount (₹)', amountX, tableTop, { underline: true });
    
    // Draw line under headers
    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();
    
    let currentY = tableTop + 25;
    let totalAmount = 0;
    
    // Add order items
    order.products.forEach((item, index) => {
      const product = item.product;
      const itemTotal = item.price * item.quantity;
      totalAmount += itemTotal;
      
      doc.text(`${index + 1}`, itemCodeX, currentY)
         .text(`${product.productTitle || product.displayName || 'Product'}`, descriptionX, currentY, { width: 140 })
         .text(`${item.quantity}`, quantityX, currentY)
         .text(`${item.price.toFixed(2)}`, priceX, currentY)
         .text(`${itemTotal.toFixed(2)}`, amountX, currentY);
      
      // Add price breakdown if available
      if (product.priceBreakdown) {
        currentY += 15;
        doc.fontSize(8)
           .text(`Silver: ₹${product.priceBreakdown.silverCost || 0}`, descriptionX, currentY)
           .text(`Labor: ₹${product.priceBreakdown.laborCost || 0}`, descriptionX + 80, currentY)
           .fontSize(10);
      }
      
      currentY += 20;
    });
    
    return { currentY, totalAmount };
  }
  
  // Add totals section
  static addTotals(doc, order) {
    const totalsY = 450;
    
    // Parse order price (it might be a string)
    const orderTotal = parseFloat(order.order_price) || parseFloat(order.orderTotal?.finalAmount) || 0;
    const gstAmount = orderTotal * 0.18 / 1.18; // Assuming 18% GST included
    const subtotal = orderTotal - gstAmount;
    
    doc.fontSize(10)
       .text('Subtotal:', 400, totalsY)
       .text(`₹${subtotal.toFixed(2)}`, 480, totalsY)
       .text('GST (18%):', 400, totalsY + 15)
       .text(`₹${gstAmount.toFixed(2)}`, 480, totalsY + 15)
       .fontSize(12)
       .text('Total:', 400, totalsY + 35, { underline: true })
       .text(`₹${orderTotal.toFixed(2)}`, 480, totalsY + 35, { underline: true });
    
    // Draw line above total
    doc.moveTo(400, totalsY + 30)
       .lineTo(550, totalsY + 30)
       .stroke();
  }
  
  // Add footer
  static addFooter(doc) {
    doc.fontSize(8)
       .text('Terms & Conditions:', 50, 550)
       .text('1. All jewelry is hallmarked and certified.', 50, 565)
       .text('2. Returns accepted within 7 days of delivery.', 50, 580)
       .text('3. GST is included in the price.', 50, 595)
       .text('Thank you for your business!', 50, 620, { align: 'center' });
  }
}

module.exports = InvoiceService;
