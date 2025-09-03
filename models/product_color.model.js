const mongoose = require("mongoose");

const productColorSchema = new mongoose.Schema(
  {
    color_name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    hexcode: {
      type: String,
      required: true,
    },
    is_deleted: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true },
  { versionKey: false }
);

mongoose.model("Product_Color", productColorSchema);

module.exports.Product_Color = mongoose.model("Product_Color");