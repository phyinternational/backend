const mongoose = require("mongoose");
const { slugify } = require("../utility/slug");

const bannerSchema = new mongoose.Schema(
  {
    bannerImages: [
      {
        type: String,
        default:
          "https://res.cloudinary.com/piyush27/image/upload/v1677079091/WhatsApp_Image_2023-02-22_at_8.47.17_PM_agawba.jpg",
      },
    ],
    title: {
      type: String,
    },
    content: {
      type: String,
    },
    slug: {
      type: String,
      unique: true,
      index: true, // Adding index to the slug field
    },
  },
  { timestamps: true }
);

bannerSchema.pre("save", function (next) {
  this.slug = slugify(this.title, { lower: true, strict: true });
  next();
});

const bannerModel = mongoose.model("Banner", bannerSchema);
module.exports = bannerModel;
