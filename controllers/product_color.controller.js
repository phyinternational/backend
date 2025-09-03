const mongoose = require("mongoose");
const Product_Color = mongoose.model("Product_Color");
const {
  errorRes,
  internalServerError,
  successRes,
  hexcodeValidate,
  firstLetterCapitalInString,
} = require("../utility");
const catchAsync = require("../utility/catch-async");

module.exports.addColor_post = catchAsync(async (req, res) => {
  const { color_name, hexcode, slug } = req.body;

  if (!color_name || !hexcode || !slug)
    return errorRes(res, 400, "All fields are required.");

  if (!hexcodeValidate(hexcode)) return errorRes(res, 400, "Invalid hexcode");

  const hexCodeExist = await Product_Color.findOne({ hexcode });
  if (hexCodeExist)
    return errorRes(
      res,
      400,
      `Given hexcode already exist with name: ${hexCodeExist.color_name}`
    );

  const resultColor = firstLetterCapitalInString(color_name);
  Product_Color.findOne({ color_name: resultColor })
    .then(async (savedcolor) => {
      if (savedcolor) return errorRes(res, 400, "Color name already exist.");

      const productColor = new Product_Color({
        color_name: resultColor,
        hexcode,
        slug,
      });

      await productColor
        .save()
        .then((savedProductColor) =>
          successRes(res, {
            product_color: savedProductColor,
            message: "Color added successfully.",
          })
        )
        .catch((err) => internalServerError(res, err));
    })
    .catch((err) => internalServerError(res, err));
});

module.exports.updateColor_post = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { color_name, hexcode, slug } = req.body;

  if (!color_name || !hexcode || !slug)
    return errorRes(res, 400, "All fields are required.");

  if (!hexcodeValidate(hexcode)) return errorRes(res, 400, "Invalid hexcode");

  const resultColor = firstLetterCapitalInString(color_name);
  Product_Color.findOne({ color_name: resultColor })
    .then(async (savedcolor) => {
      if (savedcolor && savedcolor._id != id)
        return errorRes(res, 400, "Color name already exist.");

      await Product_Color.findByIdAndUpdate(
        id,
        { color_name: resultColor, hexcode, slug },
        { new: true }
      )
        .then((updatedColor) =>
          successRes(res, {
            product_color: updatedColor,
            message: "Color updated successfully.",
          })
        )
        .catch((err) => internalServerError(res, err));
    })
    .catch((err) => internalServerError(res, err));
});

module.exports.allColor_get = (req, res) => {
  Product_Color.find()
    .sort("color_name")
    .then((colors) => successRes(res, { colors }))
    .catch((err) => internalServerError(res, err));
};

module.exports.singleColor_get = catchAsync(async (req, res) => {
  const { id } = req.params;
  const color = await Product_Color.findById(id);
  if (!color) return errorRes(res, 404, "Color not found.");
  successRes(res, { color });
});

module.exports.deleteColor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deletedColor = await Product_Color.findByIdAndUpdate(
    id,
    { is_deleted: true },
    { new: true }
  );
  if (!deletedColor) return errorRes(res, 404, "Color not found.");
  successRes(res, { message: "Color deleted successfully." });
});
