const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const wishlistSchema = mongoose.Schema(
  {
    product: {
      type: ObjectId,
      required: true,
      ref: "Product",
    },
    variant: {
      type: ObjectId,
      required: true,
      ref: "ProductVarient",
    },
    user: {
      type: ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Wishlist = mongoose.model("User_Wishlist", wishlistSchema);

module.exports = Wishlist;
