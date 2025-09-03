const mongoose = require("mongoose");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const Brand = require("../models/brand-model");

module.exports.addBrand = catchAsync(async (req, res) => {
  const { brand_name } = req.body;

  const brandExists = await Brand.findOne({ brand_name });

  if (brandExists)
    return errorRes(res, 400, "Brand with this name already exists.");

  const brand = await Brand.create({ brand_name });

  successRes(res, { brand, message: "Brand added successfully." });
});

module.exports.editBrand = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { brand_name } = req.body;

  const brand = await Brand.findByIdAndUpdate(
    id,
    { brand_name },
    { new: true }
  );

  if (!brand) return errorRes(res, 404, "Brand does not exist.");

  successRes(res, { brand, message: "Brand updated successfully." });
});

module.exports.getAllBrands = (req, res) => {
  Brand.find()
    .then((brands) => successRes(res, { brands }))
    .catch((err) => internalServerError(res, err));
};

module.exports.deleteBrand = catchAsync(async (req, res) => {
  const { id } = req.params;

  const brand = await Brand.findByIdAndDelete(id);

  if (!brand) return errorRes(res, 404, "Brand does not exist.");

  successRes(res, { message: "Brand deleted successfully." });
});

module.exports.getBrandById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const brand = await Brand.findById(id);

  if (!brand) return errorRes(res, 404, "Brand does not exist.");

  successRes(res, { brand });
});
