const mongoose = require("mongoose");

const subcategorySchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, "Subcategory name is required"],
    trim: true,
    maxlength: [100, "Name cannot be more than 100 characters"]
  },
  slug: {
    type: String,
    required: [true, "Slug is required"],
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, "Description cannot be more than 500 characters"]
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductCategory",
    required: [true, "Parent category is required"]
  },
  imageUrl: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  seoTitle: {
    type: String,
    maxlength: [60, "SEO title cannot be more than 60 characters"]
  },
  seoDescription: {
    type: String,
    maxlength: [160, "SEO description cannot be more than 160 characters"]
  },
  productCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
subcategorySchema.index({ slug: 1 });
subcategorySchema.index({ parentCategory: 1 });
subcategorySchema.index({ isActive: 1 });
subcategorySchema.index({ sortOrder: 1 });

// Virtual for getting products in this subcategory
subcategorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'subcategory'
});

// Method to update product count
subcategorySchema.methods.updateProductCount = async function() {
  const Product = require('./product.model');
  this.productCount = await Product.countDocuments({ subcategory: this._id });
  return this.save();
};

// Pre-save middleware to generate slug if not provided
subcategorySchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

const Subcategory = mongoose.model("Subcategory", subcategorySchema);
module.exports = Subcategory;