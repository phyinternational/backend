const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    type: String,
    name: String,
    slug:{
      type:String,
      required:true,
      unique:true
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // Reference the "Category" model
    },
    imageUrl: String,
  },
  {
    timestamps: true, // Add this option for createdAt and updatedAt fields
  }
);

mongoose.model("category", categorySchema);
const ProductCategory = mongoose.model("category");
module.exports = ProductCategory;
