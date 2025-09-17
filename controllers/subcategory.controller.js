const mongoose = require("mongoose");
const Subcategory = require("../models/subcategory");
const ProductCategory = require("../models/product_category.model");
const Product = require("../models/product.model");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");

// Test endpoint
module.exports.test = catchAsync(async (req, res) => {
  successRes(res, {
    message: "Subcategory routes are working!",
    timestamp: new Date(),
    version: "1.0.0"
  });
});

// Add new subcategory
module.exports.addSubCategory = catchAsync(async (req, res) => {
  const { name, slug, description, parentCategory, imageUrl, seoTitle, seoDescription, sortOrder } = req.body;

  // Validation
  if (!name || !parentCategory) {
    return errorRes(res, 400, "Name and parent category are required");
  }

  // Validate parent category exists
  const parentExists = await ProductCategory.findById(parentCategory);
  if (!parentExists) {
    return errorRes(res, 400, "Parent category does not exist");
  }

  // Check if subcategory with same slug exists
  if (slug) {
    const existingSubcategory = await Subcategory.findOne({ slug });
    if (existingSubcategory) {
      return errorRes(res, 400, "Subcategory with this slug already exists");
    }
  }

  // Create subcategory
  const subcategory = new Subcategory({
    name: name.trim(),
    slug,
    description,
    parentCategory,
    imageUrl,
    seoTitle,
    seoDescription,
    sortOrder: sortOrder || 0
  });

  const savedSubcategory = await subcategory.save();
  await savedSubcategory.populate('parentCategory', 'name slug');

  successRes(res, {
    subcategory: savedSubcategory,
    message: "Subcategory created successfully"
  });
});

// Get all subcategories
module.exports.getAllSubCategory = catchAsync(async (req, res) => {
  const { parentCategory, isActive, search } = req.query;
  
  const filter = {};
  
  // Filter by parent category
  if (parentCategory && mongoose.Types.ObjectId.isValid(parentCategory)) {
    filter.parentCategory = parentCategory;
  }
  
  // Filter by active status
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  
  // Search by name
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const subcategories = await buildPaginatedSortedFilteredQuery(
    Subcategory.find(filter)
      .populate('parentCategory', 'name slug type')
      .sort({ sortOrder: 1, createdAt: -1 }),
    req,
    Subcategory
  );

  successRes(res, {
    subcategories: subcategories.data || subcategories,
    pagination: {
      total: subcategories.total,
      page: subcategories.page,
      limit: subcategories.limit,
      totalPages: subcategories.pages
    },
    message: "Subcategories retrieved successfully"
  });
});

// Get single subcategory
module.exports.getASubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid subcategory ID");
  }

  const subcategory = await Subcategory.findById(id)
    .populate('parentCategory', 'name slug type imageUrl')
    .populate({
      path: 'products',
      select: 'displayName price salePrice availability displayImage',
      match: { isActive: true },
      options: { limit: 10 }
    });

  if (!subcategory) {
    return errorRes(res, 404, "Subcategory not found");
  }

  // Update product count
  await subcategory.updateProductCount();

  successRes(res, {
    subcategory,
    message: "Subcategory retrieved successfully"
  });
});

// Update subcategory
module.exports.updateSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, slug, description, parentCategory, imageUrl, isActive, seoTitle, seoDescription, sortOrder } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid subcategory ID");
  }

  const subcategory = await Subcategory.findById(id);
  if (!subcategory) {
    return errorRes(res, 404, "Subcategory not found");
  }

  // Validate parent category if being updated
  if (parentCategory && parentCategory !== subcategory.parentCategory.toString()) {
    const parentExists = await ProductCategory.findById(parentCategory);
    if (!parentExists) {
      return errorRes(res, 400, "Parent category does not exist");
    }
  }

  // Check slug uniqueness if being updated
  if (slug && slug !== subcategory.slug) {
    const existingSubcategory = await Subcategory.findOne({ slug, _id: { $ne: id } });
    if (existingSubcategory) {
      return errorRes(res, 400, "Subcategory with this slug already exists");
    }
  }

  // Update fields
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (slug) updateData.slug = slug;
  if (description !== undefined) updateData.description = description;
  if (parentCategory) updateData.parentCategory = parentCategory;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
  if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

  const updatedSubcategory = await Subcategory.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('parentCategory', 'name slug type');

  successRes(res, {
    subcategory: updatedSubcategory,
    message: "Subcategory updated successfully"
  });
});

// Delete subcategory
module.exports.deleteSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid subcategory ID");
  }

  const subcategory = await Subcategory.findById(id);
  if (!subcategory) {
    return errorRes(res, 404, "Subcategory not found");
  }

  // Check if subcategory has products
  const productCount = await Product.countDocuments({ subcategory: id });
  if (productCount > 0) {
    return errorRes(res, 400, `Cannot delete subcategory. It has ${productCount} products. Please move or delete products first.`);
  }

  await Subcategory.findByIdAndDelete(id);

  successRes(res, {
    deletedSubcategory: subcategory,
    message: "Subcategory deleted successfully"
  });
});

// Get subcategories by parent category
module.exports.getSubcategoriesByParent = catchAsync(async (req, res) => {
  const { parentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    return errorRes(res, 400, "Invalid parent category ID");
  }

  const subcategories = await Subcategory.find({ 
    parentCategory: parentId, 
    isActive: true 
  })
  .sort({ sortOrder: 1, name: 1 })
  .select('name slug description imageUrl productCount');

  successRes(res, {
    subcategories,
    count: subcategories.length,
    message: "Subcategories retrieved successfully"
  });
});

// Get subcategory products
module.exports.getSubcategoryProducts = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid subcategory ID");
  }

  const subcategory = await Subcategory.findById(id);
  if (!subcategory) {
    return errorRes(res, 404, "Subcategory not found");
  }

  const filter = { subcategory: id, isActive: true };
  
  const products = await buildPaginatedSortedFilteredQuery(
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .sort({ createdAt: -1 }),
    req,
    Product
  );

  successRes(res, {
    subcategory: {
      _id: subcategory._id,
      name: subcategory.name,
      slug: subcategory.slug
    },
    products: products.data || products,
    pagination: {
      total: products.total,
      page: products.page,
      limit: products.limit,
      totalPages: products.pages
    },
    message: "Subcategory products retrieved successfully"
  });
});

// Bulk update subcategory sort order
module.exports.updateSortOrder = catchAsync(async (req, res) => {
  const { subcategories } = req.body; // Array of { id, sortOrder }

  if (!Array.isArray(subcategories) || subcategories.length === 0) {
    return errorRes(res, 400, "Subcategories array is required");
  }

  const updatePromises = subcategories.map(item => {
    if (!mongoose.Types.ObjectId.isValid(item.id)) {
      throw new Error(`Invalid subcategory ID: ${item.id}`);
    }
    return Subcategory.findByIdAndUpdate(
      item.id,
      { sortOrder: item.sortOrder },
      { new: true }
    );
  });

  const updatedSubcategories = await Promise.all(updatePromises);

  successRes(res, {
    updatedSubcategories,
    message: "Sort order updated successfully"
  });
});

// Toggle subcategory active status
module.exports.toggleActiveStatus = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid subcategory ID");
  }

  const subcategory = await Subcategory.findById(id);
  if (!subcategory) {
    return errorRes(res, 404, "Subcategory not found");
  }

  subcategory.isActive = !subcategory.isActive;
  await subcategory.save();

  successRes(res, {
    subcategory,
    message: `Subcategory ${subcategory.isActive ? 'activated' : 'deactivated'} successfully`
  });
});