const mongoose = require("mongoose");
const asynchandler = require("express-async-handler");
const {
  errorRes,
  internalServerError,
  successRes,
  shortIdChar,
} = require("../utility");
const shortid = require("shortid");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const Product = require("../models/product.model");
const getAllNestedSubcategories = require("../utility/utils");
const ProductVariant = require("../models/product_varient");
const { Product_Color } = require("../models/product_color.model");
const namedColors = require("color-name-list");
const ProductImage = require("../models/product_images");
const cacheService = require("../services/cache.service");
const Inventory = require("../models/inventory.model");
const { uploadOnCloudinary, deleteFromCloudinary } = require("../middlewares/Cloudinary");
const cloudinary = require("cloudinary").v2;
module.exports.addProduct_post = catchAsync(async (req, res) => {
  // Parse product data from form-data
  let productData;
  if (req.body.product) {
    try {
      productData = JSON.parse(req.body.product);
    } catch (err) {
      return errorRes(res, 400, "Invalid product data JSON.");
    }
  } else {
    productData = req.body;
  }

  if (!productData) return errorRes(res, 400, "Product details are required.");

  if (productData.productSlug) {
    const findSlug = await Product.findOne({
      productSlug: productData.productSlug,
    });
    if (findSlug) {
      return errorRes(res, 400, "Product slug already exist");
    }
  }
  if (productData.skuNo) {
    const findSku = await Product.findOne({ skuNo: productData.skuNo });
    if (findSku) {
      return errorRes(res, 400, "Product sku already exist");
    }
  }

  // Handle image uploads
  const files = req.files || [];
  let imageUrls = [];
  let cloudinaryPublicIds = [];
  for (const file of files) {
    const data = await cloudinary.uploader.upload(file.path);
    if (data && data.secure_url) {
      imageUrls.push(data.secure_url);
      cloudinaryPublicIds.push(data.public_id);
    }
  }
  productData.productImageUrl = imageUrls;

  const product = new Product(productData);

  try {
    const savedProd = await product.save();
    if (!savedProd) {
      // Cleanup images if product not saved
      for (const publicId of cloudinaryPublicIds) {
        await deleteFromCloudinary(publicId);
      }
      return errorRes(res, 400, "Internal server error. Please try again.");
    } else {
      const result = await Product.findById(savedProd._id).select("-__v");
      return successRes(res, {
        product: result,
        message: "Product added successfully.",
      });
    }
  } catch (err) {
    // Cleanup images if product creation fails
    for (const publicId of cloudinaryPublicIds) {
      await deleteFromCloudinary(publicId);
    }
    return internalServerError(res, err);
  }
});

const bulkAddProducts = catchAsync(async function (products) {
  const product = products[0];
  const colorsPresent = await Product_Color.find();
  const colorsInVarients = new Set();

  Array.from(product.varients).forEach((element) => {
    colorsInVarients.add(element.color);
  });

  const colors = Array.from(colorsInVarients);

  const notAvailableColors = colors.filter((color) => {
    return !colorsPresent.find((e) => e.slug === color);
  });

  const colorsToInsert = notAvailableColors.map((color) => {
    return {
      color_name: String(color).toLocaleLowerCase(),
      hexcode:
        namedColors.find((e) =>
          e.name.toLowerCase().match(new RegExp(`^${color.toLowerCase()}`))
        )?.hex || "#ffffff",
      slug: String(color).toUpperCase(),
    };
  });

  await Product_Color.insertMany(colorsToInsert);

  const savedProduct = await Product.create(product);

  const newColors = await Product_Color.find();

  const bulkVarients = product.varients.map((variant) => ({
    productId: savedProduct._id,
    size: variant.size,
    price: variant.price,
    salePrice: variant.salePrice,
    stock: variant.stock,
    color: newColors.find((e) => e.slug === variant.color)._id,
    imageUrls: variant.imageUrls,
  }));

  await ProductVariant.insertMany(bulkVarients);
    const { uploadOnCloudinary } = require("../middlewares/Cloudinary");
    for (const product of products) {
      // Handle product images
      if (product.images && Array.isArray(product.images)) {
        let imageUrls = [];
        for (const file of product.images) {
          const url = await uploadOnCloudinary(file);
          if (url) imageUrls.push(url);
        }
        product.productImageUrl = imageUrls;
      }
      // Handle variant images
      if (product.varients && Array.isArray(product.varients)) {
        for (const variant of product.varients) {
          if (variant.images && Array.isArray(variant.images)) {
            let variantImageUrls = [];
            for (const file of variant.images) {
              const url = await uploadOnCloudinary(file);
              if (url) variantImageUrls.push(url);
            }
            variant.imageUrls = variantImageUrls;
          }
        }
      }
    }
});

module.exports.uploadProductBulk = catchAsync(async (req, res) => {
  const { products } = req.body;

  if (!products || products.length === 0)
    return errorRes(res, 400, "Products are required.");

  try {
    const insertedProducts = await bulkAddProducts(products);
    successRes(
      res,
      { products: insertedProducts },
      "Products added successfully."
    );
  } catch (error) {
    console.error(error);
    errorRes(res, 500, "Error while adding products: " + error.message);
  }
});

module.exports.editProduct_post = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { product: productData } = req.body;

  if (!productData) return errorRes(res, 400, "Product details are required.");

  if (productData.productSlug) {
    const findSlug = await Product.findOne({
      productSlug: productData.productSlug,
      _id: { $ne: productId },
    });
    if (findSlug) {
      return errorRes(res, 400, "Product slug already exist");
    }
  }
  if (productData.skuNo) {
    const findSku = await Product.findOne({
      skuNo: productData.skuNo,
      _id: { $ne: productId },
    });
    if (findSku) {
      return errorRes(res, 400, "Product sku already exist");
    }
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: productData },
    { new: true }
  );

  if (!product) return errorRes(res, 400, "Product not found.");

  successRes(res, { product }, "Product updated successfully.");
});

module.exports.allProducts_get = catchAsync(async (req, res) => {
  const search = req.query.search;
  const categoryId = req.query.categoryId;
  const isAdmin = req?.user?.role == "admin";
  const filter = {};

  if (search) {
    filter.productTitle = { $regex: search, $options: "i" };
  }

  if (!isAdmin) {
    filter.isActive = true;
  }

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

module.exports.getParticularProduct_get = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const isAdmin = req.user?.role !== "admin" ? false : true;
  const filter = { _id: productId };
  if (!isAdmin) {
    filter.isActive = true;
  }
  const productPromise = Product.find(filter).populate(
    "category",
    "_id name description displayImage"
  );
  const variantPromise = ProductVariant.find(filter).populate(
    "color",
    "_id color_name hexcode"
  );

  const productImagePromise = ProductImage.find({ productId });

  const [product, variants, images] = await Promise.all([
    productPromise,
    variantPromise,
    productImagePromise,
  ]);

  if (!product[0]) return errorRes(res, 404, "Product not found.");

  successRes(res, { product: product[0], variants, images });
});

module.exports.deleteProduct_delete = async (req, res) => {
  const { productId } = req.params;
  try {
    const findProduct = await Product.findById({ _id: productId });
    if (findProduct) {
      findProduct.displayImage.map(async (e) => {
        await deleteFromCloudinary(e.url);
      });
    } else {
      errorRes(res, 404, "Product not found");
    }
  } catch (error) {
    internalServerError(res, "error in finding the product");
  }
  Product.findByIdAndDelete(productId)
    .then((deletedProduct) => {
      if (!deletedProduct) return errorRes(res, 404, "Product not found.");
      return successRes(res, {
        deletedProduct,
        message: "Product deleted successfully.",
      });
    })
    .catch((err) => internalServerError(res, err));
};

module.exports.filterProducts_post = async (req, res) => {
  const {
    categories,
    product_subCategory,
    minPrice,
    maxPrice,
    colors,
    sortBy,
  } = req.body;

  let query = {};
  let query1 = {};

  if (minPrice && maxPrice) {
    query.price = { $gte: minPrice, $lte: maxPrice };
    query1.price = { $gte: minPrice, $lte: maxPrice };
  } else if (minPrice) {
    query.price = { $gte: minPrice };
    query1.price = { $gte: minPrice };
  } else if (maxPrice) {
    query.price = { $lte: maxPrice };
    query1.price = { $lte: maxPrice };
  }

  if (colors && colors.length != 0) {
    query.color = { $in: colors };
    query1.color = { $in: colors };
  }

  // let subCategoryQuery = {};

  if (product_subCategory && product_subCategory.length != 0) {
    query1.product_subCategory = { $in: product_subCategory };
  }

  if (categories && categories.length != 0) {
    query.product_category = { $in: categories };
  }

  let combinedQuery =
    categories?.length > 0 && product_subCategory?.length > 0
      ? [query, query1]
      : categories?.length > 0
      ? [query]
      : [query1];

  let sortQuery = {};

  if (sortBy === "price-high-to-low") sortQuery.price = -1;
  else if (sortBy === "price-low-to-high") sortQuery.price = 1;
  else if (sortBy === "latest") sortQuery.createdAt = -1;

  // console.log({ query, subCategoryQuery, sortQuery });
  try {
    const products = await Product.find({
      $or: combinedQuery,
    })
      .populate("color category")
      .sort(sortQuery);
    return successRes(res, { products });
  } catch (err) {
    return internalServerError(res, err);
  }
};

module.exports.randomProducts_get = async (req, res) => {
  const limit = Number(req.params.limit); // Convert to number
  if (isNaN(limit) || limit <= 0) {
    return errorRes(res, 400, "Invalid limit parameter.");
  }

  Product.find()
    .populate("category color")
    .limit(limit)
    .then((products) => successRes(res, { products }))
    .catch((err) => internalServerError(res, err));
};
module.exports.paginatedSearch = asynchandler(async (req, res) => {
  const { page, limit } = req.query;
  console.log(req.query);
  const getAllProducts = await Product.find();
  if (getAllProducts) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const result = getAllProducts.slice(startIndex, endIndex);
    const finalResult = {
      result: result,
      totalPage: Math.ceil(getAllProducts.length / limit),
    };
    successRes(res, finalResult);
  } else {
    internalServerError(res, "Unable to fetch the products");
  }
});

module.exports.availabilityUpdate_put = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { isAvailable } = req.body;
    if (!variantId || !isAvailable) {
      return errorRes(res, 400, "Please provide variantId and isAvailable.");
    }
    const updatedProduct = await Product.findOneAndUpdate(
      { "priceVarient._id": variantId },
      { $set: { "priceVarient.$.isAvailable": isAvailable } },
      { new: true }
    );
    if (!updatedProduct) {
      return internalServerError(res, "Internal Server Error.");
    }
    successRes(res, { updatedProduct }, "Product update Successfully.");
  } catch (error) {
    internalServerError(res, "error in finding the product");
  }
};

module.exports.searchProduct = async (req, res) => {
  const { query } = req.query;
  const queryObject = {};
  console.log(query);
  if (query) {
    queryObject.displayName = { $regex: query, $options: "i" };
    queryObject.product_subCategory = { $regex: query, $options: "i" };
  }
  try {
    const findProduct = await Product.find(queryObject);
    if (findProduct) {
      successRes(res, findProduct);
    } else {
      errorRes(res, 400, "Cannot find the product");
    }
  } catch (error) {
    internalServerError(res, "Error in searching product");
  }
};

module.exports.prodct_search_get = async (req, res) => {
  try {
    const { query } = req.query;
    const queryObject = {};
    if (query) {
      queryObject.displayName = { $regex: query, $options: "i" };
    }
    const findProduct = await Product.find(queryObject).limit(5);
    if (findProduct) {
      successRes(res, findProduct);
    } else {
      errorRes(res, 400, "Cannot find the product");
    }
  } catch (error) {
    internalServerError(res, "Error in searching product");
  }
};

module.exports.updateFeatured = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isFeatured } = req.body;

    if (!productId || !isFeatured) {
      return errorRes(res, 400, "All details mandatory.");
    }

    const find = await Product.findByIdAndUpdate(
      productId,
      { isFeatured },
      { new: true }
    );

    if (!find) {
      return errorRes(res, 500, "Update Product Failed.");
    }

    successRes(res, find, "Update Product is Done.");
  } catch (error) {
    internalServerError(res, "Internal server error.");
  }
};

module.exports.getFeaturedProducts = async (req, res) => {
  try {
    // Use $match to filter only featured products and $sample to get random products
    const featuredProducts = await Product.aggregate([
      { $match: { isFeatured: true } },
      { $sample: { size: 8 } },
    ]);

    successRes(
      res,
      { products: featuredProducts },
      "Featured products retrieved successfully."
    );
  } catch (error) {
    internalServerError(res, "Internal server error.");
  }
};