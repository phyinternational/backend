const XLSX = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const Product = require("../models/product.model");
const ProductVariant = require("../models/product_varient");
const { Product_Color } = require("../models/product_color.model");
const ProductCategory = require("../models/product_category.model");
const Brand = require("../models/brand-model");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

// Bulk upload products from CSV/Excel
module.exports.bulkUploadProducts = catchAsync(async (req, res) => {
  try {
    if (!req.file) {
      return errorRes(res, 400, "Please upload a CSV or Excel file");
    }

    const filePath = req.file.path;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    let products = [];

    if (fileExtension === 'csv') {
      products = await parseCSV(filePath);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      products = await parseExcel(filePath);
    } else {
      return errorRes(res, 400, "Unsupported file format. Please upload CSV or Excel file");
    }

    // Validate and process products
    const results = await processProducts(products);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    successRes(res, {
      results,
      message: "Bulk upload completed"
    });

  } catch (error) {
    console.error("Error in bulk upload:", error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    
    internalServerError(res, "Error processing bulk upload");
  }
});

// Parse CSV file
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const products = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        products.push(row);
      })
      .on('end', () => {
        resolve(products);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Parse Excel file
async function parseExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const products = XLSX.utils.sheet_to_json(worksheet);
    
    return products;
  } catch (error) {
    throw new Error("Error parsing Excel file: " + error.message);
  }
}

// Process and validate products
async function processProducts(products) {
  const results = {
    total: products.length,
    successful: 0,
    failed: 0,
    errors: [],
    createdProducts: []
  };

  for (let i = 0; i < products.length; i++) {
    const productData = products[i];
    
    try {
      // Validate required fields
      const validation = validateProductData(productData, i + 1);
      if (!validation.isValid) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          errors: validation.errors
        });
        continue;
      }

      // Process the product
      const createdProduct = await createProductFromData(productData);
      
      results.successful++;
      results.createdProducts.push({
        row: i + 1,
        productId: createdProduct._id,
        productTitle: createdProduct.productTitle
      });

    } catch (error) {
      results.failed++;
      results.errors.push({
        row: i + 1,
        errors: [error.message]
      });
    }
  }

  return results;
}

// Validate product data
function validateProductData(data, rowNumber) {
  const errors = [];
  
  // Required fields
  if (!data.productTitle || data.productTitle.trim() === '') {
    errors.push("Product title is required");
  }
  
  if (!data.skuNo || data.skuNo.trim() === '') {
    errors.push("SKU number is required");
  }
  
  if (!data.category || data.category.trim() === '') {
    errors.push("Category is required");
  }

  // Numeric validations
  if (data.regularPrice && isNaN(parseFloat(data.regularPrice))) {
    errors.push("Regular price must be a valid number");
  }
  
  if (data.salePrice && isNaN(parseFloat(data.salePrice))) {
    errors.push("Sale price must be a valid number");
  }
  

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Create product from data
async function createProductFromData(data) {
  // Find or create category
  let category = await ProductCategory.findOne({ 
    name: { $regex: new RegExp(`^${data.category}$`, 'i') }
  });
  
  if (!category) {
    category = new ProductCategory({
      name: data.category,
      description: `Auto-created category for ${data.category}`
    });
    await category.save();
  }

  // Find or create brand if provided
  let brand = null;
  if (data.brand && data.brand.trim() !== '') {
    brand = await Brand.findOne({ 
      brand_name: { $regex: new RegExp(`^${data.brand}$`, 'i') }
    });
    
    if (!brand) {
      brand = new Brand({
        brand_name: data.brand
      });
      await brand.save();
    }
  }

  // Generate unique slug from title and SKU
  const baseSlug = `${data.productTitle}-${data.skuNo}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  let productSlug = baseSlug;
  let slugCounter = 1;
  
  while (await Product.findOne({ productSlug })) {
    productSlug = `${baseSlug}-${slugCounter}`;
    slugCounter++;
  }

  // Create product
  const product = new Product({
    productTitle: data.productTitle.trim(),
    productSlug,
    skuNo: data.skuNo.trim(),
    category: category._id,
    brand: brand ? brand._id : undefined,
    regularPrice: parseFloat(data.regularPrice) || calculatedPrice || 0,
    salePrice: parseFloat(data.salePrice) || calculatedPrice || 0,
    productDescription: data.productDescription || "No description provided",
    careHandling: data.careHandling || "Standard care instructions",
    gst: parseFloat(data.gst) || 18,
    
    
    isActive: data.isActive === 'true' || data.isActive === true || true // Default to active
  });

  const savedProduct = await product.save();

  // Create variants if provided
  if (data.variants && data.variants.trim() !== '') {
    await createProductVariants(savedProduct._id, data.variants, data);
  }

  return savedProduct;
}

// Create product variants
async function createProductVariants(productId, variantsString, productData) {
  try {
    // Parse variants string (format: "size1:price1,size2:price2" or JSON)
    let variants = [];
    
    if (variantsString.startsWith('[') || variantsString.startsWith('{')) {
      // JSON format
      variants = JSON.parse(variantsString);
    } else {
      // Simple format: "Small:1000,Medium:1200,Large:1400"
      const variantPairs = variantsString.split(',');
      variants = variantPairs.map(pair => {
        const [size, price] = pair.split(':');
        return {
          size: size.trim(),
          price: parseFloat(price.trim()) || 0,
          stock: 10 // Default stock
        };
      });
    }

    // Create variants
    for (const variantData of variants) {
      const variant = new ProductVariant({
        productId,
        size: variantData.size,
        price: variantData.price || productData.salePrice || 0,
        salePrice: variantData.salePrice || variantData.price || productData.salePrice || 0,
        stock: variantData.stock || 10,
        isActive: true
      });
      
      await variant.save();
    }
  } catch (error) {
    console.warn("Error creating variants:", error.message);
  }
}

// Download sample CSV template
module.exports.downloadSampleTemplate = catchAsync(async (req, res) => {
  try {
    const sampleData = [
      {
      productTitle: "Hydrating Facial Cleanser",
      skuNo: "SKC001",
      category: "Cleansers",
      brand: "PureGlow",
      regularPrice: 699,
      salePrice: 599,
      productDescription: "Gentle foaming cleanser that removes impurities while retaining moisture.",
      careHandling: "Store in a cool, dry place. Avoid contact with eyes.",
      gst: 18,
      variants: "50ml:599,100ml:999",
      isActive: true
      },
      {
      productTitle: "Vitamin C Brightening Serum",
      skuNo: "SKS001",
      category: "Serums",
      brand: "PureGlow",
      regularPrice: 1299,
      salePrice: 1099,
      productDescription: "Concentrated vitamin C serum to brighten skin and reduce dark spots.",
      careHandling: "Keep refrigerated after opening for best results. Use sunscreen during day.",
      gst: 18,
      variants: "30ml:1099,50ml:1699",
      isActive: true
      },
      {
      productTitle: "SPF 50 Daily Moisturizer",
      skuNo: "SKM001",
      category: "Moisturizers",
      brand: "SkinShield",
      regularPrice: 899,
      salePrice: 799,
      productDescription: "Lightweight daily moisturizer with broad-spectrum SPF 50 protection.",
      careHandling: "Apply generously 15 minutes before sun exposure. Reapply as needed.",
      gst: 18,
      variants: "40ml:799,75ml:1299",
      isActive: true
      }
    ];

    // Convert to CSV format
    const csvHeaders = Object.keys(sampleData[0]).join(',');
    const csvRows = sampleData.map(row => Object.values(row).join(','));
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product_upload_template.csv"');
    res.send(csvContent);

  } catch (error) {
    console.error("Error generating template:", error);
    internalServerError(res, "Error generating template");
  }
});

// Get upload history/status
module.exports.getUploadHistory = catchAsync(async (req, res) => {
  try {
    // This would typically come from a separate upload history model
    // For now, we'll return recent products as a placeholder
    
    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("category", "name")
      .populate("brand", "brand_name")
      .select("productTitle skuNo createdAt isActive");

    successRes(res, {
      uploads: recentProducts.map(product => ({
        id: product._id,
        productTitle: product.productTitle,
        skuNo: product.skuNo,
        category: product.category?.name,
        brand: product.brand?.brand_name,
        isActive: product.isActive,
        uploadedAt: product.createdAt
      })),
      message: "Upload history retrieved successfully"
    });

  } catch (error) {
    console.error("Error getting upload history:", error);
    internalServerError(res, "Error retrieving upload history");
  }
});
