const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productTitle: { type: String, required: true, minlength: 3 },
  productSlug: {
    type: String,
    required: true,
    minlength: 1,
    unique: true,
    index: true,
  },
  skuNo: { type: String, required: true, minlength: 1, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory" },
  regularPrice: { type: Number, required: true, default: 0 },
  salePrice: { type: Number, required: true, default: 0 },
  isActive: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  productDescription: {
    type: String,
    required: true,
    minlength: 1,
    default: "NA",
  },
  careHandling: { type: String, required: true, minlength: 1, default: "NA" },
  gst: { type: Number, default: 18 }, // Updated default GST for jewelry
  productImageUrl: [{
    type: String,
    optional: true
  }],
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },

  // NEW FIELDS
  ingredients: { 
    type: String, 
    default: "",
    maxlength: 2000,
    trim: true
  },
  benefits: { 
    type: String, 
    default: "",
    maxlength: 2000,
    trim: true
  },
  shlok: {
    shlokText: {
      type: String,
      default: "",
      maxlength: 500,
      trim: true
    },
    shlokMeaning: {
      type: String,
      default: "",
      maxlength: 1000,
      trim: true
    }
  },
  amazonLink: { 
    type: String, 
    default: "",
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty strings or valid URLs
        if (!v || v === "") return true;
        // Basic URL validation - should start with http:// or https://
        return /^https?:\/\/.+/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  }
});

// Create the model
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
