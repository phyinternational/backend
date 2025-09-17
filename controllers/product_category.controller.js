const mongoose = require("mongoose");
const { errorRes, internalServerError, successRes } = require("../utility");
const {
  uploadOnCloudinary,
  deleteFromCloudinary,
} = require("../middlewares/Cloudinary");
const ProductCategory = require("../models/product_category.model");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const Product = require("../models/product.model");
const getAllNestedSubcategories = require("../utility/utils");

module.exports.addProductCategory_post = catchAsync(async (req, res) => {
  const { type, name, slug, parentId = null } = req.body;
  let imageUrl = req.body.imageUrl;

  // Handle image upload if file is present
  if (req.file) {
    imageUrl = await uploadOnCloudinary(req.file);
  }

  if (!type || !name || !imageUrl || !slug) {
    return errorRes(res, 400, "All fields are required.");
  }

  const existingCategory = await ProductCategory.findOne({
    slug: slug,
  });

  if (existingCategory) {
    return errorRes(res, 400, "Category with given Slug already exists.");
  }
  // Fix: Convert empty string parentId to null to avoid MongoDB ObjectId casting errors
  const finalParentId = parentId === "" ? null : parentId;

  const category = new ProductCategory({
    type,
    name,
    imageUrl,
    slug,
    parentId: finalParentId,
  });
  const savedCategory = await category.save();

  const {
    type: savedType,
    name: savedName,
    imageUrl: savedImageUrl,
    _id,
  } = savedCategory;

  return successRes(res, {
    product_category: {
      _id,
      type: savedType,
      name: savedName,
      imageUrl: savedImageUrl,
    },
    message: "Category added successfully.",
  });
});

module.exports.addSubCategory_post = catchAsync(async (req, res) => {
  const { name, slug, parentId } = req.body;
  let imageUrl = req.body.imageUrl;

  // Handle image upload if file is present
  if (req.file) {
    imageUrl = await uploadOnCloudinary(req.file);
  }

  if (!name || !parentId) {
    return errorRes(res, 400, "All fields are required.");
  }

  const existingCategory = await ProductCategory.findOne({
    slug: slug,
  });

  if (existingCategory) {
    return errorRes(res, 400, "Category with given name already exists.");
  }

  const category = new ProductCategory({ name, slug, parentId, imageUrl });
  const savedCategory = await category.save();

  const { name: savedName, parentId: savedParentId, _id } = savedCategory;

  return successRes(res, {
    product_category: {
      _id,
      name: savedName,
      parentId: savedParentId,
    },
    message: "Sub-category added successfully.",
  });
});

module.exports.allCategory_get = catchAsync(async (req, res) => {
  const categories = await ProductCategory.find()
    .sort({ createdAt: 1 })
    .select("-__v");
  return successRes(res, {
    categories,
  });
});

module.exports.getSubCategory_get = catchAsync(async (req, res) => {
  const { parentId } = req.params;
  if (!parentId) {
    return errorRes(res, 400, "Parent ID is required.");
  }
  const subCategories = await ProductCategory.find({ parentId });
  return successRes(res, {
    subCategories,
  });
});

module.exports.deleteProductCategory_delete = async (req, res) => {
  const { categoryId } = req.params;

  if (!categoryId) return errorRes(res, 400, "Category ID is required.");
  const product_C = await ProductCategory.findById({ _id: categoryId });
  if (!product_C) return errorRes(res, 400, "Category does not exist.");

  await deleteFromCloudinary(product_C.displayImage.url);
  ProductCategory.findByIdAndDelete(categoryId)
    .then((deletedCategory) => {
      if (!deletedCategory)
        return errorRes(res, 400, "Category does not exist.");
      else
        return successRes(res, {
          deletedCategory,
          message: "Category deleted successfully.",
        });
    })
    .catch((err) => console.log(err));
};
module.exports.editCategory = catchAsync(async (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;
  let imageUrl = req.body.imageUrl;
  if (!categoryId) return errorRes(res, 400, "Category ID is required.");
  if (!name) return errorRes(res, 400, "Category name is required.");
  const category = await ProductCategory.findById(categoryId);
  if (!category) return errorRes(res, 400, "Category does not exist.");

  // Handle image upload if file is present
  if (req.file) {
    imageUrl = await uploadOnCloudinary(req.file);
  }

  category.name = name;
  if (imageUrl) category.imageUrl = imageUrl;

  const updatedCategory = await category.save();
  return successRes(res, {
    updatedCategory,
    message: "Category updated successfully.",
  });
});

module.exports.getSingleCategory_get = async (req, res) => {
  try {
    const { id } = req.params;
    const find = await ProductCategory.findById(id);
    if (!find) {
      return errorRes(res, 404, "Category is Not Found.");
    }
    successRes(res, find);
  } catch (error) {
    internalServerError(res, error.message);
  }
};

module.exports.getCategoryProducts_get = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const search = req.query.search;
  const find = await ProductCategory.findOne({ slug });
  if (!find) {
    return errorRes(res, 404, "Category is Not Found.");
  }
  const filter = {};

  const categoryId = find._id;
  console.log(categoryId);
  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    const categories = await getAllNestedSubcategories(categoryId);
    categories.push(categoryId);
    filter.category = { $in: categories };
  }

  const products = await buildPaginatedSortedFilteredQuery(
    Product.find(filter)
      .sort("-createdAt")
      .populate("category", "_id name description displayImage"),
    req,
    Product
  );

  successRes(res, {
    products: products,
    totalPage: Math.ceil(products.total / products.limit),
    currentPage: products.page,
    limit: products.limit,
  });
});

module.exports.getAllSubcategories = catchAsync(async (req, res) => {
  // Find all categories that have a parentId (i.e., subcategories)
  const subcategories = await ProductCategory.find({ parentId: { $ne: null } }).sort({ createdAt: 1 });
  return successRes(res, { subcategories });
});

module.exports.getASubcategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) return errorRes(res, 400, "Subcategory ID is required.");
  const subcategory = await ProductCategory.findOne({ _id: id, parentId: { $ne: null } });
  if (!subcategory) return errorRes(res, 404, "Subcategory not found.");
  return successRes(res, { subcategory });
});
