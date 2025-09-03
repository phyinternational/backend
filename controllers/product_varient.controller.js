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
  console.log(productId, colorId);
  const variant = await Product.findById(req.params.productId);
  if (!variant) {
    return res.status(400).send("No product found with that ID", 404);
  }

  const productImage = await ProductImage.findOne({
    productId: req.params.productId,
    color: req.params.colorId,
  });

  if (productImage) {
    productImage.imageUrls = req.body.imageUrls;
    await productImage.save();
    return res.status(200).json({
      status: "success",
      data: {
        productImage,
      },
    });
  } else {
    const imageUrls = await ProductImage.create({
      productId: req.params.productId,
      color: req.params.colorId,
      imageUrls: req.body.imageUrls,
    });

    if (!imageUrls) {
      return next(new AppError("No product found with that ID", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        imageUrls,
      },
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
