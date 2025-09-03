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
const silverPriceService = require("../services/silver-price.service");

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
  
  if (!data.silverWeight || isNaN(parseFloat(data.silverWeight))) {
    errors.push("Valid silver weight is required");
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
  
  if (data.laborPercentage && isNaN(parseFloat(data.laborPercentage))) {
    errors.push("Labor percentage must be a valid number");
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

  // Calculate dynamic price if silver weight is provided
  let calculatedPrice = 0;
  let priceBreakdown = {};
  
  if (data.silverWeight && parseFloat(data.silverWeight) > 0) {
    try {
      const priceCalc = await silverPriceService.calculateDynamicPrice(
        parseFloat(data.silverWeight),
        parseFloat(data.laborPercentage) || 0,
        parseFloat(data.gst) || 18
      );
      calculatedPrice = priceCalc.finalPrice;
      priceBreakdown = priceCalc.breakdown;
    } catch (error) {
      console.warn("Could not calculate dynamic price:", error.message);
    }
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
    
    // Jewelry specific fields
    silverWeight: parseFloat(data.silverWeight) || 0,
    laborPercentage: parseFloat(data.laborPercentage) || 0,
    isDynamicPricing: data.isDynamicPricing === 'true' || data.isDynamicPricing === true,
    staticPrice: parseFloat(data.staticPrice) || 0,
    metalPurity: data.metalPurity || '925',
    makingCharges: parseFloat(data.makingCharges) || 0,
    priceBreakdown: Object.keys(priceBreakdown).length > 0 ? {
      ...priceBreakdown,
      lastCalculated: new Date()
    } : undefined,
    
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
        productTitle: "Silver Ring with Gemstone",
        skuNo: "SR001",
        category: "Rings",
        brand: "Artisan Silver",
        regularPrice: 2500,
        salePrice: 2000,
        productDescription: "Beautiful handcrafted silver ring with natural gemstone",
        careHandling: "Clean with soft cloth, avoid chemicals",
        silverWeight: 5.5,
        laborPercentage: 20,
        isDynamicPricing: true,
        staticPrice: 0,
        metalPurity: "925",
        makingCharges: 100,
        gst: 18,
        variants: "Small:2000,Medium:2200,Large:2400",
        isActive: true
      },
      {
        productTitle: "Silver Necklace Chain",
        skuNo: "SN001",
        category: "Necklaces",
        brand: "Artisan Silver",
        regularPrice: 5000,
        salePrice: 4500,
        productDescription: "Elegant silver chain necklace",
        careHandling: "Store in dry place, clean regularly",
        silverWeight: 12.0,
        laborPercentage: 25,
        isDynamicPricing: true,
        staticPrice: 0,
        metalPurity: "925",
        makingCharges: 200,
        gst: 18,
        variants: "16inch:4500,18inch:5000,20inch:5500",
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
      .select("productTitle skuNo createdAt isActive silverWeight");

    successRes(res, {
      uploads: recentProducts.map(product => ({
        id: product._id,
        productTitle: product.productTitle,
        skuNo: product.skuNo,
        category: product.category?.name,
        brand: product.brand?.brand_name,
        silverWeight: product.silverWeight,
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
