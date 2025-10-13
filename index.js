require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");

// Security and performance middleware
const { apiLimiter, speedLimiter } = require("./middlewares/rateLimiter");
const { sanitizeInput } = require("./middlewares/validation");
const cacheService = require("./services/cache.service");

require("./models/admin.model");
require("./models/cart.model");
require("./models/user.model");
require("./models/notification.model");
require("./models/blog.model");
require("./models/coupon.model");
require("./models/product_category.model");
require("./models/product_color.model");
require("./models/product.model");
require("./models/order.model");
require("./models/FAQ.model");
require("./models/banner.model");
require("./models/site_trending_product.model");
require("./models/brand-model").default;

// Import new models
require("./models/guest-order.model");
require("./models/loyalty-program.model");
require("./models/user-loyalty.model");
require("./models/inventory.model");

const auth_routes = require("./routes/auth.routes");
const product_category_routes = require("./routes/product_category.routes");
const product_color_routes = require("./routes/product_color.routes");
const product_routes = require("./routes/product.routes");
const productrating_routes = require("./routes/product-rating.routes");
const user_routes = require("./routes/user.routes");
const user_cart_routes = require("./routes/cart.routes");
const brand_routes = require("./routes/brand.route");
const blog_routes = require("./routes/blog.routes");
const coupon_routes = require("./routes/coupon.routes");
const faq_routes = require("./routes/FAQ.routes");
const user_order_routes = require("./routes/order.routes");
const banner_routes = require("./routes/banner.routes");
const site_trending_product_routes = require("./routes/site_trending_product.routes");
const product_varient_routes = require("./routes/product_varient.routes");
const tnc_routes = require("./routes/tnc.routes");
const notification_routes = require("./routes/notification.routes");

// Import new routes
const guest_checkout_routes = require("./routes/guest-checkout.routes");
const loyalty_routes = require("./routes/loyalty.routes");
const bulk_upload_routes = require("./routes/bulk-upload.routes");
const stripe_payment_routes = require("./routes/stripe-payment.routes");
const inventory_routes = require("./routes/inventory.routes");
const otp_routes = require("./routes/otp.routes");

const passport = require("./utility/passport");
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.set("strictQuery", true);
mongoose.connect(MONGO_URI);
const database = mongoose.connection;

database.on("error", (err) => console.log(err, "Error connecting db."));
database.once("connected", () => {
  console.log("Database Connected.");
  
  // Initialize cache service
  cacheService.init().then(() => {
    console.log("Cache service initialized.");
  }).catch((error) => {
    console.warn("Cache service initialization failed:", error.message);
  });
  
});

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting and speed control
app.use(apiLimiter);
app.use(speedLimiter);

// Input sanitization
app.use(sanitizeInput);

app.use(express.json({ extended: true, limit: '10mb' }));

app.set('trust proxy', 1);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Raajsi backend server is running" });
});

const corsOptions = {
  origin: [
    "https://raajsi-frontend.vercel.app",
    "https://raajsi.in",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
  ],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(auth_routes);
app.use(productrating_routes);
app.use(product_category_routes);
app.use(product_color_routes);
app.use(brand_routes);
app.use(product_routes);
app.use(user_routes);
app.use(user_cart_routes);
app.use(notification_routes);
app.use(user_order_routes);
app.use(blog_routes);
app.use(coupon_routes);
app.use(faq_routes);
app.use(banner_routes);
app.use(site_trending_product_routes);
app.use(product_varient_routes);
app.use(tnc_routes);

// Use new routes
app.use(guest_checkout_routes);
app.use(loyalty_routes);
app.use(bulk_upload_routes);
app.use(stripe_payment_routes);
app.use(inventory_routes);
app.use(otp_routes);
//wrong routes
app.all("/", (req, res) => {
  res.status(400).end();
});

const errorHandler = (err, req, res, next) => {
  // If headers have already been sent, delegate to the default Express error handler
  if (res.headersSent) {
    console.warn('Error handler invoked but headers already sent. Delegating to next error handler.');
    return next(err);
  }

  if (err && err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Unauthorized!" });
  }
  console.error(err, "Error");
  return res.status(500).json({ error: "Internal Error!" });
};

app.use(errorHandler);

// Export the Express app for Vercel
module.exports = app;
