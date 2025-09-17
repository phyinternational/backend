const ProductImage = require("../models/product_images");
const Product = require("../models/product.model");
const productVariation = require("../models/product_varient");
const catchAsync = require("../utility/catch-async");
const { errorRes } = require("../utility");

module.exports.addProductVariation = catchAsync(async (req, res, next) => {
  const existingVariation = await productVariation.findOne({
    productId: req.body.productId,
    size: req.body.size,
    color: req.body.color,
  });

  if (existingVariation) {
    console.log("This variation already exists");
    return res.status(400).json({
      status: "fail",
      message: "This variation already exists",
    });
  }

  const variant = await productVariation.create(req.body);
  res.status(201).json({
    status: "success",
    data: {
      variant,
    },
  });
});

module.exports.updateProductVariation = catchAsync(async (req, res, next) => {
  const variant = await productVariation
    .findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    .populate("color");
  if (!variant) {
    return next(new AppError("No product found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      variant,
    },
  });
});

module.exports.deleteProductVariation = catchAsync(async (req, res, next) => {
  const variant = await productVariation.findByIdAndDelete(req.params.id);
  if (!variant) {
    return next(new AppError("No product found with that ID", 404));
  }
  res.status(204).json({
    status: "success",
    data: null,
  });
});

module.exports.getAllProductVariation = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const isAdmin = req.user?.role == "admin";
  const filter = isAdmin ? {} : { isActive: true };
  
  filter.productId = id;
  console.log(filter);
  const variants = await productVariation.find(filter).populate("color");
  res.status(200).json({
    status: "success",
    results: variants.length,
    data: {
      variants,
    },
  });
});

module.exports.getProductVariation = catchAsync(async (req, res, next) => {
  const variant = await productVariation
    .findById(req.params.id)
    .populate("color");
  if (!variant) {
    return next(new AppError("No product found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      variant,
    },
  });
});

module.exports.addProductImage = catchAsync(async (req, res, next) => {
  const { productId, colorId } = req.params;
  const { uploadOnCloudinary, deleteFromCloudinary } = require("../middlewares/Cloudinary");
  let productImage = await ProductImage.findOne({ productId, color: colorId });

  const files = req.files || [];
  let newImageUrls = [];
  let cloudinaryPublicIds = [];
  for (const file of files) {
    const data = await uploadOnCloudinary(file);
    if (data && data.secure_url) {
      newImageUrls.push(data.secure_url);
      cloudinaryPublicIds.push(data.public_id);
    }
  }

  if (productImage) {
    // Add new images to existing array
    productImage.imageUrls.push(...newImageUrls);
    await productImage.save();
    return res.status(200).json({
      status: "success",
      data: { productImage }
    });
  }

  // Try to create ProductImage document if not exists
  try {
    productImage = await ProductImage.create({
      productId,
      color: colorId,
      imageUrls: newImageUrls
    });
    res.status(200).json({
      status: "success",
      data: { productImage }
    });
  } catch (err) {
    for (const publicId of cloudinaryPublicIds) {
      await deleteFromCloudinary(publicId);
    }
    return res.status(500).json({
      status: "error",
      message: "Failed to save product image document. Cloudinary uploads cleaned up.",
      error: err.message
    });
  }
});

module.exports.getProductImages = catchAsync(async (req, res, next) => {
  const productImage = await ProductImage.findOne({
    productId: req.params.productId,
    color: req.params.colorId,
  });
  if (!productImage) {
    return res.status(200).json({
      status: "success",
      data: {
        productImage,
      },
    });
  }
  res.status(200).json({
    status: "success",
    data: {
      productImage,
    },
  });
});

module.exports.getAllProductImages = catchAsync(async (req, res, next) => {
  const productImage = await ProductImage.find({
    productId: req.params.productId,
  });
  if (!productImage) {
    return res.status(200).json({
      status: "success",
      data: {
        productImage,
      },
    });
  }
  res.status(200).json({
    status: "success",
    data: {
      productImage,
    },
  });
});
